import { getDb } from "./db";
import {
  getFirstAvailableHistory,
  getFirstAvailableNews,
  getFirstAvailableQuote,
  type HistoricalBar,
  type NewsArticle,
  type PriceData,
} from "./market-providers";
import { aggregateNewsSentiment, analyzeNewsArticle, type AggregatedSentimentResult } from "./news-sentiment";

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

export async function fetchHistoricalData(
  ticker: string,
  days = 200
): Promise<HistoricalBar[]> {
  try {
    return await getFirstAvailableHistory(ticker, days);
  } catch {
    return [];
  }
}

export async function fetchPrice(ticker: string): Promise<PriceData | null> {
  let data: PriceData | null = null;

  try {
    data = await getFirstAvailableQuote(ticker);
  } catch (error) {
    logError(ticker, "market", "fetch_error", error instanceof Error ? error.message : "Market quote fetch failed");
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

export async function fetchNews(ticker: string): Promise<AggregatedSentimentResult> {
  let articles: NewsArticle[] = [];

  try {
    articles = await getFirstAvailableNews(ticker);
  } catch {
    logError(ticker, "news", "fetch_error", "News fetch failed");
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

