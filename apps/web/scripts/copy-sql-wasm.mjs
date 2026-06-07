// Copies the sql.js WebAssembly binary into public/ so it's served at /sql-wasm.wasm and loaded
// locally (no CDN — keeps the "your data never leaves the browser" promise intact). Runs on prebuild.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../node_modules/sql.js/dist/sql-wasm.wasm");
const destDir = resolve(here, "../public");
const dest = resolve(destDir, "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-sql-wasm] source wasm not found at", src, "— skipping");
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-sql-wasm] copied sql-wasm.wasm → public/");
