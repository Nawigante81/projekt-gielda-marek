import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  DEFAULT_ALERT_RULES,
  DEFAULT_MARKET_INDICES,
  DEFAULT_SETTINGS,
  DEFAULT_WATCHLISTS,
} from "./database-schema";

function resolveDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }

  const desktopUserDataPath = process.env.ELECTRON_USER_DATA_PATH;
  if (desktopUserDataPath) {
    return path.join(desktopUserDataPath, "data", "stock_analyst.db");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "AI Stock Analyst", "data", "stock_analyst.db");
  }

  return path.join(process.cwd(), "data", "stock_analyst.db");
}

const DB_PATH = resolveDbPath();

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db: Database.Database | null = null;

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      company_name TEXT,
      shares REAL NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL DEFAULT 0,
      purchase_date TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      alert_threshold REAL,
      status TEXT NOT NULL DEFAULT 'owned',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      company_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      auto_analyze INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stocks (
      ticker TEXT PRIMARY KEY,
      company_name TEXT,
      sector TEXT,
      industry TEXT,
      market_cap REAL,
      exchange TEXT,
      currency TEXT DEFAULT 'USD',
      is_active INTEGER DEFAULT 1,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume INTEGER,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ticker, date)
    );

    CREATE TABLE IF NOT EXISTS stock_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume INTEGER,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ticker, date)
    );

    CREATE TABLE IF NOT EXISTS current_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      price REAL,
      change_pct REAL,
      change_abs REAL,
      volume INTEGER,
      market_cap REAL,
      pe_ratio REAL,
      high_52w REAL,
      low_52w REAL,
      avg_volume REAL,
      source TEXT,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS technical_indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      calculated_at TEXT DEFAULT (datetime('now')),
      sma_20 REAL,
      sma_50 REAL,
      sma_200 REAL,
      ema_12 REAL,
      ema_26 REAL,
      ema_50 REAL,
      rsi_14 REAL,
      macd_line REAL,
      macd_signal REAL,
      macd_histogram REAL,
      bb_upper REAL,
      bb_middle REAL,
      bb_lower REAL,
      bb_width REAL,
      stoch_k REAL,
      stoch_d REAL,
      adx REAL,
      plus_di REAL,
      minus_di REAL,
      ichimoku_tenkan REAL,
      ichimoku_kijun REAL,
      ichimoku_senkou_a REAL,
      ichimoku_senkou_b REAL,
      fib_0 REAL,
      fib_236 REAL,
      fib_382 REAL,
      fib_500 REAL,
      fib_618 REAL,
      fib_100 REAL,
      signal_sma TEXT DEFAULT 'neutral',
      signal_ema TEXT DEFAULT 'neutral',
      signal_macd TEXT DEFAULT 'neutral',
      signal_rsi TEXT DEFAULT 'neutral',
      signal_bb TEXT DEFAULT 'neutral',
      signal_stoch TEXT DEFAULT 'neutral',
      signal_adx TEXT DEFAULT 'neutral',
      signal_ichimoku TEXT DEFAULT 'neutral',
      signal_fib TEXT DEFAULT 'neutral',
      overall_signal TEXT DEFAULT 'neutral',
      overall_score REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS market_indices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      value REAL,
      change_pct REAL,
      change_abs REAL,
      trend TEXT DEFAULT 'neutral',
      market_status TEXT DEFAULT 'neutral',
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL DEFAULT 'scheduled',
      trigger_time TEXT,
      content TEXT NOT NULL,
      summary TEXT,
      market_sentiment TEXT DEFAULT 'neutral',
      portfolio_summary TEXT,
      top_alerts TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_sentiment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      fear_greed_score REAL,
      put_call_ratio REAL,
      fear_greed_label TEXT,
      vix_value REAL,
      breadth_score REAL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      value REAL,
      threshold REAL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT,
      headline TEXT NOT NULL,
      summary TEXT,
      source TEXT,
      url TEXT,
      sentiment TEXT DEFAULT 'neutral',
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sentiment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT,
      source_type TEXT NOT NULL DEFAULT 'news',
      score REAL NOT NULL,
      label TEXT NOT NULL,
      impact_score REAL DEFAULT 0,
      source_count INTEGER DEFAULT 0,
      summary TEXT,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fetch_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT,
      source TEXT,
      error_type TEXT,
      message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT DEFAULT 'America/New_York',
      is_enabled INTEGER DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      company_name TEXT,
      price REAL NOT NULL,
      score REAL NOT NULL,
      recommendation TEXT NOT NULL,
      sentiment REAL DEFAULT 0,
      change_pct REAL,
      volume INTEGER,
      report_type TEXT DEFAULT 'manual',
      details_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      analysis_history_id INTEGER,
      score REAL NOT NULL,
      recommendation TEXT NOT NULL,
      entry_price REAL NOT NULL,
      horizon_7d_price REAL,
      horizon_30d_price REAL,
      horizon_90d_price REAL,
      horizon_180d_price REAL,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_history_id) REFERENCES analysis_history(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sector_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sector TEXT NOT NULL,
      analysis_date TEXT NOT NULL,
      avg_change_pct REAL DEFAULT 0,
      sentiment_score REAL DEFAULT 0,
      sentiment_label TEXT DEFAULT 'neutral',
      best_ticker TEXT,
      best_change_pct REAL,
      worst_ticker TEXT,
      worst_change_pct REAL,
      constituents_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(sector, analysis_date)
    );

    CREATE TABLE IF NOT EXISTS market_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      ticker TEXT,
      sector TEXT,
      event_date TEXT NOT NULL,
      period_label TEXT,
      impact TEXT DEFAULT 'medium',
      source TEXT,
      details_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sec_filings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      cik TEXT NOT NULL,
      company_name TEXT,
      form TEXT NOT NULL,
      accession_number TEXT NOT NULL,
      filing_date TEXT NOT NULL,
      report_date TEXT,
      primary_document TEXT,
      filing_url TEXT,
      source TEXT NOT NULL DEFAULT 'sec',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ticker, accession_number, form)
    );

    CREATE TABLE IF NOT EXISTS ai_chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      context_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS performance_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recommendation_id INTEGER,
      ticker TEXT NOT NULL,
      entry_price REAL NOT NULL,
      price_7d REAL,
      price_30d REAL,
      price_90d REAL,
      price_180d REAL,
      return_7d REAL,
      return_30d REAL,
      return_90d REAL,
      return_180d REAL,
      success_rate REAL DEFAULT 0,
      average_return REAL DEFAULT 0,
      accuracy_label TEXT DEFAULT 'pending',
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_enabled INTEGER DEFAULT 1,
      threshold_value REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_ticker ON price_history(ticker);
    CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);
    CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker ON stock_prices(ticker);
    CREATE INDEX IF NOT EXISTS idx_stock_prices_date ON stock_prices(date);
    CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON alerts(ticker);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
    CREATE INDEX IF NOT EXISTS idx_technical_ticker ON technical_indicators(ticker);
    CREATE INDEX IF NOT EXISTS idx_news_ticker ON news(ticker);
    CREATE INDEX IF NOT EXISTS idx_analysis_history_ticker ON analysis_history(ticker);
    CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_recommendations_ticker ON recommendations(ticker);
    CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(event_date);
    CREATE INDEX IF NOT EXISTS idx_sentiment_ticker ON sentiment(ticker);
    CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON sec_filings(ticker);
    CREATE INDEX IF NOT EXISTS idx_sec_filings_filing_date ON sec_filings(filing_date);
    CREATE INDEX IF NOT EXISTS idx_sec_filings_form ON sec_filings(form);
  `);

  ensureColumn(db, "watchlist", "watchlist_id", "INTEGER REFERENCES watchlists(id) ON DELETE SET NULL");
  ensureColumn(db, "watchlist", "group_name", "TEXT DEFAULT 'TECH'");
  ensureColumn(db, "watchlist", "auto_analyze", "INTEGER DEFAULT 1");
  ensureColumn(db, "watchlist", "opportunity_type", "TEXT NOT NULL DEFAULT 'observed'");
  ensureColumn(db, "watchlist", "updated_at", "TEXT DEFAULT (datetime('now'))");
  ensureColumn(db, "portfolio", "currency", "TEXT NOT NULL DEFAULT 'USD'");
  ensureColumn(db, "portfolio", "alert_threshold", "REAL");
  ensureColumn(db, "portfolio", "status", "TEXT NOT NULL DEFAULT 'owned'");
  ensureColumn(db, "alerts", "rule_key", "TEXT");
  ensureColumn(db, "alerts", "is_enabled", "INTEGER DEFAULT 1");
  ensureColumn(db, "alerts", "metadata_json", "TEXT");
  ensureColumn(db, "news", "sentiment_label", "TEXT DEFAULT 'neutral'");
  ensureColumn(db, "news", "sentiment_score", "REAL DEFAULT 0");
  ensureColumn(db, "news", "impact_score", "REAL DEFAULT 0");
  ensureColumn(db, "current_prices", "company_name", "TEXT");
  ensureColumn(db, "current_prices", "sector", "TEXT");
  ensureColumn(db, "current_prices", "industry", "TEXT");
  ensureColumn(db, "current_prices", "beta", "REAL");
  ensureColumn(db, "technical_indicators", "ai_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "recommendation", "TEXT DEFAULT 'Hold'");
  ensureColumn(db, "technical_indicators", "trend_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "rsi_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "macd_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "volume_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "sma_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "ema_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "bb_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "adx_score", "REAL DEFAULT 0");
  ensureColumn(db, "technical_indicators", "sentiment_score", "REAL DEFAULT 0");

  db.exec(`
    INSERT OR IGNORE INTO watchlists (name, slug, description, color, is_default)
    VALUES
      ('AI', 'ai', 'Spółki związane ze sztuczną inteligencją', '#0ea5e9', 1),
      ('TECH', 'tech', 'Szeroki sektor technologiczny', '#8b5cf6', 0),
      ('DIVIDEND', 'dividend', 'Spółki dywidendowe', '#22c55e', 0),
      ('ETF', 'etf', 'Fundusze i ETF-y', '#f59e0b', 0);

    INSERT OR IGNORE INTO alert_rules (rule_key, name, description, threshold_value)
    VALUES
      ('rsi_below_30', 'RSI < 30', 'Alert przy wejściu w strefę wyprzedania', 30),
      ('rsi_above_70', 'RSI > 70', 'Alert przy wejściu w strefę wykupienia', 70),
      ('golden_cross', 'Golden Cross', 'SMA50 przecina SMA200 od dołu', NULL),
      ('death_cross', 'Death Cross', 'SMA50 przecina SMA200 od góry', NULL),
      ('ema_cross', 'Przecięcie EMA', 'EMA12 przecina EMA26', NULL),
      ('break_sma200', 'Przebicie SMA200', 'Cena przebija SMA200', NULL),
      ('volume_300', 'Wolumen > 300% średniej', 'Nagły skok wolumenu', 300),
      ('new_ath', 'Nowe ATH', 'Nowe roczne maksimum', NULL),
      ('new_atl', 'Nowe ATL', 'Nowe roczne minimum', NULL),
      ('gap_up', 'Gap Up', 'Otwarcie powyżej poprzedniego high', NULL),
      ('gap_down', 'Gap Down', 'Otwarcie poniżej poprzedniego low', NULL),
      ('sec_recent_filing', 'Nowy filing SEC', 'Alert przy świeżym raporcie SEC 10-K, 10-Q, 8-K lub Form 4', NULL),
      ('earnings_upcoming', 'Nadchodzące wyniki', 'Alert przed publikacją wyników kwartalnych', NULL);
  `);

  db.prepare(`
    UPDATE watchlist
    SET group_name = COALESCE(NULLIF(group_name, ''), 'TECH'),
        updated_at = COALESCE(updated_at, datetime('now')),
        auto_analyze = COALESCE(auto_analyze, 1)
  `).run();

  db.prepare(`
    UPDATE watchlist
    SET watchlist_id = (
      SELECT id FROM watchlists WHERE upper(name) = upper(watchlist.group_name) LIMIT 1
    )
    WHERE watchlist_id IS NULL
  `).run();

  // Ensure default admin user exists (password: admin123)
  const adminUser = db
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .get("pytomek@o2.pl") as { id: number; password_hash: string } | undefined;

  // Valid bcrypt hash of 'admin123' with salt rounds 10.
  const defaultHash =
    "$2b$10$EagBw8xPW9r.bRaoNqmK5OxrDuL7qEoim85wsm5bUvP5tXUHbrZqy";

  if (!adminUser) {
    db.prepare(
      "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)"
    ).run("pytomek@o2.pl", defaultHash);
  } else if (
    adminUser.password_hash ===
    "$2b$10$rQZ8K1N2O3P4Q5R6S7T8UeVwXyZ1A2B3C4D5E6F7G8H9I0J1K2L3"
  ) {
    // Repair old placeholder hash used in previous builds.
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(defaultHash, adminUser.id);
  }

  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)"
  );
  for (const [key, value] of DEFAULT_SETTINGS) {
    insertSetting.run(key, value);
  }

  const insertIndex = db.prepare(
    "INSERT OR IGNORE INTO market_indices (symbol, name) VALUES (?, ?)"
  );
  for (const [symbol, name] of DEFAULT_MARKET_INDICES) {
    insertIndex.run(symbol, name);
  }

  // Insert default schedule
  const scheduleExists = db
    .prepare("SELECT id FROM analysis_schedule LIMIT 1")
    .get();
  if (!scheduleExists) {
    db.prepare(
      "INSERT INTO analysis_schedule (name, cron_expression, timezone) VALUES (?, ?, ?)"
    ).run("Morning Analysis (10:30 AM ET)", "30 10 * * 1-5", "America/New_York");
    db.prepare(
      "INSERT INTO analysis_schedule (name, cron_expression, timezone) VALUES (?, ?, ?)"
    ).run("Midday Analysis (12:30 PM ET)", "30 12 * * 1-5", "America/New_York");
    db.prepare(
      "INSERT INTO analysis_schedule (name, cron_expression, timezone) VALUES (?, ?, ?)"
    ).run("Close Analysis (4:05 PM ET)", "5 16 * * 1-5", "America/New_York");
    db.prepare(
      "INSERT INTO analysis_schedule (name, cron_expression, timezone) VALUES (?, ?, ?)"
    ).run("Premarket Check (8:00 AM ET)", "0 8 * * 1-5", "America/New_York");
  }

  const insertWatchlist = db.prepare(
    "INSERT OR IGNORE INTO watchlists (name, slug, description, color, is_default) VALUES (?, ?, ?, ?, ?)"
  );
  for (const [name, slug, description, color, isDefault] of DEFAULT_WATCHLISTS) {
    insertWatchlist.run(name, slug, description, color, isDefault);
  }

  const insertAlertRule = db.prepare(
    "INSERT OR IGNORE INTO alert_rules (rule_key, name, description, threshold_value) VALUES (?, ?, ?, ?)"
  );
  for (const [ruleKey, name, description, thresholdValue] of DEFAULT_ALERT_RULES) {
    insertAlertRule.run(ruleKey, name, description, thresholdValue);
  }
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
  ).run(key, value);
}
