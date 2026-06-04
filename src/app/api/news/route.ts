import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildNewsStats, enrichNewsRows, type EnrichedNewsItem, type NewsDbRow, type NewsSentimentLabel } from "@/lib/news-intelligence";
import { queryRows } from "@/lib/postgres-access";

type NewsApiFilter = {
  ticker: string;
  sentiment: NewsSentimentLabel | "";
  impact: "High Impact" | "Medium Impact" | "Low Impact" | "";
  source: string;
  dateFrom: string;
  dateTo: string;
  portfolioOnly: boolean;
};

function normalizeTicker(ticker: string | null): string {
  return String(ticker || "").trim().toUpperCase();
}

function buildWhereClause(filter: NewsApiFilter): { clause: string; params: Array<string | number | null> } {
  const parts: string[] = [];
  const params: Array<string | number | null> = [];

  if (filter.ticker) {
    parts.push("UPPER(ticker) = ?");
    params.push(filter.ticker);
  }
  if (filter.sentiment) {
    parts.push("sentiment_label = ?");
    params.push(filter.sentiment);
  }
  if (filter.source) {
    parts.push("LOWER(source) = ?");
    params.push(filter.source.toLowerCase());
  }
  if (filter.dateFrom) {
    parts.push("published_at >= ?");
    params.push(`${filter.dateFrom}T00:00:00`);
  }
  if (filter.dateTo) {
    parts.push("published_at <= ?");
    params.push(`${filter.dateTo}T23:59:59`);
  }

  return {
    clause: parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "",
    params,
  };
}

function passesImpactFilter(item: EnrichedNewsItem, filter: NewsApiFilter): boolean {
  if (!filter.impact) return true;
  return item.impact_label === filter.impact;
}

function sortByImportance(items: EnrichedNewsItem[]): EnrichedNewsItem[] {
  return [...items].sort((left, right) => {
    if (left.priority_rank !== right.priority_rank) return left.priority_rank - right.priority_rank;
    if (left.priority_score !== right.priority_score) return right.priority_score - left.priority_score;
    const leftDate = left.published_at ? new Date(left.published_at).getTime() : 0;
    const rightDate = right.published_at ? new Date(right.published_at).getTime() : 0;
    return rightDate - leftDate;
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter: NewsApiFilter = {
    ticker: normalizeTicker(searchParams.get("ticker")),
    sentiment: (searchParams.get("sentiment") as NewsSentimentLabel | "") || "",
    impact: (searchParams.get("impact") as NewsApiFilter["impact"]) || "",
    source: String(searchParams.get("source") || "").trim(),
    dateFrom: String(searchParams.get("date_from") || "").trim(),
    dateTo: String(searchParams.get("date_to") || "").trim(),
    portfolioOnly: searchParams.get("portfolio_only") === "1",
  };

  const portfolioRows = await queryRows<{ ticker: string; status?: string | null }>(
    "SELECT ticker, status FROM portfolio WHERE status IS NULL OR status <> ?",
    ["sold"]
  );
  const portfolioTickers = new Set(portfolioRows.map((row) => normalizeTicker(row.ticker)));

  const where = buildWhereClause(filter);
  const rows = await queryRows<NewsDbRow>(
    `SELECT *
     FROM news
     ${where.clause}
     ORDER BY published_at DESC
     LIMIT 150`,
    where.params
  );

  let items = await enrichNewsRows(rows, portfolioTickers);
  items = items.filter((item) => passesImpactFilter(item, filter));
  if (filter.portfolioOnly) {
    items = items.filter((item) => item.is_portfolio);
  }

  const sorted = sortByImportance(items);
  const stats = buildNewsStats(sorted);
  const portfolioNews = sorted.filter((item) => item.is_portfolio).slice(0, 12);
  const topEvents = sorted.slice(0, 5).map((item) => ({
    id: item.id,
    ticker: item.ticker,
    headline: item.headline,
    impact_label: item.impact_label,
    summary: item.ai_summary[0] || item.clean_summary || item.summary,
    sentiment_label: item.sentiment_label,
    priority_category: item.priority_category,
  }));
  const sources = [...new Set(sorted.map((item) => item.source).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  return NextResponse.json({
    items: sorted.slice(0, 80),
    topEvents,
    portfolioNews,
    stats,
    sources,
    filters: {
      ...filter,
      portfolioTickers: [...portfolioTickers],
    },
  });
}
