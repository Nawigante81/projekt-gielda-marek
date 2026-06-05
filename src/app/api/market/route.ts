import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryRows } from "@/lib/postgres-access";
import { getMarketInstrumentMeta, validateMarketInstrumentValue } from "@/lib/market-instruments";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const indices = await queryRows<{
    id: number;
    symbol: string;
    name: string;
    value: number | null;
    change_pct: number | null;
    change_abs: number | null;
    trend: string;
    market_status: string;
    last_updated: string;
    provider_source: string | null;
  }>(`
    SELECT mi.*, cp.source as provider_source
    FROM market_indices mi
    LEFT JOIN current_prices cp ON cp.ticker = mi.symbol
    ORDER BY mi.id
  `);

  const enriched = indices.map((index) => {
    const meta = getMarketInstrumentMeta(index.symbol);
    const warnings = validateMarketInstrumentValue(index.symbol, index.value);
    if (warnings.length > 0) {
      console.warn(`[market-data-warning] ${index.symbol}: ${warnings.join(" ")}`);
    }

    return {
      ...index,
      name: meta?.displayName ?? index.name,
      instrument_name: meta?.displayName ?? index.name,
      instrument_type: meta?.instrumentType ?? "index",
      data_source: index.provider_source || meta?.dataSource || "unknown",
      price_freshness: index.value === null ? "demo" : meta?.priceFreshness ?? "delayed",
      description: meta?.description ?? index.name,
      category: meta?.category ?? "Other",
      icon: meta?.icon ?? "📊",
      data_warnings: warnings,
      has_data_warning: warnings.length > 0,
    };
  });

  return NextResponse.json(enriched);
}
