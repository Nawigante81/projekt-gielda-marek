import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MARKET_UNIVERSE } from "@/lib/market-universe";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const latestDateRow = db.prepare("SELECT MAX(analysis_date) as analysis_date FROM sector_analysis").get() as { analysis_date: string | null };

  let rows = latestDateRow?.analysis_date
    ? db.prepare("SELECT * FROM sector_analysis WHERE analysis_date = ? ORDER BY avg_change_pct DESC").all(latestDateRow.analysis_date)
    : [];

  if (rows.length === 0) {
    const grouped = new Map<string, typeof MARKET_UNIVERSE>();
    for (const entry of MARKET_UNIVERSE) {
      const current = grouped.get(entry.sector) || [];
      current.push(entry);
      grouped.set(entry.sector, current);
    }

    rows = [...grouped.entries()].map(([sector, items]) => ({
      sector,
      analysis_date: new Date().toISOString().slice(0, 10),
      avg_change_pct: 0,
      sentiment_score: 0,
      sentiment_label: "neutral",
      best_ticker: items[0]?.ticker || null,
      best_change_pct: 0,
      worst_ticker: items[items.length - 1]?.ticker || null,
      worst_change_pct: 0,
      constituents_json: JSON.stringify(items),
    }));
  }

  return NextResponse.json(rows);
}