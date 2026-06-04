import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, runSql } from "@/lib/postgres-access";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await queryRows(`
    SELECT wl.*, COUNT(w.id) as ticker_count
    FROM watchlists wl
    LEFT JOIN watchlist w ON w.watchlist_id = wl.id
    GROUP BY wl.id
    ORDER BY wl.is_default DESC, wl.name ASC
  `);

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
  const result = await runSql(`
    INSERT INTO watchlists (name, slug, description, color, auto_analyze, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `, [name.trim(), slug, description || "", color || "#3b82f6", auto_analyze === false ? 0 : 1]);

  return NextResponse.json({ success: true, id: result.lastInsertId ?? null });
}
