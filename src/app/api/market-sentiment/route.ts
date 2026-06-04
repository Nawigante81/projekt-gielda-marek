import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchExternalMarketSentiment, getMarketSentimentHistory } from "@/lib/market-sentiment";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [data, history] = await Promise.all([
      fetchExternalMarketSentiment(),
      getMarketSentimentHistory(7),
    ]);
    return NextResponse.json({ ...data, history });
  } catch (error) {
    console.error("market-sentiment fetch error:", error);
    return NextResponse.json(
      {
        error: "Nie udało się pobrać danych o sentymencie rynku",
        fearGreedScore: null,
        fearGreedLabel: null,
        fearGreedUpdatedAt: null,
        putCallRatio: null,
        putCallType: null,
        history: [],
      },
      { status: 502 }
    );
  }
}
