import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRow, queryRows, runSql } from "@/lib/postgres-access";

type OpportunityType = "observed" | "opportunity" | "high_volume" | "after_earnings" | "unusual_move";

interface ScanResult {
  ticker: string;
  company_name: string | null;
  price: number;
  change_pct: number;
  reasons: string[];
  confirming_indicators: string[];
  risk_level: string;
  status: string;
  opportunity_type: OpportunityType;
  is_watchlisted: boolean;
  rsi: number | null;
  overall_signal: string | null;
}

interface ScanCandidate {
  ticker: string;
  company_name: string | null;
  is_watchlisted: boolean;
}

function validateTicker(ticker: string): boolean {
  return /^[A-Z0-9.\-\^]{1,10}$/.test(ticker.toUpperCase());
}

function classifyOpportunityType(args: {
  hasVolumeSpike: boolean;
  hasLargeMove: boolean;
  isStrongSignal: boolean;
}): OpportunityType {
  if (args.hasVolumeSpike) return "high_volume";
  if (args.hasLargeMove) return "unusual_move";
  if (args.isStrongSignal) return "opportunity";
  return "observed";
}

async function scanTicker(item: ScanCandidate): Promise<ScanResult | null> {
  const ticker = item.ticker;
  const price = await queryRow<{
    price: number;
    change_pct: number;
    volume: number;
    avg_volume: number | null;
  }>("SELECT * FROM current_prices WHERE ticker = ?", [ticker]);
  const tech = await queryRow<{
    rsi_14: number | null;
    macd_histogram: number | null;
    adx: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    sma_20: number | null;
    ema_12: number | null;
    ema_26: number | null;
    overall_signal: string | null;
    signal_macd: string | null;
    signal_rsi: string | null;
    signal_adx: string | null;
  }>("SELECT * FROM technical_indicators WHERE ticker = ? ORDER BY calculated_at DESC LIMIT 1", [ticker]);

  if (!price || !tech) return null;

  const reasons: string[] = [];
  const confirmingIndicators: string[] = [];
  const hasVolumeSpike = Boolean(price.avg_volume && price.volume > price.avg_volume * 1.5);
  const hasLargeMove = Math.abs(price.change_pct) > 3;

  if (hasVolumeSpike) {
    reasons.push("Niezwykły wolumen (>150% średniej)");
    confirmingIndicators.push("Volume");
  }

  if (tech.rsi_14 !== null && tech.rsi_14 >= 30 && tech.rsi_14 <= 50) {
    reasons.push(`RSI w strefie wsparcia (${tech.rsi_14.toFixed(1)})`);
    confirmingIndicators.push("RSI");
  }

  if (tech.rsi_14 !== null && tech.rsi_14 < 30) {
    reasons.push(`RSI wyprzedanie (${tech.rsi_14.toFixed(1)})`);
    confirmingIndicators.push("RSI");
  }

  if (tech.signal_macd === "bullish" && tech.macd_histogram !== null && tech.macd_histogram > 0) {
    reasons.push("Sygnał MACD bullish");
    confirmingIndicators.push("MACD");
  }

  if (tech.sma_20 && price.price > tech.sma_20 * 1.02) {
    reasons.push("Cena powyżej SMA20");
    confirmingIndicators.push("SMA");
  }

  if (tech.bb_upper && price.price > tech.bb_upper) {
    reasons.push("Wybicie powyżej górnej wstęgi Bollingera");
    confirmingIndicators.push("Bollinger");
  }

  if (tech.adx !== null && tech.adx > 25) {
    reasons.push(`Silny trend ADX (${tech.adx.toFixed(1)})`);
    confirmingIndicators.push("ADX");
  }

  if (hasLargeMove) {
    reasons.push(`Duży ruch dziennej ceny: ${price.change_pct > 0 ? "+" : ""}${price.change_pct.toFixed(2)}%`);
    confirmingIndicators.push("Momentum");
  }

  if (reasons.length === 0) return null;

  let riskLevel = "medium";
  let status = "obserwuj";
  const isStrongSignal = reasons.length >= 3 && Boolean(tech.overall_signal?.includes("bullish"));

  if (isStrongSignal) {
    riskLevel = "low";
    status = "mocny_sygnal";
  } else if (
    (tech.rsi_14 !== null && tech.rsi_14 > 70) ||
    (tech.adx !== null && tech.adx > 35)
  ) {
    riskLevel = "high";
    status = "wysokie_ryzyko";
  }

  return {
    ticker,
    company_name: item.company_name || null,
    price: price.price,
    change_pct: price.change_pct,
    reasons,
    confirming_indicators: [...new Set(confirmingIndicators)],
    risk_level: riskLevel,
    status,
    opportunity_type: classifyOpportunityType({ hasVolumeSpike, hasLargeMove, isStrongSignal }),
    is_watchlisted: item.is_watchlisted,
    rsi: tech.rsi_14,
    overall_signal: tech.overall_signal,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await queryRows<{ ticker: string; company_name: string }>("SELECT ticker, company_name FROM portfolio");
  const watchlist = await queryRows<{ ticker: string; company_name: string }>("SELECT ticker, company_name FROM watchlist");
  const watchlistedTickers = new Set(watchlist.map((item) => item.ticker));

  const allTickers: ScanCandidate[] = [
    ...portfolio.map(p => ({ ticker: p.ticker, company_name: p.company_name, is_watchlisted: watchlistedTickers.has(p.ticker) })),
    ...watchlist.map(w => ({ ticker: w.ticker, company_name: w.company_name, is_watchlisted: true })),
  ];

  const results: ScanResult[] = [];
  const seenTickers = new Set<string>();

  for (const item of allTickers) {
    if (seenTickers.has(item.ticker)) continue;
    seenTickers.add(item.ticker);
    const result = await scanTicker(item);
    if (result) results.push(result);
  }

  // Sort by number of reasons (more = more interesting)
  results.sort((a, b) => b.reasons.length - a.reasons.length);

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ticker = String(body.ticker || "").toUpperCase();
  if (!ticker || !validateTicker(ticker)) {
    return NextResponse.json({ error: "Nieprawidłowy ticker" }, { status: 400 });
  }

  const source = await queryRow<{ ticker: string; company_name: string | null }>(
    `SELECT ticker, company_name FROM watchlist WHERE ticker = ?
     UNION
     SELECT ticker, company_name FROM portfolio WHERE ticker = ?
     LIMIT 1`,
    [ticker, ticker]
  );

  if (!source) {
    return NextResponse.json({ error: "Ticker nie istnieje w portfolio ani na watchliście" }, { status: 404 });
  }

  const existingWatchlist = await queryRow<{ id: number }>("SELECT id FROM watchlist WHERE ticker = ? LIMIT 1", [ticker]);
  const scanResult = await scanTicker({
    ticker,
    company_name: source.company_name,
    is_watchlisted: Boolean(existingWatchlist),
  });

  if (!scanResult) {
    return NextResponse.json({ error: "Brak aktualnego sygnału skanera dla tego tickera" }, { status: 400 });
  }

  const scannerNote = `Skaner: ${scanResult.reasons.join("; ")}`;
  if (existingWatchlist) {
    await runSql(
      `UPDATE watchlist
       SET opportunity_type = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [scanResult.opportunity_type, scannerNote, existingWatchlist.id]
    );
  } else {
    await runSql(
      `INSERT INTO watchlist (ticker, company_name, notes, group_name, auto_analyze, opportunity_type, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ticker, source.company_name || "", scannerNote, "SCANNER", 1, scanResult.opportunity_type]
    );
  }

  return NextResponse.json({ success: true, item: scanResult });
}
