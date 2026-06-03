import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logIntegrationActivity } from "@/lib/integration-activity";
import { getHistoryFromSource, getNewsFromSource, getQuoteFromSource, normalizeMarketDataSource, type MarketDataSource } from "@/lib/market-providers";
import { isValidSymbol, normalizeSymbol } from "@/lib/finnhub";

function getTenantIdFromSession(session: Awaited<ReturnType<typeof getSession>>): string | null {
  return session ? String(session.userId) : null;
}

function isKnownProvider(provider: string | undefined): provider is MarketDataSource {
  return provider === "finnhub" || provider === "twelvedata" || provider === "alphavantage" || provider === "yahoo";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params as Record<string, string>;
  if (!isKnownProvider(resolvedParams.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const provider = normalizeMarketDataSource(resolvedParams.provider);
  const symbol = normalizeSymbol(resolvedParams.symbol || "");

  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource") || "quote";
  const days = Number.parseInt(searchParams.get("days") || "30", 10);

  if (resource !== "quote" && resource !== "news" && resource !== "history") {
    return NextResponse.json({ error: "Unsupported resource" }, { status: 400 });
  }

  try {
    if (resource === "news") {
      const news = await getNewsFromSource(provider, symbol);
      logIntegrationActivity({
        integration: provider,
        action: "news_fetch",
        symbol,
        userId: session.userId,
        tenantId: getTenantIdFromSession(session),
        status: "success",
        details: { count: news.length },
      });
      return NextResponse.json({ provider, symbol, resource: "news", data: news });
    }

    if (resource === "history") {
      const history = await getHistoryFromSource(provider, symbol, Number.isFinite(days) ? days : 30);
      logIntegrationActivity({
        integration: provider,
        action: "history_fetch",
        symbol,
        userId: session.userId,
        tenantId: getTenantIdFromSession(session),
        status: "success",
        details: { count: history.length, days: Number.isFinite(days) ? days : 30 },
      });
      return NextResponse.json({ provider, symbol, resource: "history", data: history });
    }

    const quote = await getQuoteFromSource(provider, symbol);
    if (!quote) {
      return NextResponse.json({ error: "No quote data returned" }, { status: 404 });
    }

    logIntegrationActivity({
      integration: provider,
      action: "quote_fetch",
      symbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "success",
      details: { price: quote.price, changePct: quote.change_pct },
    });
    return NextResponse.json({ provider, symbol, resource: "quote", data: quote });
  } catch (error) {
    logIntegrationActivity({
      integration: provider,
      action: `${resource}_fetch`,
      symbol,
      userId: session.userId,
      tenantId: getTenantIdFromSession(session),
      status: "error",
      details: { message: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.json({ error: "Market provider request failed" }, { status: 502 });
  }
}
