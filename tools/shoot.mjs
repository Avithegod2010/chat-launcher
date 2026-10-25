/* README screenshot generator: deterministic captures via puppeteer-core.
 * Emulates reduced motion so staggered entrances are always in final state.
 * Usage: node tools/shoot.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'screenshots');
mkdirSync(OUT, { recursive: true });

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8143/';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

async function shot(name, { width, height, dsf = 1, url = BASE }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dsf });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: join(OUT, name) });
  console.log(`✓ screenshots/${name}`);
  await page.close();
}

await shot('desktop-dark.png', {
  width: 1280, height: 860,
  url: BASE + '?number=%2B919876543210',
});
await shot('desktop-light.png', {
  width: 1280, height: 860,
  url: BASE + '?theme=light&number=%2B14155552671',
});
await shot('mobile-dark.png', {
  width: 390, height: 844, dsf: 2,
  url: BASE + '?number=%2B919876543210',
});

await browser.close();
