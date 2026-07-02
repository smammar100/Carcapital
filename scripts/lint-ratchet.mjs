/**
 * Lint ratchet — CI gate that only tightens.
 *
 * The repo has a stock of pre-existing ESLint errors (react-hooks compiler
 * rules in legacy components) that are only safe to fix once those modules
 * have characterization tests. Blocking CI on them now would freeze all work;
 * ignoring lint entirely would let the count grow. So: fail only if the error
 * count EXCEEDS the committed baseline, and auto-invite lowering it when the
 * count drops.
 *
 * Usage:  node scripts/lint-ratchet.mjs            (check — used by CI)
 *         node scripts/lint-ratchet.mjs --update   (rebaseline after fixes)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASELINE_FILE = new URL("../.lint-baseline.json", import.meta.url);

function currentErrorCount() {
  let out;
  try {
    out = execSync("pnpm exec eslint --format json", {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    // eslint exits 1 when errors exist — the JSON report is still on stdout.
    out = e.stdout;
    if (!out) throw e;
  }
  const report = JSON.parse(out);
  return report.reduce((sum, f) => sum + f.errorCount, 0);
}

const errors = currentErrorCount();

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ maxErrors: errors }, null, 2) + "\n");
  console.log(`Baseline updated: maxErrors = ${errors}`);
  process.exit(0);
}

const { maxErrors } = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));

if (errors > maxErrors) {
  console.error(
    `Lint ratchet FAILED: ${errors} errors > baseline ${maxErrors}. ` +
      `Fix the new errors (run \`pnpm lint\` for details).`,
  );
  process.exit(1);
}

if (errors < maxErrors) {
  console.log(
    `Lint improved: ${errors} errors (baseline ${maxErrors}). ` +
      `Lock it in with \`node scripts/lint-ratchet.mjs --update\`.`,
  );
} else {
  console.log(`Lint ratchet OK: ${errors} errors (== baseline).`);
}
