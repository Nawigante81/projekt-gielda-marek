import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows, runSql } from "@/lib/postgres-access";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const errors = await queryRows(`
    SELECT * FROM fetch_errors 
    ORDER BY created_at DESC 
    LIMIT 100
  `);

  return NextResponse.json(errors);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await runSql("DELETE FROM fetch_errors");
  return NextResponse.json({ success: true });
}
