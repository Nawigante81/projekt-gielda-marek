import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDatabaseProvider, isPostgresEnabled } from "@/lib/database-config";
import { pingPostgres } from "@/lib/postgres";

export async function GET() {
  try {
    const provider = getDatabaseProvider();
    if (isPostgresEnabled()) {
      await pingPostgres();
      return NextResponse.json({ status: "ok", database: "postgres", timestamp: new Date().toISOString() });
    }

    const db = getDb();
    db.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok", database: provider, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: "error", error: String(err) }, { status: 500 });
  }
}
