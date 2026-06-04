import {
  getFirstAvailableHistory,
  getFirstAvailableNews,
  getFirstAvailableQuote,
  type HistoricalBar,
  type NewsArticle,
  type PriceData,
} from "./market-providers";
import {
  queryRows,
  queryRow,
  runSql,
  upsertCurrentPrice,
  upsertPriceHistoryRow,
  upsertStockTimestamp,
} from "./postgres-access";
import { enrichNewsRows, stripHtml } from "./news-intelligence";
import { aggregateNewsSentiment, analyzeNewsArticle, type AggregatedSentimentResult } from "./news-sentiment";

async function saveNewsArticles(ticker: string, articles: NewsArticle[]): Promise<AggregatedSentimentResult> {
  const normalizedArticles = articles.map((article) => ({
    ...article,
    headline: stripHtml(article.headline),
    summary: stripHtml(article.summary),
  }));

  for (const article of normalizedArticles) {
    const sentiment = analyzeNewsArticle({
      headline: article.headline,
      summary: article.summary,
      publishedAt: article.published_at,
    });
    const exists = await queryRow<{ id: number }>(
      "SELECT id FROM news WHERE ticker = ? AND headline = ? AND published_at = ? LIMIT 1",
      [ticker, article.headline, article.published_at]
    );
    if (!exists) {
      await runSql(`
        INSERT INTO news (
          ticker, headline, summary, source, url, published_at, sentiment_label, sentiment_score, impact_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ticker,
        article.headline,
        article.summary,
        article.source,
        article.url,
        article.published_at,
        sentiment.label,
        sentiment.score,
        sentiment.impactScore
      ]);
    }
  }

  const savedRows = await queryRows<{
    id: number;
    ticker: string | null;
    headline: string;
    summary: string | null;
    source: string | null;
    url: string | null;
    published_at: string | null;
    sentiment_label: "positive" | "neutral" | "negative" | null;
    sentiment_score: number | null;
    impact_score: number | null;
    clean_summary?: string | null;
    impact_label?: string | null;
    priority_category?: string | null;
    priority_rank?: number | null;
    priority_score?: number | null;
    ai_summary_json?: string | null;
  }>(
    "SELECT * FROM news WHERE ticker = ? ORDER BY published_at DESC LIMIT ?",
    [ticker, Math.max(normalizedArticles.length, 8)]
  );
  await enrichNewsRows(savedRows, new Set<string>([ticker.toUpperCase()]));

  const aggregated = aggregateNewsSentiment(
    normalizedArticles.map((article) => ({
      headline: article.headline,
      summary: article.summary,
      publishedAt: article.published_at,
    }))
  );

  await runSql(`
    INSERT INTO sentiment (ticker, source_type, score, label, impact_score, source_count, summary, metadata_json)
    VALUES (?, 'news', ?, ?, ?, ?, ?, ?)
  `, [
    ticker,
    aggregated.score,
    aggregated.label,
    aggregated.impactScore,
    aggregated.sourceCount,
    aggregated.summary,
    JSON.stringify({ articleCount: articles.length })
  ]);

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
    const averageVolume = await queryRow<{ avgVolume: number | null }>(`
      SELECT AVG(volume) as avgVolume
      FROM (
        SELECT volume
        FROM price_history
        WHERE ticker = ? AND volume IS NOT NULL
        ORDER BY date DESC
        LIMIT 20
      ) latest_volume
    `, [ticker]);

    await upsertCurrentPrice({
      ticker,
      price: data.price,
      changePct: data.change_pct,
      changeAbs: data.change_abs,
      volume: data.volume,
      avgVolume: averageVolume?.avgVolume || null,
      source: data.source,
    });

    const today = new Date().toISOString().split("T")[0];
    const barData = {
      ticker,
      date: today,
      open: data.open || data.price,
      high: data.high || data.price,
      low: data.low || data.price,
      close: data.price,
      volume: data.volume,
      source: data.source,
    };
    await upsertPriceHistoryRow({ table: "price_history", ...barData });
    await upsertPriceHistoryRow({ table: "stock_prices", ...barData });
    await upsertStockTimestamp(ticker);
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

  return await saveNewsArticles(ticker, articles);
}

async function logError(
  ticker: string | null,
  source: string,
  errorType: string,
  message: string
): Promise<void> {
  try {
    await runSql(`
      INSERT INTO fetch_errors (ticker, source, error_type, message)
      VALUES (?, ?, ?, ?)
    `, [ticker, source, errorType, message]);
  } catch {
    // ignore
  }
}
