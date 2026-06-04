import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettingValue, upsertSetting } from "@/lib/postgres-access";

// Rate limit: max 3 manual analyses per hour
const analysisRateLimit = new Map<number, number[]>();

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limiting
  const now = Date.now();
  const userRequests = analysisRateLimit.get(session.userId) || [];
  const recentRequests = userRequests.filter((t) => now - t < 3600000); // last hour

  if (recentRequests.length >= 3) {
    return NextResponse.json(
      { error: "Przekroczono limit analiz (3/h). Odczekaj chwilę." },
      { status: 429 }
    );
  }

  analysisRateLimit.set(session.userId, [...recentRequests, now]);

  // Check if analysis is already running
  const runningFlag = await getSettingValue("analysis_running");
  if (runningFlag === "1") {
    return NextResponse.json({ error: "Analiza już trwa, poczekaj..." }, { status: 409 });
  }

  // Mark as running
  await upsertSetting("analysis_running", "1");

  // Run analysis asynchronously
  (async () => {
    try {
      const { runFullAnalysis } = await import("@/lib/analysis-engine");
      await runFullAnalysis("manual");
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      await upsertSetting("analysis_running", "0");
      await upsertSetting("last_analysis_run", new Date().toISOString());
    }
  })();

  return NextResponse.json({ success: true, message: "Analiza uruchomiona w tle" });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const running = await getSettingValue("analysis_running");
  const lastRun = await getSettingValue("last_analysis_run");

  return NextResponse.json({
    running: running === "1",
    lastRun: lastRun || null,
  });
}
