import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRow, queryRows } from "@/lib/postgres-access";

export async function GET(_req: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  const currentPrice = await queryRow("SELECT * FROM current_prices WHERE ticker = ?", [ticker]);
  const technicals = await queryRow("SELECT * FROM technical_indicators WHERE ticker = ? ORDER BY calculated_at DESC, id DESC LIMIT 1", [ticker]);
  const history = await queryRows("SELECT * FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 200", [ticker]);
  const news = await queryRows("SELECT * FROM news WHERE ticker = ? ORDER BY published_at DESC LIMIT 10", [ticker]);
  const sentiment = await queryRows("SELECT * FROM sentiment WHERE ticker = ? ORDER BY created_at DESC LIMIT 10", [ticker]);
  const alerts = await queryRows("SELECT * FROM alerts WHERE ticker = ? ORDER BY created_at DESC LIMIT 20", [ticker]);
  const analysisHistory = await queryRows(`
    SELECT id, price, score, recommendation, sentiment, change_pct, volume, report_type, created_at
    FROM analysis_history
    WHERE ticker = ?
    ORDER BY created_at DESC
    LIMIT 30
  `, [ticker]);
  const performance = await queryRows(`
    SELECT pt.*, r.recommendation, r.score
    FROM performance_tracking pt
    LEFT JOIN recommendations r ON r.id = pt.recommendation_id
    WHERE pt.ticker = ?
    ORDER BY pt.created_at DESC
    LIMIT 10
  `, [ticker]);
  const reports = await queryRows(`
    SELECT id, report_type, created_at, 
      SUBSTR(content, 1, 500) as content_preview
    FROM ai_reports 
    WHERE content LIKE ?
    ORDER BY created_at DESC 
    LIMIT 5
  `, [`%${ticker}%`]);

  const portfolioItem = await queryRow("SELECT * FROM portfolio WHERE ticker = ?", [ticker]);
  const watchlistItem = await queryRow("SELECT * FROM watchlist WHERE ticker = ?", [ticker]);

  return NextResponse.json({
    ticker,
    currentPrice,
    technicals,
    history: (history as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>).reverse(),
    news,
    sentiment,
    alerts,
    analysisHistory,
    performance,
    reports,
    portfolioItem,
    watchlistItem,
  });
}
