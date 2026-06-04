import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettingValue, queryRow, queryRows, runSql, upsertSetting } from "@/lib/postgres-access";
import { generateUpcomingEarningsAlerts } from "@/lib/earnings";
import { readJsonCache, writeJsonCache } from "@/lib/snapshot-cache";

interface MarketEventRow {
  event_type: string;
  title: string;
  ticker?: string | null;
  sector?: string | null;
  event_date: string;
  period_label?: string | null;
  impact?: string;
  source?: string | null;
  details_json?: string | null;
}

async function eventExists(title: string, eventDate: string, source: string): Promise<boolean> {
  const row = await queryRow(`
    SELECT id FROM market_events WHERE title = ? AND event_date = ? AND source = ? LIMIT 1
  `, [title, eventDate, source]);
  return Boolean(row);
}

async function insertEvent(event: MarketEventRow): Promise<void> {
  if (await eventExists(event.title, event.event_date, event.source || "unknown")) return;
  await runSql(`
    INSERT INTO market_events (event_type, title, ticker, sector, event_date, period_label, impact, source, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    event.event_type,
    event.title,
    event.ticker || null,
    event.sector || null,
    event.event_date,
    event.period_label || null,
    event.impact || "medium",
    event.source || null,
    event.details_json || null,
  ]);
}

function normalizeDate(value: string | number | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function refreshTickerEvents(tickers: string[]): Promise<void> {
  for (const ticker of tickers.slice(0, 20)) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents,summaryDetail,defaultKeyStatistics,price`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; StockAnalyst/1.0)" },
          signal: AbortSignal.timeout(12000),
        }
      );
      if (!response.ok) continue;
      const data = await response.json();
      const result = data?.quoteSummary?.result?.[0];
      if (!result) continue;

      const earningsDate = normalizeDate(result?.calendarEvents?.earnings?.earningsDate?.[0]?.raw);
      const exDividendDate = normalizeDate(result?.summaryDetail?.exDividendDate?.raw);
      const splitDate = normalizeDate(result?.defaultKeyStatistics?.lastSplitDate?.raw);
      const splitFactor = result?.defaultKeyStatistics?.lastSplitFactor || null;

      if (earningsDate) {
        await insertEvent({
          event_type: "earnings",
          title: `${ticker} Earnings`,
          ticker,
          event_date: earningsDate,
          period_label: "next_earnings",
          impact: "high",
          source: "yahoo_finance",
          details_json: JSON.stringify(result?.calendarEvents?.earnings || {}),
        });
      }
      if (exDividendDate) {
        await insertEvent({
          event_type: "dividends",
          title: `${ticker} Ex-Dividend`,
          ticker,
          event_date: exDividendDate,
          period_label: "dividend",
          impact: "medium",
          source: "yahoo_finance",
          details_json: JSON.stringify({ exDividendDate }),
        });
      }
      if (splitDate && splitFactor) {
        await insertEvent({
          event_type: "stock_split",
          title: `${ticker} Split ${splitFactor}`,
          ticker,
          event_date: splitDate,
          period_label: "split",
          impact: "medium",
          source: "yahoo_finance",
          details_json: JSON.stringify({ splitFactor }),
        });
      }
    } catch {
      // Ignore per ticker.
    }
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StockAnalyst/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractScheduleDates(html: string): string[] {
  const matches = [...html.matchAll(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g)];
  return [...new Set(matches.map((match) => new Date(match[0]).toISOString()))];
}

