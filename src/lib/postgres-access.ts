import { getDb } from "./db";
import { isPostgresEnabled } from "./database-config";
import { getPostgresPool } from "./postgres";

type SqliteUserRow = { id: number; username: string; password_hash: string } | undefined;

export type UserRow = { id: number; username: string; password_hash: string } | undefined;

export function isUsingPostgres(): boolean {
  return isPostgresEnabled();
}

function toPostgresSql(sql: string): string {
  let index = 0;
  return sql
    .replace(/datetime\('now'\s*,\s*'-(\d+)\s+day[s]?'\)/gi, "NOW() - INTERVAL '$1 day'")
    .replace(/date\('now'\s*,\s*'-(\d+)\s+day[s]?'\)/gi, "CURRENT_DATE - INTERVAL '$1 day'")
    .replace(/datetime\('now'\)/gi, "NOW()")
    .replace(/date\('now'\)/gi, "CURRENT_DATE")
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
    .replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
}

function toSqliteSql(sql: string): string {
  return sql
    .replace(/::timestamptz/gi, "")
    .replace(/::timestamp/gi, "")
    .replace(/::date/gi, "")
    .replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s+day[s]?'/gi, "datetime('now', '-$1 day')")
    .replace(/CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s+day[s]?'/gi, "date('now', '-$1 day')")
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/CURRENT_DATE/gi, "date('now')")
    .replace(/\bCOALESCE\s*\(/gi, "COALESCE(");
}

export async function getSettingsRows(): Promise<Array<{ key: string; value: string }>> {
  if (isUsingPostgres()) {
    const { rows } = await getPostgresPool().query("SELECT key, value FROM app_settings ORDER BY key");
    return rows as Array<{ key: string; value: string }>;
  }

  const db = getDb();
  return db.prepare("SELECT key, value FROM app_settings ORDER BY key").all() as Array<{ key: string; value: string }>;
}

export async function getSettingValue(key: string): Promise<string | null> {
  if (isUsingPostgres()) {
    const { rows } = await getPostgresPool().query("SELECT value FROM app_settings WHERE key = $1 LIMIT 1", [key]);
    return (rows[0] as { value: string } | undefined)?.value ?? null;
  }

  const db = getDb();
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
    return;
  }

  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}

export async function getUserByUsername(username: string): Promise<UserRow> {
  if (isUsingPostgres()) {
    const { rows } = await getPostgresPool().query(
      "SELECT id, username, password_hash FROM users WHERE username = $1 LIMIT 1",
      [username]
    );
    return rows[0] as { id: number; username: string; password_hash: string } | undefined;
  }

  const db = getDb();
  return db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as SqliteUserRow;
}

export async function createUser(username: string, passwordHash: string): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, passwordHash]
    );
    return;
  }

  const db = getDb();
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, passwordHash);
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, userId]
    );
    return;
  }

  const db = getDb();
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, userId);
}

export async function queryRows<T>(sql: string, params: Array<string | number | null> = []): Promise<T[]> {
  if (isUsingPostgres()) {
    const { rows } = await getPostgresPool().query(toPostgresSql(sql), params);
    return rows as T[];
  }

  const db = getDb();
  return db.prepare(toSqliteSql(sql)).all(...params) as T[];
}

export async function queryRow<T>(sql: string, params: Array<string | number | null> = []): Promise<T | undefined> {
  if (isUsingPostgres()) {
    const { rows } = await getPostgresPool().query(toPostgresSql(sql), params);
    return rows[0] as T | undefined;
  }

  const db = getDb();
  return db.prepare(toSqliteSql(sql)).get(...params) as T | undefined;
}

export async function runSql(sql: string, params: Array<string | number | null> = []): Promise<{ lastInsertId?: number }> {
  if (isUsingPostgres()) {
    let postgresSql = toPostgresSql(sql).replace(/INSERT OR REPLACE/gi, "INSERT");
    if (/^\s*insert/i.test(postgresSql) && !/returning/i.test(postgresSql)) {
      postgresSql = `${postgresSql} RETURNING id`;
    }
    const result = await getPostgresPool().query(postgresSql, params);
    const row = result.rows[0] as { id?: number } | undefined;
    return { lastInsertId: row?.id };
  }

  const db = getDb();
  const result = db.prepare(toSqliteSql(sql)).run(...params) as { lastInsertRowid: number };
  return { lastInsertId: Number(result.lastInsertRowid) };
}

export async function upsertCurrentPrice(params: {
  ticker: string;
  price: number;
  changePct: number;
  changeAbs: number;
  volume: number;
  avgVolume: number | null;
  source: string;
}): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO current_prices (ticker, price, change_pct, change_abs, volume, avg_volume, source, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (ticker)
       DO UPDATE SET
         price = EXCLUDED.price,
         change_pct = EXCLUDED.change_pct,
         change_abs = EXCLUDED.change_abs,
         volume = EXCLUDED.volume,
         avg_volume = EXCLUDED.avg_volume,
         source = EXCLUDED.source,
         last_updated = NOW()`,
      [
        params.ticker,
        params.price,
        params.changePct,
        params.changeAbs,
        params.volume,
        params.avgVolume,
        params.source,
      ]
    );
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO current_prices
    (ticker, price, change_pct, change_abs, volume, avg_volume, source, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    params.ticker,
    params.price,
    params.changePct,
    params.changeAbs,
    params.volume,
    params.avgVolume,
    params.source
  );
}

export async function upsertPriceHistoryRow(params: {
  table: "price_history" | "stock_prices";
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO ${params.table} (ticker, date, open, high, low, close, volume, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ticker, date)
       DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         volume = EXCLUDED.volume,
         source = EXCLUDED.source`,
      [
        params.ticker,
        params.date,
        params.open,
        params.high,
        params.low,
        params.close,
        params.volume,
        params.source,
      ]
    );
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO ${params.table} (ticker, date, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.ticker,
    params.date,
    params.open,
    params.high,
    params.low,
    params.close,
    params.volume,
    params.source
  );
}

