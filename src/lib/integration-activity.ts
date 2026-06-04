import { isUsingPostgres, runSql } from "./postgres-access";
import { getDb } from "./db";

export async function ensureIntegrationActivityTable(): Promise<void> {
  if (isUsingPostgres()) {
    await runSql(`
      CREATE TABLE IF NOT EXISTS integration_activity_logs (
        id BIGSERIAL PRIMARY KEY,
        integration TEXT NOT NULL,
        action TEXT NOT NULL,
        symbol TEXT,
        user_id BIGINT,
        tenant_id TEXT,
        status TEXT NOT NULL,
        details_json TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    return;
  }

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration TEXT NOT NULL,
      action TEXT NOT NULL,
      symbol TEXT,
      user_id INTEGER,
      tenant_id TEXT,
      status TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function logIntegrationActivity(entry: {
  integration: string;
  action: string;
  symbol?: string | null;
  userId?: number | null;
  tenantId?: string | null;
  status: "success" | "error";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureIntegrationActivityTable();
    await runSql(`
    INSERT INTO integration_activity_logs (
      integration, action, symbol, user_id, tenant_id, status, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
      entry.integration,
      entry.action,
      entry.symbol ?? null,
      entry.userId ?? null,
      entry.tenantId ?? null,
      entry.status,
      entry.details ? JSON.stringify(entry.details) : null,
    ]);
  } catch {
    // Activity logging must never break provider requests.
  }
}
