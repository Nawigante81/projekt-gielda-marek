import { Pool, types } from "pg";

let pool: Pool | null = null;

const POSTGRES_NUMERIC_OID = 1700;
const POSTGRES_INT8_OID = 20;

types.setTypeParser(POSTGRES_NUMERIC_OID, (value) => Number(value));
types.setTypeParser(POSTGRES_INT8_OID, (value) => Number(value));

export function getPostgresPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }

    pool = new Pool({
      connectionString,
      max: Number(process.env.PGPOOL_MAX || "10"),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || "30000"),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || "5000"),
    });
  }

  return pool;
}

export async function pingPostgres(): Promise<boolean> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}
