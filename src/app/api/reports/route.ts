import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const reports = db.prepare(`
    SELECT id, report_type, trigger_time, content, market_sentiment, created_at
    FROM ai_reports
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  return NextResponse.json(reports);
}
