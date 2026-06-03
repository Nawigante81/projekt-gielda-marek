import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { notes, group_name, watchlist_id, auto_analyze } = await req.json();
  const db = getDb();

  db.prepare(`
    UPDATE watchlist
    SET notes = COALESCE(?, notes),
        group_name = COALESCE(?, group_name),
        watchlist_id = COALESCE(?, watchlist_id),
        auto_analyze = COALESCE(?, auto_analyze),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    notes ?? null,
    group_name ?? null,
    watchlist_id ?? null,
    typeof auto_analyze === "boolean" ? (auto_analyze ? 1 : 0) : null,
    id
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM watchlist WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
