import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/postgres-access";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  const query = ticker
    ? "SELECT * FROM news WHERE ticker = ? ORDER BY published_at DESC LIMIT 20"
    : "SELECT * FROM news ORDER BY published_at DESC LIMIT 50";

  const news = ticker
    ? await queryRows(query, [ticker])
    : await queryRows(query);

  return NextResponse.json(news);
}
