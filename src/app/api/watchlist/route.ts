import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, queryRow, runSql } from "@/lib/postgres-access";

function validateTicker(ticker: string): boolean {
  return /^[A-Z0-9.\-\^]{1,10}$/.test(ticker.toUpperCase());
}

const VALID_OPPORTUNITY_TYPES = new Set([
  "observed",
  "opportunity",
  "high_volume",
  "after_earnings",
  "unusual_move",
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const watchlist = await queryRows(`
    SELECT w.*,
      wl.name as watchlist_name,
      wl.color as watchlist_color,
      cp.price as current_price,
      cp.change_pct,
      cp.change_abs,
      cp.volume,
      cp.avg_volume,
      cp.last_updated,
      ti.overall_signal,
      ti.overall_score,
      ti.ai_score,
      ti.recommendation,
      ti.rsi_14,
      ti.signal_macd,
      ti.signal_sma,
      ti.signal_ema,
      ti.signal_rsi,
      ti.signal_bb,
      ti.signal_stoch,
      ti.signal_adx,
      ti.signal_ichimoku,
      ti.signal_fib,
      ti.adx,
      ti.macd_line,
      ti.macd_histogram,
      ti.sma_20,
      ti.sma_50,
      ti.sma_200,
      ti.bb_upper,
      ti.bb_lower,
      ti.stoch_k,
      ti.calculated_at,
      s.score as news_sentiment_score,
      s.label as news_sentiment_label,
      (CASE
        WHEN cp.avg_volume IS NOT NULL AND cp.avg_volume > 0 AND cp.volume IS NOT NULL
        THEN cp.volume * 1.0 / cp.avg_volume
        ELSE NULL
      END) as unusual_volume_ratio,
      (SELECT event_date FROM market_events WHERE ticker = w.ticker AND event_type = 'earnings' AND event_date::timestamptz >= NOW() - INTERVAL '1 day' ORDER BY event_date ASC LIMIT 1) as earnings_date,
      (SELECT form || ' ' || filing_date FROM sec_filings WHERE ticker = w.ticker AND form IN ('8-K', '10-Q', '10-K', '4') ORDER BY filing_date DESC, id DESC LIMIT 1) as sec_event,
      (SELECT headline FROM news WHERE ticker = w.ticker ORDER BY published_at DESC LIMIT 1) as latest_news,
      (SELECT message FROM alerts WHERE ticker = w.ticker ORDER BY created_at DESC LIMIT 1) as latest_alert
    FROM watchlist w
    LEFT JOIN watchlists wl ON w.watchlist_id = wl.id
    LEFT JOIN current_prices cp ON w.ticker = cp.ticker
    LEFT JOIN technical_indicators ti ON ti.id = (
      SELECT id FROM technical_indicators WHERE ticker = w.ticker ORDER BY calculated_at DESC, id DESC LIMIT 1
    )
    LEFT JOIN sentiment s ON s.id = (
      SELECT id FROM sentiment WHERE ticker = w.ticker ORDER BY created_at DESC, id DESC LIMIT 1
    )
    ORDER BY w.created_at ASC
  `);

  return NextResponse.json(watchlist);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, company_name, notes, group_name, watchlist_id, auto_analyze } = body;
  const opportunityType = String(body.opportunity_type || "observed");

  if (!ticker || !validateTicker(ticker)) {
    return NextResponse.json({ error: "Nieprawidłowy ticker" }, { status: 400 });
  }
  if (!VALID_OPPORTUNITY_TYPES.has(opportunityType)) {
    return NextResponse.json({ error: "Nieprawidłowy typ obserwacji" }, { status: 400 });
  }

  try {
    let resolvedWatchlistId = watchlist_id || null;
    if (!resolvedWatchlistId && group_name) {
      const watchlistRow = await queryRow<{ id: number }>("SELECT id FROM watchlists WHERE upper(name) = upper(?) LIMIT 1", [group_name]);
      resolvedWatchlistId = watchlistRow?.id || null;
    }

    const result = await runSql(`
      INSERT INTO watchlist (ticker, company_name, notes, group_name, watchlist_id, auto_analyze, opportunity_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      ticker.toUpperCase(),
      company_name || "",
      notes || "",
      (group_name || "TECH").toUpperCase(),
      resolvedWatchlistId,
      auto_analyze === false ? 0 : 1,
      opportunityType
    ]);
    return NextResponse.json({ id: result.lastInsertId ?? null, success: true });
  } catch {
    return NextResponse.json({ error: "Ticker już istnieje na watchliście" }, { status: 409 });
  }
}
