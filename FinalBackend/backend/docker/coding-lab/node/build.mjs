// Bundles every JS/TS file under <testsDir> to CommonJS in <outDir>. Exit 1 with readable messages on build errors.
import { build } from "esbuild";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const [testsDir, outDir] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const entries = walk(testsDir).filter((f) => /\.(js|jsx|mjs|cjs|ts|tsx)$/.test(f));
if (entries.length === 0) {
  console.error(`No test files found under ${testsDir}`);
  process.exit(1);
}

try {
  await build({
    entryPoints: entries,
    outdir: outDir,
    outbase: testsDir,
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    packages: "external",
    jsx: "automatic",
    loader: { ".js": "jsx", ".mjs": "jsx", ".cjs": "jsx" },
    logLevel: "silent",
  });
} catch (e) {
  for (const err of e.errors ?? [{ text: String(e) }]) {
    const loc = err.location ? `${err.location.file}:${err.location.line}:${err.location.column}: ` : "";
    console.error(`${loc}${err.text}`);
    if (err.location?.lineText) console.error("    " + err.location.lineText.trim());
  }
  process.exit(1);
}
