const fs = require("fs");
const path = require("path");

const typesDir = path.resolve(process.cwd(), ".next", "types");
const routesDeclarationPath = path.join(typesDir, "routes.d.ts");
const routesJsPath = path.join(typesDir, "routes.js");
const cacheLifePath = path.join(typesDir, "cache-life.d.ts");
const validatorPath = path.join(typesDir, "validator.ts");

if (!fs.existsSync(typesDir) || !fs.existsSync(routesDeclarationPath)) {
  process.exit(0);
}

if (!fs.existsSync(cacheLifePath)) {
  fs.writeFileSync(cacheLifePath, "export {};\n", "utf8");
}

if (!fs.existsSync(routesJsPath)) {
  fs.writeFileSync(
    routesJsPath,
    "// Generated helper for TypeScript resolution of Next.js validator imports.\nexport {};\n",
    "utf8"
  );
}

if (!fs.existsSync(validatorPath)) {
  fs.writeFileSync(validatorPath, "export {};\n", "utf8");
}
