import { getDb } from "./db";
import { isPostgresEnabled } from "./database-config";
import { getPostgresPool } from "./postgres";

type SqliteUserRow = { id: number; username: string; password_hash: string } | undefined;

export type UserRow = { id: number; username: string; password_hash: string } | undefined;

export function isUsingPostgres(): boolean {
  return isPostgresEnabled();
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

