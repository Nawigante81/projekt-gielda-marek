export type DatabaseProvider = "sqlite" | "postgres";

export function getDatabaseProvider(): DatabaseProvider {
  const value = (process.env.DATABASE_PROVIDER || "sqlite").toLowerCase();
  return value === "postgres" ? "postgres" : "sqlite";
}

export function isPostgresEnabled(): boolean {
  return getDatabaseProvider() === "postgres";
}

