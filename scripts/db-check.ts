import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { getPostgresPool } from "../src/lib/postgres";

dotenv.config();

type CountRow = {
  count: string;
};

type MigrationRow = {
  name: string;
};

type AdminRow = {
  id: number;
  username: string;
};

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.resolve(process.cwd(), "migrations", "postgres");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function tableExists(tableName: string): Promise<boolean> {
  const { rows } = await getPostgresPool().query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
     LIMIT 1`,
    [tableName]
  );

  return rows.length > 0;
}

async function getAppliedMigrations(): Promise<string[]> {
  const exists = await tableExists("schema_migrations");
  if (!exists) {
    return [];
  }

  const { rows } = await getPostgresPool().query<MigrationRow>(
    "SELECT name FROM schema_migrations ORDER BY name ASC"
  );
  return rows.map((row) => row.name);
}

async function getTableCount(tableName: string): Promise<number | null> {
  const exists = await tableExists(tableName);
  if (!exists) {
    return null;
  }

  const { rows } = await getPostgresPool().query<CountRow>(`SELECT COUNT(*)::text AS count FROM ${tableName}`);
  return Number(rows[0]?.count || "0");
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Uzupełnij .env przed uruchomieniem db:check.");
  }

  console.log("Checking PostgreSQL connection...");
  await getPostgresPool().query("SELECT 1");
  console.log("Connection OK");

  const migrationFiles = await getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  const pendingMigrations = migrationFiles.filter((file) => !appliedMigrations.includes(file));

  console.log("");
  console.log("Migration status:");
  console.log(`- discovered: ${migrationFiles.length}`);
  console.log(`- applied: ${appliedMigrations.length}`);
  console.log(`- pending: ${pendingMigrations.length}`);

  if (pendingMigrations.length > 0) {
    for (const migration of pendingMigrations) {
      console.log(`  pending -> ${migration}`);
    }
  }

  const tableNames = [
    "users",
    "app_settings",
    "portfolio",
    "watchlist",
    "stocks",
    "analysis_history",
    "recommendations",
    "performance_tracking",
  ];

  console.log("");
  console.log("Table counts:");
  for (const tableName of tableNames) {
    const count = await getTableCount(tableName);
    console.log(`- ${tableName}: ${count === null ? "missing" : count}`);
  }

  const usersExists = await tableExists("users");
  if (usersExists) {
    const { rows } = await getPostgresPool().query<AdminRow>(
      "SELECT id, username FROM users WHERE username = $1 LIMIT 1",
      ["pytomek@o2.pl"]
    );
    console.log("");
    console.log(`Default admin: ${rows[0] ? "present" : "missing"}`);
  }

  if (pendingMigrations.length > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error("db:check failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPostgresPool().end().catch(() => undefined);
  });
