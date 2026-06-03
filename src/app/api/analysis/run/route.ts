import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

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
  const db = getDb();
  const runningFlag = db.prepare("SELECT value FROM app_settings WHERE key = 'analysis_running'").get() as { value: string } | undefined;
  if (runningFlag?.value === "1") {
    return NextResponse.json({ error: "Analiza już trwa, poczekaj..." }, { status: 409 });
  }

  // Mark as running
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('analysis_running', '1')").run();

  // Run analysis asynchronously
  (async () => {
    try {
      const { runFullAnalysis } = await import("@/lib/analysis-engine");
      await runFullAnalysis("manual");
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('analysis_running', '0')").run();
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('last_analysis_run', datetime('now'), datetime('now'))").run();
    }
  })();

  return NextResponse.json({ success: true, message: "Analiza uruchomiona w tle" });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const running = db.prepare("SELECT value FROM app_settings WHERE key = 'analysis_running'").get() as { value: string } | undefined;
  const lastRun = db.prepare("SELECT value FROM app_settings WHERE key = 'last_analysis_run'").get() as { value: string } | undefined;

  return NextResponse.json({
    running: running?.value === "1",
    lastRun: lastRun?.value || null,
  });
}
