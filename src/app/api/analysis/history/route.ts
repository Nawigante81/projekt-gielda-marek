import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "100", 10)));
  const db = getDb();

  const query = ticker
    ? `SELECT * FROM analysis_history WHERE ticker = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM analysis_history ORDER BY created_at DESC LIMIT ?`;

  const rows = ticker ? db.prepare(query).all(ticker, limit) : db.prepare(query).all(limit);
  return NextResponse.json(rows);
}