async function refreshMacroEvents(): Promise<void> {
  try {
    const [cpiHtml, nfpHtml, fomcHtml] = await Promise.all([
      fetchText("https://www.bls.gov/schedule/news_release/cpi.htm"),
      fetchText("https://www.bls.gov/schedule/news_release/empsit.htm"),
      fetchText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
    ]);

    for (const date of extractScheduleDates(cpiHtml).slice(0, 4)) {
      await insertEvent({
        event_type: "CPI",
        title: "US CPI Release",
        event_date: date,
        impact: "high",
        source: "bls",
      });
    }
    for (const date of extractScheduleDates(nfpHtml).slice(0, 4)) {
      await insertEvent({
        event_type: "NFP",
        title: "US Nonfarm Payrolls",
        event_date: date,
        impact: "high",
        source: "bls",
      });
    }
    for (const date of extractScheduleDates(fomcHtml).slice(0, 8)) {
      await insertEvent({
        event_type: "FOMC",
        title: "FOMC Meeting",
        event_date: date,
        impact: "high",
        source: "federal_reserve",
      });
      await insertEvent({
        event_type: "FED",
        title: "Federal Reserve Event",
        event_date: date,
        impact: "high",
        source: "federal_reserve",
      });
    }
  } catch {
    // Keep cached DB data when refresh fails.
  }
}

async function refreshIpoEvents(): Promise<void> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY || (await getSettingValue("alphavantage_api_key"));
  if (!apiKey) return;

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=IPO_CALENDAR&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) return;
    const text = await response.text();
    const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
    for (const line of lines.slice(0, 20)) {
      const [symbol, name, ipoDate] = line.split(",");
      if (!symbol || !ipoDate) continue;
      await insertEvent({
        event_type: "IPO",
        title: `${symbol} IPO${name ? ` - ${name}` : ""}`,
        ticker: symbol,
        event_date: new Date(ipoDate).toISOString(),
        impact: "medium",
        source: "alphavantage",
      });
    }
  } catch {
    // optional source
  }
}

async function refreshEventsIfNeeded(): Promise<void> {
  const ttlHours = 6;
  const setting = await getSettingValue("market_events_refreshed_at");
  const lastRefresh = setting ? new Date(setting).getTime() : 0;
  if (lastRefresh && Date.now() - lastRefresh < ttlHours * 3600000) return;

  const tickers = await queryRows<{ ticker: string }>(`
    SELECT DISTINCT ticker FROM stocks
    UNION
    SELECT DISTINCT ticker FROM watchlist
    UNION
    SELECT DISTINCT ticker FROM portfolio
    ORDER BY ticker ASC
  `);

  await refreshTickerEvents(tickers.map((row) => row.ticker));
  await refreshMacroEvents();
  await refreshIpoEvents();

  await upsertSetting("market_events_refreshed_at", new Date().toISOString());
}

function bucketize(events: Array<Record<string, unknown>>) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(startToday.getTime() + 86400000);
  const week = new Date(startToday.getTime() + 7 * 86400000);
  const month = new Date(startToday.getTime() + 30 * 86400000);

  const parse = (value: unknown) => new Date(String(value));
  return {
    today: events.filter((event) => parse(event.event_date).toDateString() === startToday.toDateString()),
    tomorrow: events.filter((event) => parse(event.event_date).toDateString() === tomorrow.toDateString()),
    thisWeek: events.filter((event) => parse(event.event_date) >= startToday && parse(event.event_date) < week),
    next30Days: events.filter((event) => parse(event.event_date) >= startToday && parse(event.event_date) < month),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = await readJsonCache<MarketEventsCache>(MARKET_EVENTS_CACHE_KEY, MARKET_EVENTS_CACHE_TTL_MS);
  if (cached) {
    return NextResponse.json(cached);
  }

  await refreshEventsIfNeeded();
  await generateUpcomingEarningsAlerts();

  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const events = await queryRows(`
    SELECT * FROM market_events
    WHERE event_date >= ?
    ORDER BY event_date ASC, event_type ASC
    LIMIT 250
  `, [cutoffDate]);

  const payload: MarketEventsCache = {
    buckets: bucketize(events as Array<Record<string, unknown>>),
    events: events as Array<Record<string, unknown>>,
    refreshedAt: new Date().toISOString(),
  };
  await writeJsonCache(MARKET_EVENTS_CACHE_KEY, payload);
  return NextResponse.json(payload);
}
type MarketEventsCache = {
  refreshedAt: string;
  events: Array<Record<string, unknown>>;
  buckets: ReturnType<typeof bucketize>;
};

const MARKET_EVENTS_CACHE_KEY = "market_events_cache";
const MARKET_EVENTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
