import { getHistoryFromSource, getNewsFromSource, getQuoteFromSource, type HistoricalBar, type NewsArticle, type PriceData } from "./market-providers";

export type FinnhubQuote = {
  c: number;
  d: number;
  dp: number;
  h?: number;
  l?: number;
  o?: number;
  pc: number;
  t: number;
  v: number;
};

export type FinnhubNewsItem = {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
};

export type TwelveDataQuote = {
  symbol: string;
  price: number;
  change_abs: number;
  change_pct: number;
  volume: number;
  high?: number;
  low?: number;
  open?: number;
  source: "twelvedata";
};

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9.^-]{1,20}$/.test(symbol);
}

export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote> {
  const quote = await getQuoteFromSource("finnhub", symbol);
  if (!quote) {
    throw new Error("No Finnhub quote data returned");
  }

  return {
    c: quote.price,
    d: quote.change_abs,
    dp: quote.change_pct,
    h: quote.high,
    l: quote.low,
    o: quote.open,
    pc: 0,
    t: 0,
    v: quote.volume,
  };
}

export async function fetchFinnhubNews(symbol: string, _days = 7): Promise<FinnhubNewsItem[]> {
  const news = await getNewsFromSource("finnhub", symbol);
  return news.map((article, index) => ({
    id: index,
    headline: article.headline,
    summary: article.summary,
    source: article.source,
    url: article.url,
    datetime: Date.parse(article.published_at) / 1000,
  }));
}

export async function fetchTwelveDataQuote(symbol: string): Promise<TwelveDataQuote | null> {
  const quote = await getQuoteFromSource("twelvedata", symbol);
  if (!quote) return null;

  return {
    symbol,
    price: quote.price,
    change_abs: quote.change_abs,
    change_pct: quote.change_pct,
    volume: quote.volume,
    high: quote.high,
    low: quote.low,
    open: quote.open,
    source: "twelvedata",
  };
}

export async function fetchTwelveDataMarketQuote(ticker: string): Promise<PriceData | null> {
  return getQuoteFromSource("twelvedata", ticker);
}

export async function fetchTwelveDataHistory(ticker: string, days: number): Promise<HistoricalBar[]> {
  return getHistoryFromSource("twelvedata", ticker, days);
}

export async function fetchYahooNews(ticker: string): Promise<NewsArticle[]> {
  return getNewsFromSource("yahoo", ticker);
}
