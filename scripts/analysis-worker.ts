import cron from "node-cron";
import dotenv from "dotenv";
import { runFullAnalysis } from "../src/lib/analysis-engine";
import { getSettingValue, queryRow, queryRows, upsertSetting } from "../src/lib/postgres-access";
import { generateSecFilingAlerts, refreshSecFilings } from "../src/lib/sec";
import { generateUpcomingEarningsAlerts } from "../src/lib/earnings";
import { fetchExternalMarketSentiment } from "../src/lib/market-sentiment";

dotenv.config();

const timezone = process.env.ANALYSIS_WORKER_TIMEZONE || "Europe/Warsaw";
const configuredTimes = process.env.ANALYSIS_WORKER_TIMES_PL || "16:35,18:45,22:15";
const secRefreshTime = process.env.ANALYSIS_WORKER_SEC_REFRESH_PL || "21:45";
const secRefreshEnabled = process.env.ANALYSIS_WORKER_SEC_REFRESH_ENABLED !== "0";
const secRefreshLimit = Number(process.env.ANALYSIS_WORKER_SEC_REFRESH_LIMIT || "25");
const marketSentimentCron = process.env.ANALYSIS_WORKER_MARKET_SENTIMENT_CRON || "*/30 14-23 * * 1-5";
const marketSentimentEnabled = process.env.ANALYSIS_WORKER_MARKET_SENTIMENT_ENABLED !== "0";

type LatestRun = {
  created_at: string;
};

type TickerRow = {
  ticker: string;
};

function parseTimes(value: string): Array<{ hour: number; minute: number; label: string }> {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hourRaw, minuteRaw] = entry.split(":");
      const hour = Number(hourRaw);
      const minute = Number(minuteRaw);

      if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error(`Invalid analysis worker time: ${entry}. Expected HH:mm.`);
      }

      return {
        hour,
        minute,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      };
    });
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toCronExpression(timeLabel: string): string {
  const [hourRaw, minuteRaw] = timeLabel.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid cron time: ${timeLabel}. Expected HH:mm.`);
  }
  return `${minute} ${hour} * * 1-5`;
}

async function hasRecentScheduledRun(): Promise<boolean> {
  const latest = await queryRow<LatestRun>(
    "SELECT created_at FROM ai_reports WHERE report_type = ? ORDER BY created_at DESC LIMIT 1",
    ["scheduled"]
  );

  if (!latest?.created_at) return false;

  const latestTime = new Date(latest.created_at).getTime();
  return Number.isFinite(latestTime) && Date.now() - latestTime < 10 * 60 * 1000;
}

async function runScheduledAnalysis(label: string): Promise<void> {
  console.log(`[analysis-worker] Scheduled analysis ${label} started`);

  try {
    if (await hasRecentScheduledRun()) {
      console.log("[analysis-worker] Skipping run because a scheduled report was generated in the last 10 minutes");
      return;
    }

    const earningsAlerts = await generateUpcomingEarningsAlerts();
    if (earningsAlerts > 0) {
      console.log(`[analysis-worker] Earnings alerts generated: ${earningsAlerts}`);
    }

    const reportId = await runFullAnalysis("scheduled");
    console.log(`[analysis-worker] Scheduled analysis ${label} finished. report_id=${reportId}`);
  } catch (error) {
    console.error(`[analysis-worker] Scheduled analysis ${label} failed`, error);
  }
}

async function refreshSecBeforeCloseReport(): Promise<void> {
  if (!secRefreshEnabled) {
    console.log("[analysis-worker] SEC refresh disabled");
    return;
  }

  const markerKey = `sec_filings_refreshed_at_${todayKey()}`;
  const existingMarker = await getSettingValue(markerKey);
  if (existingMarker) {
    console.log(`[analysis-worker] SEC refresh already completed for ${todayKey()}`);
    return;
  }

  const rows = await queryRows<TickerRow>(
    `SELECT ticker FROM portfolio
     UNION
     SELECT ticker FROM watchlist
     ORDER BY ticker ASC
     LIMIT ?`,
    [Number.isFinite(secRefreshLimit) && secRefreshLimit > 0 ? secRefreshLimit : 25]
  );

  if (rows.length === 0) {
    await upsertSetting(markerKey, new Date().toISOString());
    console.log("[analysis-worker] SEC refresh skipped: no tickers");
    return;
  }

  console.log(`[analysis-worker] SEC refresh started for ${rows.length} ticker(s)`);
  for (const row of rows) {
    try {
      await refreshSecFilings(row.ticker);
      const alertCount = await generateSecFilingAlerts(row.ticker);
      console.log(`[analysis-worker] SEC refreshed: ${row.ticker}, alerts=${alertCount}`);
    } catch (error) {
      console.error(`[analysis-worker] SEC refresh failed for ${row.ticker}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await upsertSetting(markerKey, new Date().toISOString());
  console.log("[analysis-worker] SEC refresh finished");
}

async function refreshMarketSentimentSnapshot(): Promise<void> {
  try {
    const snapshot = await fetchExternalMarketSentiment();
    console.log(
      `[analysis-worker] Market sentiment refreshed fg=${snapshot.fearGreedScore ?? "null"} pcr=${snapshot.putCallRatio ?? "null"} vix=${snapshot.vixValue ?? "null"} breadth=${snapshot.breadthScore ?? "null"}`
    );
  } catch (error) {
    console.error("[analysis-worker] Market sentiment refresh failed", error);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL && process.env.DATABASE_PROVIDER === "postgres") {
    throw new Error("DATABASE_URL is not configured for analysis worker.");
  }

  const times = parseTimes(configuredTimes);
  if (times.length === 0) {
    throw new Error("ANALYSIS_WORKER_TIMES_PL must contain at least one HH:mm entry.");
  }

  console.log(`[analysis-worker] Starting. timezone=${timezone}, times=${times.map((time) => time.label).join(", ")}`);

  for (const time of times) {
    const expression = `${time.minute} ${time.hour} * * 1-5`;
    cron.schedule(
      expression,
      () => {
        void runScheduledAnalysis(time.label);
      },
      { timezone }
    );

    console.log(`[analysis-worker] Registered ${time.label} (${expression})`);
  }

  if (secRefreshEnabled) {
    const expression = toCronExpression(secRefreshTime);
    cron.schedule(
      expression,
      () => {
        void refreshSecBeforeCloseReport();
      },
      { timezone }
    );
    console.log(`[analysis-worker] Registered SEC refresh ${secRefreshTime} (${expression})`);
  }

  if (marketSentimentEnabled) {
    cron.schedule(
      marketSentimentCron,
      () => {
        void refreshMarketSentimentSnapshot();
      },
      { timezone }
    );
    console.log(`[analysis-worker] Registered market sentiment refresh (${marketSentimentCron})`);
  }
}

void main().catch((error) => {
  console.error("[analysis-worker] Fatal startup error", error);
  process.exit(1);
});
