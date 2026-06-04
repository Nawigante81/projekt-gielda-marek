import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, runSql } from "@/lib/postgres-access";

function validateTicker(ticker: string): boolean {
  return /^[A-Z0-9.\-\^]{1,10}$/.test(ticker.toUpperCase());
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await queryRows(`
    SELECT p.*, 
      cp.price as current_price,
      cp.change_pct,
      cp.change_abs,
      cp.volume,
      cp.avg_volume,
      cp.last_updated,
      cp.source,
      ti.overall_signal,
      ti.overall_score,
      ti.ai_score,
      ti.recommendation,
      ti.rsi_14,
      ti.macd_histogram,
      ti.macd_line,
      ti.adx,
      ti.sma_20,
      ti.sma_50,
      ti.sma_200,
      ti.bb_upper,
      ti.bb_lower,
      ti.stoch_k,
      ti.signal_sma,
      ti.signal_ema,
      ti.signal_macd,
      ti.signal_rsi,
      ti.signal_bb,
      ti.signal_stoch,
      ti.signal_adx,
      ti.signal_ichimoku,
      ti.signal_fib,
      ti.calculated_at,
      s.score as news_sentiment_score,
      s.label as news_sentiment_label
    FROM portfolio p
    LEFT JOIN current_prices cp ON p.ticker = cp.ticker
    LEFT JOIN technical_indicators ti ON ti.id = (
      SELECT id FROM technical_indicators WHERE ticker = p.ticker ORDER BY calculated_at DESC, id DESC LIMIT 1
    )
    LEFT JOIN sentiment s ON s.id = (
      SELECT id FROM sentiment WHERE ticker = p.ticker ORDER BY created_at DESC, id DESC LIMIT 1
    )
    ORDER BY p.created_at ASC
  `);

  return NextResponse.json(portfolio);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, company_name, shares, purchase_price, purchase_date, notes } = body;

  if (!ticker || !validateTicker(ticker)) {
    return NextResponse.json({ error: "Nieprawidłowy ticker" }, { status: 400 });
  }
  if (!shares || shares <= 0) {
    return NextResponse.json({ error: "Nieprawidłowa ilość akcji" }, { status: 400 });
  }
  if (!purchase_price || purchase_price <= 0) {
    return NextResponse.json({ error: "Nieprawidłowa cena zakupu" }, { status: 400 });
  }

  const result = await runSql(`
    INSERT INTO portfolio (ticker, company_name, shares, purchase_price, purchase_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ${process.env.DATABASE_PROVIDER === "postgres" ? "RETURNING id" : ""}
  `, [
    ticker.toUpperCase(),
    company_name || "",
    shares,
    purchase_price,
    purchase_date || new Date().toISOString().split("T")[0],
    notes || ""
  ]);

  return NextResponse.json({ id: result.lastInsertId ?? null, success: true });
}
