import { getDb } from "./db";

export function ensureIntegrationActivityTable(): void {
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

export function logIntegrationActivity(entry: {
  integration: string;
  action: string;
  symbol?: string | null;
  userId?: number | null;
  tenantId?: string | null;
  status: "success" | "error";
  details?: Record<string, unknown>;
}): void {
  ensureIntegrationActivityTable();
  const db = getDb();
  db.prepare(`
    INSERT INTO integration_activity_logs (
      integration, action, symbol, user_id, tenant_id, status, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.integration,
    entry.action,
    entry.symbol ?? null,
    entry.userId ?? null,
    entry.tenantId ?? null,
    entry.status,
    entry.details ? JSON.stringify(entry.details) : null
  );
}

