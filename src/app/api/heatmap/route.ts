import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { MARKET_UNIVERSE } from "@/lib/market-universe";
import { queryRow } from "@/lib/postgres-access";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const index = (searchParams.get("index") || "SP500").toUpperCase();

  const tiles = await Promise.all(MARKET_UNIVERSE.filter((entry) => entry.indices.includes(index as "SP500" | "NASDAQ" | "DOW"))
    .map(async (entry) => {
      const price = await queryRow<{ price: number | null; change_pct: number | null }>(`
        SELECT price, change_pct FROM current_prices WHERE ticker = ?
      `, [entry.ticker]);
      const tech = await queryRow<{ ai_score: number | null; recommendation: string | null }>(`
        SELECT ai_score, recommendation FROM technical_indicators WHERE ticker = ? ORDER BY calculated_at DESC, id DESC LIMIT 1
      `, [entry.ticker]);
      return {
        ticker: entry.ticker,
        company_name: entry.company_name,
        sector: entry.sector,
        market_cap: entry.market_cap,
        price: price?.price || null,
        change_pct: price?.change_pct || 0,
        ai_score: tech?.ai_score || 0,
        recommendation: tech?.recommendation || "Hold",
      };
    }));

  const visibleTiles = tiles
    .filter((tile) => tile.price !== null)
    .sort((a, b) => b.market_cap - a.market_cap);

  return NextResponse.json({ index, tiles: visibleTiles });
}
