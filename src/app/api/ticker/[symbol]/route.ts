import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const ticker = symbol.toUpperCase();
  const db = getDb();

  const currentPrice = db.prepare("SELECT * FROM current_prices WHERE ticker = ?").get(ticker);
  const technicals = db.prepare("SELECT * FROM technical_indicators WHERE ticker = ? ORDER BY calculated_at DESC, id DESC LIMIT 1").get(ticker);
  const history = db.prepare("SELECT * FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 200").all(ticker);
  const news = db.prepare("SELECT * FROM news WHERE ticker = ? ORDER BY published_at DESC LIMIT 10").all(ticker);
  const sentiment = db.prepare("SELECT * FROM sentiment WHERE ticker = ? ORDER BY created_at DESC LIMIT 10").all(ticker);
  const alerts = db.prepare("SELECT * FROM alerts WHERE ticker = ? ORDER BY created_at DESC LIMIT 20").all(ticker);
  const analysisHistory = db.prepare(`
    SELECT id, price, score, recommendation, sentiment, change_pct, volume, report_type, created_at
    FROM analysis_history
    WHERE ticker = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(ticker);
  const performance = db.prepare(`
    SELECT pt.*, r.recommendation, r.score
    FROM performance_tracking pt
    LEFT JOIN recommendations r ON r.id = pt.recommendation_id
    WHERE pt.ticker = ?
    ORDER BY pt.created_at DESC
    LIMIT 10
  `).all(ticker);
  const reports = db.prepare(`
    SELECT id, report_type, created_at, 
      SUBSTR(content, 1, 500) as content_preview
    FROM ai_reports 
    WHERE content LIKE ?
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(`%${ticker}%`);

  const portfolioItem = db.prepare("SELECT * FROM portfolio WHERE ticker = ?").get(ticker);
  const watchlistItem = db.prepare("SELECT * FROM watchlist WHERE ticker = ?").get(ticker);

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
