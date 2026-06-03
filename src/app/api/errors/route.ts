import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const errors = db.prepare(`
    SELECT * FROM fetch_errors 
    ORDER BY created_at DESC 
    LIMIT 100
  `).all();

  return NextResponse.json(errors);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  db.prepare("DELETE FROM fetch_errors").run();
  return NextResponse.json({ success: true });
}
