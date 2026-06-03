import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  const db = getDb();
  const query = ticker
    ? "SELECT * FROM news WHERE ticker = ? ORDER BY published_at DESC LIMIT 20"
    : "SELECT * FROM news ORDER BY published_at DESC LIMIT 50";

  const news = ticker
    ? db.prepare(query).all(ticker)
    : db.prepare(query).all();

  return NextResponse.json(news);
}
