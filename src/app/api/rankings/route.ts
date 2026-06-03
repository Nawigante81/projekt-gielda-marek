import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

function getRankedRows(limit: number) {
  const db = getDb();
  return db.prepare(`
    SELECT cp.ticker,
      COALESCE(s.company_name, cp.company_name, cp.ticker) as company_name,
      cp.price,
      cp.change_pct,
      cp.market_cap,
      ti.ai_score,
      ti.recommendation,
      ti.rsi_14,
      ti.overall_signal,
      COALESCE(s.sector, cp.sector, 'Unknown') as sector
    FROM current_prices cp
    LEFT JOIN stocks s ON s.ticker = cp.ticker
    LEFT JOIN technical_indicators ti ON ti.id = (
      SELECT id FROM technical_indicators WHERE ticker = cp.ticker ORDER BY calculated_at DESC, id DESC LIMIT 1
    )
    WHERE cp.price IS NOT NULL AND ti.ai_score IS NOT NULL
    ORDER BY ti.ai_score DESC, cp.change_pct DESC
    LIMIT ?
  `).all(limit) as Array<{
    ticker: string;
    company_name: string;
    price: number;
    change_pct: number;
    market_cap: number | null;
    ai_score: number;
    recommendation: string;
    rsi_14: number | null;
    overall_signal: string | null;
    sector: string;
  }>;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 25);
  const rows = getRankedRows(Math.max(limit, 5));

  return NextResponse.json({
    topBuy: rows.filter((row) => ["Strong Buy", "Buy"].includes(row.recommendation)).slice(0, limit),
    topSell: [...rows].filter((row) => ["Strong Sell", "Sell"].includes(row.recommendation)).sort((a, b) => a.ai_score - b.ai_score).slice(0, limit),
    topMomentum: [...rows].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0)).slice(0, limit),
    topOversold: [...rows].filter((row) => row.rsi_14 !== null).sort((a, b) => (a.rsi_14 || 999) - (b.rsi_14 || 999)).slice(0, limit),
    topOverbought: [...rows].filter((row) => row.rsi_14 !== null).sort((a, b) => (b.rsi_14 || -999) - (a.rsi_14 || -999)).slice(0, limit),
  });
}