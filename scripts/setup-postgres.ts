import process from "node:process";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")} (exit code ${code ?? "unknown"})`));
    });
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Uzupełnij .env przed uruchomieniem setup:postgres.");
  }

  const shouldImport =
    process.argv.includes("--with-import") ||
    process.env.SETUP_POSTGRES_IMPORT === "1";

  console.log("Starting PostgreSQL setup...");
  console.log("- step 1/2: migrate schema");
  await runCommand("npm", ["run", "migrate:postgres"]);

  console.log("- step 2/2: check database");
  await runCommand("npm", ["run", "db:check"]);

  if (shouldImport) {
    console.log("- optional step: import SQLite data");
    await runCommand("npm", ["run", "import:sqlite-to-postgres"]);
    console.log("- final check after import");
    await runCommand("npm", ["run", "db:check"]);
  } else {
    console.log("SQLite import skipped. Use `npm run setup:postgres -- --with-import` or `SETUP_POSTGRES_IMPORT=1` to include it.");
  }

  console.log("PostgreSQL setup finished.");
}

main().catch((error) => {
  console.error("setup:postgres failed.");
  console.error(error);
  process.exitCode = 1;
});
