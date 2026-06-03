import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Keys that should never be returned in full (mask them)
const SENSITIVE_KEYS = [
  "finnhub_api_key",
  "alphavantage_api_key",
  "openai_api_key",
  "telegram_bot_token",
  "smtp_password",
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const settings = db.prepare("SELECT key, value FROM app_settings").all() as Array<{ key: string; value: string }>;

  // Also include env-based keys (just indicate if they're set)
  const envKeys = {
    finnhub_api_key: !!process.env.FINNHUB_API_KEY,
    alphavantage_api_key: !!process.env.ALPHA_VANTAGE_API_KEY,
    openai_api_key: !!process.env.OPENAI_API_KEY,
    openai_base_url: process.env.OPENAI_BASE_URL || "",
    telegram_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || "",
  };

  const result: Record<string, string | boolean> = {};
  for (const { key, value } of settings) {
    if (SENSITIVE_KEYS.includes(key) && value) {
      result[key] = "••••••••"; // masked
    } else {
      result[key] = value;
    }
  }

  return NextResponse.json({ ...result, ...envKeys, _env_overrides: envKeys });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = getDb();

  const allowedKeys = [
    "finnhub_api_key", "alphavantage_api_key", "openai_api_key",
    "openai_base_url", "telegram_bot_token", "telegram_chat_id",
    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
    "rsi_overbought", "rsi_oversold", "volume_spike_threshold",
    "price_move_threshold", "data_source_primary", "data_source_secondary",
    "data_source_fallback", "timezone", "report_language", "mode",
    "notifications_telegram", "notifications_email", "notifications_webhook",
    "webhook_url", "analysis_hour_1", "analysis_hour_2", "analysis_hour_3",
    "premarket_check",
  ];

  const updateStmt = db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
  );

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key) && typeof value === "string") {
      // Don't update masked values
      if (value !== "••••••••") {
        updateStmt.run(key, value);
      }
    }
  }

  return NextResponse.json({ success: true });
}
