import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateSecFilingAlerts, getSecFilings, refreshSecFilings } from "@/lib/sec";

function validateTicker(ticker: string): boolean {
  return /^[A-Z0-9.\-\^]{1,10}$/.test(ticker.toUpperCase());
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  if (ticker && !validateTicker(ticker)) {
    return NextResponse.json({ error: "Nieprawidłowy ticker" }, { status: 400 });
  }

  const filings = await getSecFilings(ticker || undefined);
  return NextResponse.json(filings);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ticker = String(body.ticker || "").toUpperCase();

  if (!ticker || !validateTicker(ticker)) {
    return NextResponse.json({ error: "Nieprawidłowy ticker" }, { status: 400 });
  }

  try {
    const filings = await refreshSecFilings(ticker);
    const alertCount = await generateSecFilingAlerts(ticker);
    return NextResponse.json({ success: true, ticker, filings, alertCount });
  } catch (error) {
    console.error("SEC filings refresh error:", error);
    return NextResponse.json(
      { error: "Nie udało się pobrać raportów SEC dla tego tickera" },
      { status: 502 }
    );
  }
}
