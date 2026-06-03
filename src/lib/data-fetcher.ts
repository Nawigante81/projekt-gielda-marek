import { getDb, getSetting } from "./db";
import { aggregateNewsSentiment, analyzeNewsArticle, type AggregatedSentimentResult } from "./news-sentiment";

interface PriceData {
  ticker: string;
  price: number;
  change_pct: number;
  change_abs: number;
  volume: number;
  high?: number;
  low?: number;
  open?: number;
  source: string;
}

interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NewsArticle {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
}

const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

function getNumericSetting(key: string, fallback: number): number {
  const value = parseInt(getSetting(key) || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function getCachedValue<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value as T;
}

function setCachedValue<T>(key: string, ttlSeconds: number, value: T): T {
  responseCache.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value });
  return value;
}

async function fetchWithRetry(url: string, init: RequestInit, source: string, ticker: string): Promise<Response> {
  const attempts = Math.max(1, getNumericSetting("retry_attempts", 3));
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  logError(ticker, source, "retry_exhausted", String(lastError || "Request failed"));
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

async function getCachedJson<T>(
  cacheKey: string,
  ttlSeconds: number,
  url: string,
  init: RequestInit,
  source: string,
  ticker: string
): Promise<T> {
  const cached = getCachedValue<T>(cacheKey);
  if (cached !== null) return cached;
  const response = await fetchWithRetry(url, init, source, ticker);
  const data = await response.json();
  return setCachedValue(cacheKey, ttlSeconds, data as T);
}

async function getCachedText(
  cacheKey: string,
  ttlSeconds: number,
  url: string,
  init: RequestInit,
  source: string,
  ticker: string
): Promise<string> {
  const cached = getCachedValue<string>(cacheKey);
  if (cached !== null) return cached;
  const response = await fetchWithRetry(url, init, source, ticker);
  const data = await response.text();
  return setCachedValue(cacheKey, ttlSeconds, data);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTagValue(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXmlEntities(match?.[1]?.trim() || "");
}

function parseGoogleNewsFeed(xml: string): NewsArticle[] {
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));
  return items.slice(0, 10).map((match) => {
    const block = match[1];
    const rawTitle = extractTagValue(block, "title");
    const titleParts = rawTitle.split(" - ");
    const source = titleParts.length > 1 ? titleParts[titleParts.length - 1] : "Google News";
    const headline = titleParts.length > 1 ? titleParts.slice(0, -1).join(" - ") : rawTitle;
    return {
      headline,
      summary: extractTagValue(block, "description"),
      source,
      url: extractTagValue(block, "link"),
      published_at: extractTagValue(block, "pubDate") || new Date().toISOString(),
    };
  }).filter((item) => item.headline && item.url);
}

function saveNewsArticles(ticker: string, articles: NewsArticle[]): AggregatedSentimentResult {
  const db = getDb();
  const existsStmt = db.prepare(
    "SELECT id FROM news WHERE ticker = ? AND headline = ? AND published_at = ? LIMIT 1"
  );
  const insertStmt = db.prepare(`
    INSERT INTO news (
      ticker, headline, summary, source, url, published_at, sentiment_label, sentiment_score, impact_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const article of articles) {
    const sentiment = analyzeNewsArticle({
      headline: article.headline,
      summary: article.summary,
      publishedAt: article.published_at,
    });
    const exists = existsStmt.get(ticker, article.headline, article.published_at);
    if (!exists) {
      insertStmt.run(
        ticker,
        article.headline,
        article.summary,
        article.source,
        article.url,
        article.published_at,
        sentiment.label,
        sentiment.score,
        sentiment.impactScore
      );
    }
  }

  const aggregated = aggregateNewsSentiment(
    articles.map((article) => ({
      headline: article.headline,
      summary: article.summary,
      publishedAt: article.published_at,
    }))
  );

  db.prepare(`
    INSERT INTO sentiment (ticker, source_type, score, label, impact_score, source_count, summary, metadata_json)
    VALUES (?, 'news', ?, ?, ?, ?, ?, ?)
  `).run(
    ticker,
    aggregated.score,
    aggregated.label,
    aggregated.impactScore,
    aggregated.sourceCount,
    aggregated.summary,
    JSON.stringify({ articleCount: articles.length })
  );

  return aggregated;
}

// ===== FINNHUB =====
async function fetchFromFinnhub(ticker: string): Promise<PriceData | null> {
  const apiKey = process.env.FINNHUB_API_KEY || getSetting("finnhub_api_key");
  if (!apiKey) return null;

  try {
    const q = await getCachedJson<Record<string, number>>(
      `finnhub:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
      "finnhub",
      ticker
    );
    if (!q.c || q.c === 0) return null;

    return {
      ticker,
      price: q.c,
      change_abs: q.d || 0,
      change_pct: q.dp || 0,
      volume: q.v || 0,
      high: q.h,
      low: q.l,
      open: q.o,
      source: "finnhub",
    };
  } catch {
    logError(ticker, "finnhub", "fetch_error", "Finnhub request failed");
    return null;
  }
}

