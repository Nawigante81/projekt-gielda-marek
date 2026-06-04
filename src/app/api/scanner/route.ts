import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRow, queryRows } from "@/lib/postgres-access";

interface ScanResult {
  ticker: string;
  company_name: string | null;
  price: number;
  change_pct: number;
  reasons: string[];
  confirming_indicators: string[];
  risk_level: string;
  status: string;
  rsi: number | null;
  overall_signal: string | null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await queryRows<{ ticker: string; company_name: string }>("SELECT ticker, company_name FROM portfolio");
  const watchlist = await queryRows<{ ticker: string; company_name: string }>("SELECT ticker, company_name FROM watchlist");

  const allTickers = [
    ...portfolio.map(p => ({ ticker: p.ticker, company_name: p.company_name })),
    ...watchlist.map(w => ({ ticker: w.ticker, company_name: w.company_name })),
  ];

  const results: ScanResult[] = [];

  for (const item of allTickers) {
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

    if (!price || !tech) continue;

    const reasons: string[] = [];
    const confirmingIndicators: string[] = [];

    // Volume spike
    if (price.avg_volume && price.volume > price.avg_volume * 1.5) {
      reasons.push("Niezwykły wolumen (>150% średniej)");
      confirmingIndicators.push("Volume");
    }

    // RSI zone 30-50 with positive momentum
    if (tech.rsi_14 !== null && tech.rsi_14 >= 30 && tech.rsi_14 <= 50) {
      reasons.push(`RSI w strefie wsparcia (${tech.rsi_14.toFixed(1)})`);
      confirmingIndicators.push("RSI");
    }

    // RSI oversold
    if (tech.rsi_14 !== null && tech.rsi_14 < 30) {
      reasons.push(`RSI wyprzedanie (${tech.rsi_14.toFixed(1)})`);
      confirmingIndicators.push("RSI");
    }

    // MACD bullish signal
    if (tech.signal_macd === "bullish" && tech.macd_histogram !== null && tech.macd_histogram > 0) {
      reasons.push("Sygnał MACD bullish");
      confirmingIndicators.push("MACD");
    }

    // Price above SMA20 (breakout)
    if (tech.sma_20 && price.price > tech.sma_20 * 1.02) {
      reasons.push("Cena powyżej SMA20");
      confirmingIndicators.push("SMA");
    }

    // Bollinger band squeeze/breakout
    if (tech.bb_upper && price.price > tech.bb_upper) {
      reasons.push("Wybicie powyżej górnej wstęgi Bollingera");
      confirmingIndicators.push("Bollinger");
    }

    // Strong ADX trend
    if (tech.adx !== null && tech.adx > 25) {
      reasons.push(`Silny trend ADX (${tech.adx.toFixed(1)})`);
      confirmingIndicators.push("ADX");
    }

    // Large price move
    if (Math.abs(price.change_pct) > 3) {
      reasons.push(`Duży ruch dziennej ceny: ${price.change_pct > 0 ? "+" : ""}${price.change_pct.toFixed(2)}%`);
      confirmingIndicators.push("Momentum");
    }

    if (reasons.length === 0) continue;

    // Determine risk level and status
    let riskLevel = "medium";
    let status = "obserwuj";

    if (reasons.length >= 3 && tech.overall_signal?.includes("bullish")) {
      riskLevel = "low";
      status = "mocny_sygnal";
    } else if (
      (tech.rsi_14 !== null && tech.rsi_14 > 70) ||
      (tech.adx !== null && tech.adx > 35)
    ) {
      riskLevel = "high";
      status = "wysokie_ryzyko";
    }

    results.push({
      ticker,
      company_name: item.company_name || null,
      price: price.price,
      change_pct: price.change_pct,
      reasons,
      confirming_indicators: [...new Set(confirmingIndicators)],
      risk_level: riskLevel,
      status,
      rsi: tech.rsi_14,
      overall_signal: tech.overall_signal,
    });
  }

  // Sort by number of reasons (more = more interesting)
  results.sort((a, b) => b.reasons.length - a.reasons.length);

  return NextResponse.json(results);
}
