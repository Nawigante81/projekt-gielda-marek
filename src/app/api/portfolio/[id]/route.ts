import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { company_name, shares, purchase_price, purchase_date, notes } = body;

  const db = getDb();
  db.prepare(`
    UPDATE portfolio SET
      company_name = ?,
      shares = ?,
      purchase_price = ?,
      purchase_date = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(company_name, shares, purchase_price, purchase_date, notes, id);

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM portfolio WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
