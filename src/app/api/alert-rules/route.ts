import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, runSql } from "@/lib/postgres-access";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await queryRows("SELECT * FROM alert_rules ORDER BY name ASC");
  return NextResponse.json(rules);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rule_key, is_enabled, threshold_value } = await req.json();
  if (!rule_key) {
    return NextResponse.json({ error: "Brak rule_key" }, { status: 400 });
  }

  await runSql(`
    UPDATE alert_rules
    SET is_enabled = COALESCE(?, is_enabled),
        threshold_value = COALESCE(?, threshold_value),
        updated_at = NOW()
    WHERE rule_key = ?
  `, [typeof is_enabled === "boolean" ? (is_enabled ? 1 : 0) : null, threshold_value ?? null, rule_key]);

  return NextResponse.json({ success: true });
}
