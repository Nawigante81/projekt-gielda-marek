import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchTwelveDataQuote, isValidSymbol, normalizeSymbol } from "@/lib/finnhub";
import { logIntegrationActivity } from "@/lib/integration-activity";

function getTenantIdFromSession(session: Awaited<ReturnType<typeof getSession>>): string | null {
  return session ? String(session.userId) : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!isValidSymbol(normalizedSymbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource") || "quote";

  if (resource !== "quote") {
    return NextResponse.json({ error: "Unsupported resource" }, { status: 400 });
  }

  try {
    const quote = await fetchTwelveDataQuote(normalizedSymbol);
    if (!quote) {
      throw new Error("No quote data returned");
    }

    await logIntegrationActivity({
      integration: "twelvedata",
      action: "quote_fetch",
      symbol: normalizedSymbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "success",
      details: { price: quote.price, changePct: quote.change_pct },
    });

    return NextResponse.json({ symbol: normalizedSymbol, resource: "quote", data: quote });
  } catch (error) {
    await logIntegrationActivity({
      integration: "twelvedata",
      action: "quote_fetch",
      symbol: normalizedSymbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "error",
      details: { message: error instanceof Error ? error.message : "Unknown error" },
    });

    return NextResponse.json(
      { error: "Twelve Data request failed" },
      { status: 502 }
    );
  }
}
