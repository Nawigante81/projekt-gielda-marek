const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const chunksDir = path.join(standaloneDir, ".next", "server", "chunks");
const nodeModulesDir = path.join(standaloneDir, "node_modules");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(fullPath);
    }

    return fullPath;
  });
}

function createBetterSqliteAliases() {
  const files = collectFiles(chunksDir).filter((filePath) => filePath.endsWith(".js"));
  const aliases = new Set();
  const aliasPattern = /better-sqlite3-[a-f0-9]+/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const matches = content.match(aliasPattern) || [];
    for (const match of matches) {
      aliases.add(match);
    }
  }

  for (const alias of aliases) {
    const aliasDir = path.join(nodeModulesDir, alias);
    ensureDir(aliasDir);
    fs.writeFileSync(
      path.join(aliasDir, "package.json"),
      JSON.stringify(
        {
          name: alias,
          private: true,
          main: "index.js",
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(aliasDir, "index.js"),
      'module.exports = require("better-sqlite3");\n'
    );
  }

  console.log(`Prepared ${aliases.size} better-sqlite3 standalone alias(es).`);
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error(`Standalone directory not found: ${standaloneDir}`);
}

ensureDir(nodeModulesDir);
createBetterSqliteAliases();
