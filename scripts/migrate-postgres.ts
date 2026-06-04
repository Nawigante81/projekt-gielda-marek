import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { getPostgresPool } from "../src/lib/postgres";

dotenv.config();

type MigrationRow = {
  name: string;
};

async function ensureMigrationsTable(): Promise<void> {
  await getPostgresPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await getPostgresPool().query<MigrationRow>(
    "SELECT name FROM schema_migrations ORDER BY name ASC"
  );
  return new Set(rows.map((row) => row.name));
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.resolve(process.cwd(), "migrations", "postgres");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function applyMigration(fileName: string): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "migrations", "postgres");
  const filePath = path.join(migrationsDir, fileName);
  const sql = await fs.readFile(filePath, "utf8");

  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [fileName]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Uzupełnij .env przed uruchomieniem migracji.");
  }

  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = await getMigrationFiles();
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("PostgreSQL migrations are up to date.");
    return;
  }

  for (const file of pending) {
    console.log(`Applying migration: ${file}`);
    await applyMigration(file);
  }

  console.log(`Applied ${pending.length} PostgreSQL migration(s).`);
}

main()
  .catch((error) => {
    console.error("PostgreSQL migration failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPostgresPool().end().catch(() => undefined);
  });
