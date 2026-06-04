import process from "node:process";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import { getPostgresPool } from "../src/lib/postgres";

dotenv.config();

type ColumnInfo = {
  name: string;
};

type TableImportConfig = {
  table: string;
  selectSql: string;
  conflictTarget?: string;
  updateColumns?: string[];
};

function resolveSqlitePath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }

  return "data/stock_analyst.db";
}

function loadRows(sqlite: Database.Database, sql: string): Array<Record<string, unknown>> {
  return sqlite.prepare(sql).all() as Array<Record<string, unknown>>;
}

async function getPostgresColumns(table: string): Promise<string[]> {
  const { rows } = await getPostgresPool().query<ColumnInfo>(
    `SELECT column_name AS name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [table]
  );

  return rows.map((row) => row.name);
}

function buildInsertSql(config: TableImportConfig, columns: string[]): string {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const quotedColumns = columns.join(", ");

  if (!config.conflictTarget) {
    return `INSERT INTO ${config.table} (${quotedColumns}) VALUES (${placeholders})`;
  }

  const updateColumns = (config.updateColumns || columns).filter((column) => column !== "id");
  const assignments = updateColumns
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  return `
    INSERT INTO ${config.table} (${quotedColumns})
    VALUES (${placeholders})
    ON CONFLICT (${config.conflictTarget})
    DO UPDATE SET ${assignments}
  `;
}

async function importTable(sqlite: Database.Database, config: TableImportConfig): Promise<number> {
  const rows = loadRows(sqlite, config.selectSql);
  if (rows.length === 0) {
    return 0;
  }

  const postgresColumns = await getPostgresColumns(config.table);
  const sample = rows[0] || {};
  const columns = postgresColumns.filter((column) => Object.prototype.hasOwnProperty.call(sample, column));
  const sql = buildInsertSql(config, columns);

  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const values = columns.map((column) => {
        const value = row[column];
        return value === undefined ? null : value;
      });
      await client.query(sql, values);
    }

    await client.query("COMMIT");
    return rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetSequence(table: string): Promise<void> {
  const hasId = await getPostgresPool().query<ColumnInfo>(
    `SELECT column_name AS name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'`,
    [table]
  );

  if (hasId.rowCount === 0) {
    return;
  }

  await getPostgresPool().query(
    `SELECT setval(
      pg_get_serial_sequence($1, 'id'),
      COALESCE((SELECT MAX(id) FROM ${table}), 1),
      COALESCE((SELECT MAX(id) FROM ${table}), 0) > 0
    )`,
    [`public.${table}`]
  );
}

const TABLES: TableImportConfig[] = [
  { table: "users", selectSql: "SELECT * FROM users ORDER BY id ASC", conflictTarget: "id" },
  { table: "app_settings", selectSql: "SELECT * FROM app_settings ORDER BY id ASC", conflictTarget: "key" },
  { table: "watchlists", selectSql: "SELECT * FROM watchlists ORDER BY id ASC", conflictTarget: "id" },
  { table: "alert_rules", selectSql: "SELECT * FROM alert_rules ORDER BY id ASC", conflictTarget: "rule_key" },
  { table: "portfolio", selectSql: "SELECT * FROM portfolio ORDER BY id ASC", conflictTarget: "id" },
  {
    table: "watchlist",
    selectSql: `
      SELECT *
      FROM watchlist
      WHERE id IN (
        SELECT MAX(id)
        FROM watchlist
        GROUP BY ticker
      )
      ORDER BY id ASC
    `,
    conflictTarget: "ticker",
  },
  { table: "stocks", selectSql: "SELECT * FROM stocks ORDER BY ticker ASC", conflictTarget: "ticker" },
  {
    table: "price_history",
    selectSql: `
      SELECT *
      FROM price_history
      WHERE id IN (
        SELECT MAX(id)
        FROM price_history
        GROUP BY ticker, date
      )
      ORDER BY id ASC
    `,
    conflictTarget: "ticker, date",
  },
  {
    table: "stock_prices",
    selectSql: `
      SELECT *
      FROM stock_prices
      WHERE id IN (
        SELECT MAX(id)
        FROM stock_prices
        GROUP BY ticker, date
      )
      ORDER BY id ASC
    `,
    conflictTarget: "ticker, date",
  },
  {
    table: "current_prices",
    selectSql: `
      SELECT *
      FROM current_prices
      WHERE id IN (
        SELECT MAX(id)
        FROM current_prices
        GROUP BY ticker
      )
      ORDER BY id ASC
    `,
    conflictTarget: "ticker",
  },
  {
    table: "technical_indicators",
    selectSql: `
      SELECT *
      FROM technical_indicators
      WHERE id IN (
        SELECT MAX(id)
        FROM technical_indicators
        GROUP BY ticker
      )
      ORDER BY id ASC
    `,
    conflictTarget: "ticker",
  },
  { table: "market_indices", selectSql: "SELECT * FROM market_indices ORDER BY id ASC", conflictTarget: "symbol" },
  { table: "ai_reports", selectSql: "SELECT * FROM ai_reports ORDER BY id ASC", conflictTarget: "id" },
  { table: "alerts", selectSql: "SELECT * FROM alerts ORDER BY id ASC", conflictTarget: "id" },
  { table: "news", selectSql: "SELECT * FROM news ORDER BY id ASC", conflictTarget: "id" },
  { table: "sentiment", selectSql: "SELECT * FROM sentiment ORDER BY id ASC", conflictTarget: "id" },
  { table: "fetch_errors", selectSql: "SELECT * FROM fetch_errors ORDER BY id ASC", conflictTarget: "id" },
  { table: "analysis_schedule", selectSql: "SELECT * FROM analysis_schedule ORDER BY id ASC", conflictTarget: "id" },
  { table: "analysis_history", selectSql: "SELECT * FROM analysis_history ORDER BY id ASC", conflictTarget: "id" },
  { table: "recommendations", selectSql: "SELECT * FROM recommendations ORDER BY id ASC", conflictTarget: "id" },
  {
    table: "sector_analysis",
    selectSql: `
      SELECT *
      FROM sector_analysis
      WHERE id IN (
        SELECT MAX(id)
        FROM sector_analysis
        GROUP BY sector, analysis_date
      )
      ORDER BY id ASC
    `,
    conflictTarget: "sector, analysis_date",
  },
  { table: "market_events", selectSql: "SELECT * FROM market_events ORDER BY id ASC", conflictTarget: "id" },
  { table: "ai_chat_logs", selectSql: "SELECT * FROM ai_chat_logs ORDER BY id ASC", conflictTarget: "id" },
  { table: "performance_tracking", selectSql: "SELECT * FROM performance_tracking ORDER BY id ASC", conflictTarget: "id" },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Uzupełnij .env przed importem danych.");
  }

  const sqlitePath = resolveSqlitePath();
  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    for (const config of TABLES) {
      const imported = await importTable(sqlite, config);
      console.log(`Imported ${imported} row(s) into ${config.table}.`);
    }

    for (const config of TABLES) {
      await resetSequence(config.table);
    }
  } finally {
    sqlite.close();
  }
}

main()
  .catch((error) => {
    console.error("SQLite -> PostgreSQL import failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPostgresPool().end().catch(() => undefined);
  });
