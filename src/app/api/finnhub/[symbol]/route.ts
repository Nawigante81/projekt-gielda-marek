import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchFinnhubNews, fetchFinnhubQuote, isValidSymbol, normalizeSymbol } from "@/lib/finnhub";
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
  const days = Number.parseInt(searchParams.get("days") || "7", 10);

  try {
    if (resource === "news") {
      const news = await fetchFinnhubNews(normalizedSymbol, Number.isFinite(days) ? days : 7);
      await logIntegrationActivity({
        integration: "finnhub",
        action: "news_fetch",
        symbol: normalizedSymbol,
        userId: session.userId,
        tenantId: getTenantIdFromSession(session),
        status: "success",
        details: { count: news.length },
      });
      return NextResponse.json({ symbol: normalizedSymbol, resource: "news", data: news });
    }

    const quote = await fetchFinnhubQuote(normalizedSymbol);
    await logIntegrationActivity({
      integration: "finnhub",
      action: "quote_fetch",
      symbol: normalizedSymbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "success",
      details: { price: quote.c, changePct: quote.dp },
    });
    return NextResponse.json({ symbol: normalizedSymbol, resource: "quote", data: quote });
  } catch (error) {
    await logIntegrationActivity({
      integration: "finnhub",
      action: `${resource}_fetch`,
      symbol: normalizedSymbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "error",
      details: { message: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.json(
      { error: "Finnhub request failed" },
      { status: 502 }
    );
  }
}
