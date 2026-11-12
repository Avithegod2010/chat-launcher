/**
 * Bundle budget check (#20): fails when the shipped static payload grows
 * past its budget. Size = uncompressed bytes of everything the browser must
 * fetch for a cold load (HTML + CSS + JS + manifest + icons), excluding
 * screenshots and dev tooling.
 *
 * Usage: node tools/bundle-budget.mjs
 */
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{path: string, budget: number, label: string}[]} */
const BUDGETS = [
  { path: 'index.html', budget: 30 * 1024, label: 'HTML' },
  { path: 'css/app.css', budget: 52 * 1024, label: 'CSS' },
  { path: 'js/main.js', budget: 78 * 1024, label: 'main JS' },
  { path: 'js/countries.js', budget: 20 * 1024, label: 'countries data' },
  { path: 'js/i18n.js', budget: 112 * 1024, label: 'i18n tables (12 langs)' },
  { path: 'js/templates.js', budget: 6 * 1024, label: 'templates' },
  { path: 'js/lists.js', budget: 8 * 1024, label: 'broadcast lists' },
  { path: 'js/suggest.js', budget: 4 * 1024, label: 'suggestion engine' },
  { path: 'js/sync.js', budget: 9 * 1024, label: 'e2e sync' },
  { path: 'js/vendor/qrcode-generator.js', budget: 60 * 1024, label: 'vendored QR' },
  { path: 'manifest.webmanifest', budget: 4 * 1024, label: 'manifest' },
  { path: 'sw.js', budget: 6 * 1024, label: 'service worker' },
];

let failed = 0;
let total = 0;

for (const b of BUDGETS) {
  const size = statSync(join(ROOT, b.path)).size;
  total += size;
  const ok = size <= b.budget;
  if (!ok) failed++;
  console.log(
    `${ok ? 'OK  ' : 'OVER'} ${b.label.padEnd(15)} ${(size / 1024).toFixed(1).padStart(6)} KB / ${(b.budget / 1024).toFixed(0)} KB`,
  );
}

// Total cold-load payload across all precached JS + CSS + HTML.
const precache = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const files = [...precache.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);
let precacheTotal = 0;
for (const f of new Set(files)) {
  if (f.endsWith('/')) continue;
  try {
    precacheTotal += statSync(join(ROOT, f.replace(/^\.\//, ''))).size;
  } catch {
    console.error(`MISSING precache asset: ${f}`);
    failed++;
  }
}
const TOTAL_BUDGET = 520 * 1024;
const totalOk = precacheTotal <= TOTAL_BUDGET;
if (!totalOk) failed++;
console.log(
  `${totalOk ? 'OK  ' : 'OVER'} ${'precache total'.padEnd(15)} ${(precacheTotal / 1024).toFixed(1).padStart(6)} KB / ${(TOTAL_BUDGET / 1024).toFixed(0)} KB`,
);

process.exit(failed ? 1 : 0);
