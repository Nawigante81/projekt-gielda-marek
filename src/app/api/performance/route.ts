import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(success_rate) as success_rate,
      AVG(average_return) as average_return,
      SUM(CASE WHEN accuracy_label = 'accurate' THEN 1 ELSE 0 END) as accurate_count,
      SUM(CASE WHEN accuracy_label = 'miss' THEN 1 ELSE 0 END) as miss_count
    FROM performance_tracking
  `).get() as {
    total: number;
    success_rate: number | null;
    average_return: number | null;
    accurate_count: number;
    miss_count: number;
  };

  const topHits = db.prepare(`
    SELECT pt.*, r.recommendation, r.score
    FROM performance_tracking pt
    LEFT JOIN recommendations r ON r.id = pt.recommendation_id
    WHERE pt.average_return IS NOT NULL
    ORDER BY pt.average_return DESC
    LIMIT 10
  `).all();

  const topMisses = db.prepare(`
    SELECT pt.*, r.recommendation, r.score
    FROM performance_tracking pt
    LEFT JOIN recommendations r ON r.id = pt.recommendation_id
    WHERE pt.average_return IS NOT NULL
    ORDER BY pt.average_return ASC
    LIMIT 10
  `).all();

  return NextResponse.json({
    summary: {
      total: summary.total || 0,
      successRate: summary.success_rate || 0,
      averageReturn: summary.average_return || 0,
      accurateCount: summary.accurate_count || 0,
      missCount: summary.miss_count || 0,
    },
    topHits,
    topMisses,
  });
}