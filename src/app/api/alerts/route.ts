import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, runSql } from "@/lib/postgres-access";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");

  const query = unreadOnly
    ? "SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?";

  const alerts = await queryRows(query, [limit]);
  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, markAll } = await req.json();
  if (markAll) {
    await runSql("UPDATE alerts SET is_read = 1");
  } else if (ids && Array.isArray(ids)) {
    for (const id of ids) {
      await runSql("UPDATE alerts SET is_read = 1 WHERE id = ?", [id]);
    }
  }

  return NextResponse.json({ success: true });
}
