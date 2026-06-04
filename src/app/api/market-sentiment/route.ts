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
    if (process.env.NODE_ENV === "development") {
      console.warn("market-sentiment fetch degraded:", error);
    }
    return NextResponse.json(
      {
        error: "Nie udało się w pełni pobrać danych o sentymencie rynku",
        fearGreedScore: null,
        fearGreedLabel: null,
        fearGreedUpdatedAt: null,
        putCallRatio: null,
        putCallType: null,
        vixValue: null,
        vixChangePct: null,
        breadthScore: null,
        breadthLabel: null,
        source: {
          fearGreed: "unavailable",
          putCall: "unavailable",
        },
        history: [],
      },
      { status: 200 }
    );
  }
}
