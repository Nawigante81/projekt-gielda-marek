import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 250);
  const db = getDb();

  const rows = ticker
    ? db.prepare(`
        SELECT * FROM analysis_history WHERE ticker = ? ORDER BY created_at DESC LIMIT ?
      `).all(ticker.toUpperCase(), limit)
    : db.prepare(`
        SELECT * FROM analysis_history ORDER BY created_at DESC LIMIT ?
      `).all(limit);

  return NextResponse.json(rows);
}