// ===== ALPHA VANTAGE =====
async function fetchFromAlphaVantage(
  ticker: string
): Promise<PriceData | null> {
  const apiKey =
    process.env.ALPHA_VANTAGE_API_KEY || getSetting("alphavantage_api_key");
  if (!apiKey) return null;

  try {
    const data = await getCachedJson<Record<string, Record<string, string>>>(
      `alphavantage:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
      "alphavantage",
      ticker
    );
    const gq = data["Global Quote"];
    if (!gq || !gq["05. price"]) return null;

    return {
      ticker,
      price: parseFloat(gq["05. price"]),
      change_abs: parseFloat(gq["09. change"] || "0"),
      change_pct: parseFloat(
        (gq["10. change percent"] || "0%").replace("%", "")
      ),
      volume: parseInt(gq["06. volume"] || "0"),
      high: parseFloat(gq["03. high"]),
      low: parseFloat(gq["04. low"]),
      open: parseFloat(gq["02. open"]),
      source: "alphavantage",
    };
  } catch {
    logError(ticker, "alphavantage", "fetch_error", "Alpha Vantage request failed");
    return null;
  }
}

// ===== YFINANCE (via Yahoo Finance unofficial API) =====
async function fetchFromYahoo(ticker: string): Promise<PriceData | null> {
  try {
    const yahooTicker = ticker.replace("^", "%5E");
    const data = await getCachedJson<Record<string, unknown>>(
      `yahoo:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=2d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; StockAnalyst/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      }
      ,
      "yahoo",
      ticker
    );
    const result = (data as { chart?: { result?: Array<Record<string, any>> } })?.chart?.result?.[0] as Record<string, any> | undefined;
    if (!result) return null;

    const meta = (result.meta || {}) as Record<string, number | undefined>;
    const price = meta.regularMarketPrice || meta.previousClose;
    if (!price) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const changeAbs = prevClose ? price - prevClose : 0;
    const changePct = prevClose ? (changeAbs / prevClose) * 100 : 0;

    return {
      ticker,
      price,
      change_abs: changeAbs,
      change_pct: changePct,
      volume: meta.regularMarketVolume || 0,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      open: meta.regularMarketOpen,
      source: "yahoo",
    };
  } catch {
    logError(ticker, "yahoo", "fetch_error", "Yahoo Finance request failed");
    return null;
  }
}

// ===== Historical Data =====
export async function fetchHistoricalData(
  ticker: string,
  days = 200
): Promise<HistoricalBar[]> {
  try {
    const yahooTicker = ticker.replace("^", "%5E");
    const data = await getCachedJson<Record<string, unknown>>(
      `yahoo:history:${ticker}:${days}`,
      getNumericSetting("market_cache_ttl_seconds", 900),
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=${days}d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StockAnalyst/1.0)" },
        signal: AbortSignal.timeout(15000),
      },
      "yahoo",
      ticker
    );
    const result = (data as { chart?: { result?: Array<Record<string, any>> } })?.chart?.result?.[0] as Record<string, any> | undefined;
    if (!result) throw new Error("No result from Yahoo");

    const timestamps = (result.timestamp || []) as number[];
    const quotes = (result.indicators?.quote?.[0] || {}) as Record<string, Array<number | null | undefined>>;
    const bars: HistoricalBar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close?.[i];
      if (!close) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
      bars.push({
        date,
        open: quotes.open?.[i] || close,
        high: quotes.high?.[i] || close,
        low: quotes.low?.[i] || close,
        close,
        volume: quotes.volume?.[i] || 0,
      });
    }
    return bars;
  } catch {
    return [];
  }
}

