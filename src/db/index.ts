// SQLite is used via better-sqlite3 in src/lib/db.ts
// This file is kept for compatibility with the drizzle config
import { getDb } from "@/lib/db";

export { getDb as db };
