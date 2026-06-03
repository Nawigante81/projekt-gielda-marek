import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const groups = db.prepare(`
    SELECT wl.*, COUNT(w.id) as ticker_count
    FROM watchlists wl
    LEFT JOIN watchlist w ON w.watchlist_id = wl.id
    GROUP BY wl.id
    ORDER BY wl.is_default DESC, wl.name ASC
  `).all();

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, color, auto_analyze } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Nazwa grupy jest wymagana" }, { status: 400 });
  }

  const slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO watchlists (name, slug, description, color, auto_analyze, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(name.trim(), slug, description || "", color || "#3b82f6", auto_analyze === false ? 0 : 1) as { lastInsertRowid: number };

  return NextResponse.json({ success: true, id: result.lastInsertRowid });
}