// ===== Main Fetch with Fallback =====
export async function fetchPrice(ticker: string): Promise<PriceData | null> {
  const primarySource = getSetting("data_source_primary") || "finnhub";

  let data: PriceData | null = null;

  if (primarySource === "finnhub") {
    data = await fetchFromFinnhub(ticker);
    if (!data) data = await fetchFromAlphaVantage(ticker);
    if (!data) data = await fetchFromYahoo(ticker);
  } else if (primarySource === "alphavantage") {
    data = await fetchFromAlphaVantage(ticker);
    if (!data) data = await fetchFromFinnhub(ticker);
    if (!data) data = await fetchFromYahoo(ticker);
  } else {
    data = await fetchFromYahoo(ticker);
    if (!data) data = await fetchFromFinnhub(ticker);
    if (!data) data = await fetchFromAlphaVantage(ticker);
  }

  if (data) {
    const db = getDb();
    const averageVolume = db.prepare(`
      SELECT AVG(volume) as avgVolume
      FROM price_history
      WHERE ticker = ? AND volume IS NOT NULL
      ORDER BY date DESC
      LIMIT 20
    `).get(ticker) as { avgVolume: number | null } | undefined;

    db.prepare(`
      INSERT OR REPLACE INTO current_prices 
      (ticker, price, change_pct, change_abs, volume, avg_volume, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      ticker,
      data.price,
      data.change_pct,
      data.change_abs,
      data.volume,
      averageVolume?.avgVolume || null,
      data.source
    );

    const today = new Date().toISOString().split("T")[0];
    db.prepare(`
      INSERT OR REPLACE INTO price_history (ticker, date, open, high, low, close, volume, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticker,
      today,
      data.open || data.price,
      data.high || data.price,
      data.low || data.price,
      data.price,
      data.volume,
      data.source
    );

    db.prepare(`
      INSERT OR REPLACE INTO stock_prices (ticker, date, open, high, low, close, volume, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticker,
      today,
      data.open || data.price,
      data.high || data.price,
      data.low || data.price,
      data.price,
      data.volume,
      data.source
    );

    db.prepare(`
      INSERT INTO stocks (ticker, updated_at)
      VALUES (?, datetime('now'))
      ON CONFLICT(ticker) DO UPDATE SET updated_at = datetime('now')
    `).run(ticker);
  }

  return data;
}

async function fetchFinnhubNews(ticker: string): Promise<NewsArticle[]> {
  const apiKey = process.env.FINNHUB_API_KEY || getSetting("finnhub_api_key");
  if (!apiKey) return [];

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const articles = await getCachedJson<Array<Record<string, unknown>>>(
    `finnhub:news:${ticker}`,
    getNumericSetting("news_cache_ttl_seconds", 3600),
    `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${weekAgo}&to=${today}&token=${apiKey}`,
    { signal: AbortSignal.timeout(8000) },
    "finnhub",
    ticker
  );

  if (!Array.isArray(articles)) return [];
  return articles.slice(0, 8).map((article) => ({
    headline: String(article.headline || ""),
    summary: String(article.summary || ""),
    source: String(article.source || "Finnhub"),
    url: String(article.url || ""),
    published_at: article.datetime
      ? new Date(Number(article.datetime) * 1000).toISOString()
      : new Date().toISOString(),
  })).filter((article) => article.headline && article.url);
}

async function fetchGoogleNews(ticker: string): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`${ticker} stock US market`);
  const xml = await getCachedText(
    `google-news:${ticker}`,
    getNumericSetting("news_cache_ttl_seconds", 3600),
    `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StockAnalyst/1.0)" },
      signal: AbortSignal.timeout(10000),
    },
    "google_news",
    ticker
  );
  return parseGoogleNewsFeed(xml);
}

// ===== News Fetching =====
export async function fetchNews(ticker: string): Promise<AggregatedSentimentResult> {
  let articles: NewsArticle[] = [];

  try {
    articles = await fetchFinnhubNews(ticker);
    if (articles.length === 0) {
      articles = await fetchGoogleNews(ticker);
    }
  } catch {
    try {
      articles = await fetchGoogleNews(ticker);
    } catch {
      logError(ticker, "news", "fetch_error", "News fetch failed");
    }
  }

  if (articles.length === 0) {
    return {
      label: "neutral",
      score: 0,
      impactScore: 0,
      sourceCount: 0,
      summary: "Brak newsów dla wskazanego tickera.",
    };
  }

  return saveNewsArticles(ticker, articles);
}

// ===== Error Logging =====
function logError(
  ticker: string | null,
  source: string,
  errorType: string,
  message: string
): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO fetch_errors (ticker, source, error_type, message)
      VALUES (?, ?, ?, ?)
    `).run(ticker, source, errorType, message);
  } catch {
    // ignore
  }
}
