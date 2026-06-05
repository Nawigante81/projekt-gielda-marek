import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const forbidden = [
  /datetime\s*\(/i,
  /date\s*\(\s*['"]now['"]/i,
  /strftime\s*\(/i,
  /julianday\s*\(/i,
  /IFNULL\s*\(/,
  /AUTOINCREMENT/,
];

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "data",
  "dist",
  "dist-msi",
  "build",
]);

const ignoredFiles = new Set([
  "src/lib/db.ts",
  "src/lib/postgres-access.ts",
  "scripts/import-sqlite-to-postgres.ts",
  "scripts/check-sqlite-sql.ts",
]);

const allowedSqliteOnlyPatterns = [
  /src\/lib\/market-sentiment\.ts:/,
  /src\/lib\/integration-activity\.ts:/,
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const rel = relative(root, fullPath).replace(/\\/g, "/");
    if (ignoredDirs.has(entry) || entry.endsWith(":Zone.Identifier")) continue;
    if (ignoredFiles.has(rel)) continue;
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(ts|tsx|js|jsx|cjs|mjs|sql)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const matches: string[] = [];
for (const file of walk(root)) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!forbidden.some((pattern) => pattern.test(line))) return;
    const location = `${rel}:${index + 1}`;
    if (allowedSqliteOnlyPatterns.some((pattern) => pattern.test(`${location}:${line}`))) return;
    matches.push(`${location}: ${line.trim()}`);
  });
}

if (matches.length > 0) {
  console.error("Forbidden SQLite SQL found:");
  for (const match of matches) console.error(match);
  process.exit(1);
}

console.log("No forbidden SQLite SQL found outside SQLite-only compatibility files.");
