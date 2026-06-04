import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRow, runSql } from "@/lib/postgres-access";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { company_name, shares, purchase_price, purchase_date, notes } = body;

  await runSql(`
    UPDATE portfolio SET
      company_name = ?,
      shares = ?,
      purchase_price = ?,
      purchase_date = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [company_name, shares, purchase_price, purchase_date, notes, id]);

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await runSql("DELETE FROM portfolio WHERE id = ?", [id]);
  return NextResponse.json({ success: true });
}