export async function upsertStockTimestamp(ticker: string): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO stocks (ticker, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (ticker)
       DO UPDATE SET updated_at = NOW()`,
      [ticker]
    );
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO stocks (ticker, updated_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET updated_at = datetime('now')
  `).run(ticker);
}

export async function upsertStockCompany(params: {
  ticker: string;
  companyName: string;
}): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO stocks (ticker, company_name, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (ticker)
       DO UPDATE SET company_name = EXCLUDED.company_name, updated_at = NOW()`,
      [params.ticker, params.companyName]
    );
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO stocks (ticker, company_name, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET company_name = excluded.company_name, updated_at = datetime('now')
  `).run(params.ticker, params.companyName);
}

export async function updateMarketIndex(params: {
  symbol: string;
  value: number;
  changePct: number;
  trend: string;
  marketStatus: string;
}): Promise<void> {
  await runSql(
    `UPDATE market_indices
     SET value = ?, change_pct = ?, trend = ?, market_status = ?, last_updated = datetime('now')
     WHERE symbol = ?`,
    [params.value, params.changePct, params.trend, params.marketStatus, params.symbol]
  );
}

type TechnicalIndicatorsPayload = Record<string, string | number | null>;

export async function upsertTechnicalIndicators(
  payload: TechnicalIndicatorsPayload
): Promise<void> {
  const columns = Object.keys(payload);
  const values = columns.map((column) => payload[column] ?? null);

  if (isUsingPostgres()) {
    const insertColumns = ["ticker", "calculated_at", ...columns.filter((column) => column !== "ticker")];
    const insertValues = [
      payload.ticker,
      ...columns
        .filter((column) => column !== "ticker")
        .map((column) => payload[column] ?? null),
    ];
    const placeholders = insertValues.map((_, index) => `$${index + 1}`);
    const updateAssignments = insertColumns
      .filter((column) => column !== "ticker")
      .map((column) =>
        column === "calculated_at" ? `${column} = NOW()` : `${column} = EXCLUDED.${column}`
      )
      .join(", ");

    await getPostgresPool().query(
      `INSERT INTO technical_indicators (${insertColumns.join(", ")})
       VALUES (${placeholders[0]}, NOW(), ${placeholders.slice(1).join(", ")})
       ON CONFLICT (ticker)
       DO UPDATE SET ${updateAssignments}`,
      insertValues
    );
    return;
  }

  const db = getDb();
  const sqliteColumns = ["ticker", "calculated_at", ...columns.filter((column) => column !== "ticker")];
  const sqlitePlaceholders = ["?", "datetime('now')", ...columns.filter((column) => column !== "ticker").map(() => "?")];
  const sqliteValues = [
    payload.ticker,
    ...columns.filter((column) => column !== "ticker").map((column) => payload[column] ?? null),
  ];

  db.prepare(`
    INSERT OR REPLACE INTO technical_indicators (${sqliteColumns.join(", ")})
    VALUES (${sqlitePlaceholders.join(", ")})
  `).run(...sqliteValues);
}

export async function upsertSectorAnalysis(params: {
  sector: string;
  analysisDate: string;
  avgChangePct: number;
  sentimentScore: number;
  sentimentLabel: string;
  bestTicker: string | null;
  bestChangePct: number;
  worstTicker: string | null;
  worstChangePct: number;
  constituentsJson: string;
}): Promise<void> {
  if (isUsingPostgres()) {
    await getPostgresPool().query(
      `INSERT INTO sector_analysis (
         sector, analysis_date, avg_change_pct, sentiment_score, sentiment_label,
         best_ticker, best_change_pct, worst_ticker, worst_change_pct, constituents_json, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (sector, analysis_date)
       DO UPDATE SET
         avg_change_pct = EXCLUDED.avg_change_pct,
         sentiment_score = EXCLUDED.sentiment_score,
         sentiment_label = EXCLUDED.sentiment_label,
         best_ticker = EXCLUDED.best_ticker,
         best_change_pct = EXCLUDED.best_change_pct,
         worst_ticker = EXCLUDED.worst_ticker,
         worst_change_pct = EXCLUDED.worst_change_pct,
         constituents_json = EXCLUDED.constituents_json,
         created_at = NOW()`,
      [
        params.sector,
        params.analysisDate,
        params.avgChangePct,
        params.sentimentScore,
        params.sentimentLabel,
        params.bestTicker,
        params.bestChangePct,
        params.worstTicker,
        params.worstChangePct,
        params.constituentsJson,
      ]
    );
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO sector_analysis (
      sector, analysis_date, avg_change_pct, sentiment_score, sentiment_label,
      best_ticker, best_change_pct, worst_ticker, worst_change_pct, constituents_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(sector, analysis_date) DO UPDATE SET
      avg_change_pct = excluded.avg_change_pct,
      sentiment_score = excluded.sentiment_score,
      sentiment_label = excluded.sentiment_label,
      best_ticker = excluded.best_ticker,
      best_change_pct = excluded.best_change_pct,
      worst_ticker = excluded.worst_ticker,
      worst_change_pct = excluded.worst_change_pct,
      constituents_json = excluded.constituents_json,
      created_at = datetime('now')
  `).run(
    params.sector,
    params.analysisDate,
    params.avgChangePct,
    params.sentimentScore,
    params.sentimentLabel,
    params.bestTicker,
    params.bestChangePct,
    params.worstTicker,
    params.worstChangePct,
    params.constituentsJson
  );
}
