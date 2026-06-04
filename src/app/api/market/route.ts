import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/postgres-access";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const indices = await queryRows("SELECT * FROM market_indices ORDER BY id");
  return NextResponse.json(indices);
}
