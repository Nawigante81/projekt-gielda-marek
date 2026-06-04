import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runSql } from "@/lib/postgres-access";

const VALID_CURRENCIES = new Set(["USD", "EUR", "PLN", "GBP"]);
const VALID_STATUSES = new Set(["observed", "owned", "sold"]);

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { company_name, purchase_date, notes } = body;
  const shares = toNumber(body.shares);
  const purchasePrice = toNumber(body.purchase_price);
  const alertThreshold = toNumber(body.alert_threshold);
  const currency = String(body.currency || "USD").toUpperCase();
  const status = String(body.status || "owned");

  if (!shares || shares <= 0) {
    return NextResponse.json({ error: "Nieprawidłowa ilość akcji" }, { status: 400 });
  }
  if (!purchasePrice || purchasePrice <= 0) {
    return NextResponse.json({ error: "Nieprawidłowa cena zakupu" }, { status: 400 });
  }
  if (!VALID_CURRENCIES.has(currency)) {
    return NextResponse.json({ error: "Nieprawidłowa waluta" }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Nieprawidłowy status pozycji" }, { status: 400 });
  }
  if (alertThreshold !== null && alertThreshold <= 0) {
    return NextResponse.json({ error: "Próg alertu musi być większy od zera" }, { status: 400 });
  }

  await runSql(`
    UPDATE portfolio SET
      company_name = ?,
      shares = ?,
      purchase_price = ?,
      purchase_date = ?,
      currency = ?,
      alert_threshold = ?,
      status = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [company_name || "", shares, purchasePrice, purchase_date || null, currency, alertThreshold, status, notes || "", id]);

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await runSql("DELETE FROM portfolio WHERE id = ?", [id]);
  return NextResponse.json({ success: true });
}
