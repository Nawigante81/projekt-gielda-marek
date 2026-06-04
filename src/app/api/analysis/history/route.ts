import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/postgres-access";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "100", 10)));

  const query = ticker
    ? `SELECT * FROM analysis_history WHERE ticker = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM analysis_history ORDER BY created_at DESC LIMIT ?`;

  const rows = ticker
    ? await queryRows(query, [ticker, limit])
    : await queryRows(query, [limit]);
  return NextResponse.json(rows);
}
