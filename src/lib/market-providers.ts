import { getSetting } from "./db";

export type MarketDataSource = "finnhub" | "twelvedata" | "alphavantage" | "yahoo";

export interface PriceData {
  ticker: string;
  price: number;
  change_pct: number;
  change_abs: number;
  volume: number;
  high?: number;
  low?: number;
  open?: number;
  source: MarketDataSource;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsArticle {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
}

export interface MarketProvider {
  source: MarketDataSource;
  getQuote(ticker: string): Promise<PriceData | null>;
  getNews(ticker: string): Promise<NewsArticle[]>;
  getHistory(ticker: string, days: number): Promise<HistoricalBar[]>;
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

  throw lastError instanceof Error ? lastError : new Error(`${source} request failed`);
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

function getFinnhubApiKey(): string | null {
  return process.env.FINNHUB_API_KEY || getSetting("finnhub_api_key") || null;
}

function getTwelveDataApiKey(): string | null {
  return process.env.TWELVEDATA_API_KEY || getSetting("twelvedata_api_key") || null;
}

function getAlphaVantageApiKey(): string | null {
  return process.env.ALPHA_VANTAGE_API_KEY || getSetting("alphavantage_api_key") || null;
}

type TwelveDataQuoteResponse = {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  change?: string;
  percent_change?: string;
};

type TwelveDataSeriesItem = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TwelveDataTimeSeriesResponse = {
  values?: TwelveDataSeriesItem[];
};

const finnhubProvider: MarketProvider = {
  source: "finnhub",
  async getQuote(ticker) {
    const apiKey = getFinnhubApiKey();
    if (!apiKey) return null;

    const quote = await getCachedJson<Record<string, number>>(
      `finnhub:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
      "finnhub",
      ticker
    );
    if (!quote.c || quote.c === 0) return null;

    return {
      ticker,
      price: quote.c,
      change_abs: quote.d || 0,
      change_pct: quote.dp || 0,
      volume: quote.v || 0,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      source: "finnhub",
    };
  },
  async getNews(ticker) {
    const apiKey = getFinnhubApiKey();
    if (!apiKey) return [];

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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
  },
  async getHistory() {
    return [];
  },
};

const twelvedataProvider: MarketProvider = {
  source: "twelvedata",
  async getQuote(ticker) {
    const apiKey = getTwelveDataApiKey();
    if (!apiKey) return null;

    const data = await getCachedJson<TwelveDataQuoteResponse>(
      `twelvedata:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
      "twelvedata",
      ticker
    );

    const price = Number(data.close || "");
    if (!Number.isFinite(price)) return null;

    const changeAbs = Number(data.change || "0");
    const changePct = Number(String(data.percent_change || "0").replace("%", ""));
    const volume = Number(data.volume || "0");
    const high = Number(data.high || "");
    const low = Number(data.low || "");
    const open = Number(data.open || "");

    return {
      ticker,
      price,
      change_abs: Number.isFinite(changeAbs) ? changeAbs : 0,
      change_pct: Number.isFinite(changePct) ? changePct : 0,
      volume: Number.isFinite(volume) ? volume : 0,
      high: Number.isFinite(high) ? high : undefined,
      low: Number.isFinite(low) ? low : undefined,
      open: Number.isFinite(open) ? open : undefined,
      source: "twelvedata",
    };
  },
  async getNews() {
    return [];
  },
  async getHistory(ticker, days) {
    const apiKey = getTwelveDataApiKey();
    if (!apiKey) return [];

    const outputsize = Math.min(Math.max(days, 30), 5000);
    const data = await getCachedJson<TwelveDataTimeSeriesResponse>(
      `twelvedata:history:${ticker}:${days}`,
      getNumericSetting("market_cache_ttl_seconds", 900),
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(12000) },
      "twelvedata",
      ticker
    );

    if (!Array.isArray(data.values)) return [];

    return data.values.slice().reverse().map((item) => {
      const close = Number(item.close || "");
      if (!Number.isFinite(close) || !item.datetime) {
        return null;
      }

      const open = Number(item.open || "");
      const high = Number(item.high || "");
      const low = Number(item.low || "");
      const volume = Number(item.volume || "0");

      return {
        date: item.datetime.slice(0, 10),
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    }).filter((item): item is HistoricalBar => item !== null);
  },
};

const alphavantageProvider: MarketProvider = {
  source: "alphavantage",
  async getQuote(ticker) {
    const apiKey = getAlphaVantageApiKey();
    if (!apiKey) return null;

    const data = await getCachedJson<Record<string, Record<string, string>>>(
      `alphavantage:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
      "alphavantage",
      ticker
    );
    const quote = data["Global Quote"];
    if (!quote || !quote["05. price"]) return null;

    return {
      ticker,
      price: parseFloat(quote["05. price"]),
      change_abs: parseFloat(quote["09. change"] || "0"),
      change_pct: parseFloat((quote["10. change percent"] || "0%").replace("%", "")),
      volume: parseInt(quote["06. volume"] || "0", 10),
      high: parseFloat(quote["03. high"]),
      low: parseFloat(quote["04. low"]),
      open: parseFloat(quote["02. open"]),
      source: "alphavantage",
    };
  },
  async getNews() {
    return [];
  },
  async getHistory() {
    return [];
  },
};

const yahooProvider: MarketProvider = {
  source: "yahoo",
  async getQuote(ticker) {
    const yahooTicker = ticker.replace("^", "%5E");
    const data = await getCachedJson<Record<string, unknown>>(
      `yahoo:quote:${ticker}`,
      Math.min(getNumericSetting("market_cache_ttl_seconds", 900), 300),
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=2d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StockAnalyst/1.0)" },
        signal: AbortSignal.timeout(10000),
      },
      "yahoo",
      ticker
    );
    const result = (data as { chart?: { result?: Array<Record<string, unknown>> } })?.chart?.result?.[0] as Record<string, unknown> | undefined;
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
  },
  async getNews(ticker) {
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
  },
  async getHistory(ticker, days) {
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
    const result = (data as { chart?: { result?: Array<Record<string, unknown>> } })?.chart?.result?.[0] as Record<string, unknown> | undefined;
    if (!result) return [];

    const timestamps = (result.timestamp || []) as number[];
    const quotes = (result.indicators as { quote?: Array<Record<string, Array<number | null | undefined>>> } | undefined)?.quote?.[0] || {};
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
  },
};

export const marketProviders: Record<MarketDataSource, MarketProvider> = {
  finnhub: finnhubProvider,
  twelvedata: twelvedataProvider,
  alphavantage: alphavantageProvider,
  yahoo: yahooProvider,
};

export function normalizeMarketDataSource(source: string | null | undefined): MarketDataSource {
  if (source === "finnhub" || source === "twelvedata" || source === "alphavantage" || source === "yahoo") {
    return source;
  }

  if (source === "yfinance") {
    return "yahoo";
  }

  return "finnhub";
}

export function getMarketSourceOrder(): MarketDataSource[] {
  const primarySource = normalizeMarketDataSource(getSetting("data_source_primary") || "finnhub");
  const secondarySource = normalizeMarketDataSource(getSetting("data_source_secondary") || "alphavantage");
  const fallbackSource = normalizeMarketDataSource(getSetting("data_source_fallback") || "yfinance");

  return Array.from(new Set<MarketDataSource>([
    primarySource,
    secondarySource,
    fallbackSource,
    "finnhub",
    "twelvedata",
    "alphavantage",
    "yahoo",
  ]));
}

export async function getQuoteFromSource(source: MarketDataSource, ticker: string): Promise<PriceData | null> {
  return marketProviders[source].getQuote(ticker);
}

export async function getNewsFromSource(source: MarketDataSource, ticker: string): Promise<NewsArticle[]> {
  return marketProviders[source].getNews(ticker);
}

export async function getHistoryFromSource(source: MarketDataSource, ticker: string, days: number): Promise<HistoricalBar[]> {
  return marketProviders[source].getHistory(ticker, days);
}

export async function getFirstAvailableQuote(ticker: string): Promise<PriceData | null> {
  for (const source of getMarketSourceOrder()) {
    try {
      const quote = await getQuoteFromSource(source, ticker);
      if (quote) return quote;
    } catch {
      continue;
    }
  }
  return null;
}

export async function getFirstAvailableNews(ticker: string): Promise<NewsArticle[]> {
  for (const source of getMarketSourceOrder()) {
    try {
      const news = await getNewsFromSource(source, ticker);
      if (news.length > 0) return news;
    } catch {
      continue;
    }
  }
  return [];
}

export async function getFirstAvailableHistory(ticker: string, days: number): Promise<HistoricalBar[]> {
  for (const source of getMarketSourceOrder()) {
    try {
      const history = await getHistoryFromSource(source, ticker, days);
      if (history.length > 0) return history;
    } catch {
      continue;
    }
  }
  return [];
}

