import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");

  const db = getDb();
  const query = unreadOnly
    ? "SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?";

  const alerts = db.prepare(query).all(limit);
  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, markAll } = await req.json();
  const db = getDb();

  if (markAll) {
    db.prepare("UPDATE alerts SET is_read = 1").run();
  } else if (ids && Array.isArray(ids)) {
    const stmt = db.prepare("UPDATE alerts SET is_read = 1 WHERE id = ?");
    for (const id of ids) {
      stmt.run(id);
    }
  }

  return NextResponse.json({ success: true });
}
