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
const BROWSER_PATH = process.env.CHROME_PATH || EDGE;
const BASE = 'http://127.0.0.1:8143/';

// Fictional demo number. 415-555-01xx is the NANP range reserved for
// fiction/documentation — it can never reach a real subscriber, so no real
// person's number ends up in the README or on the live site.
const DEMO = '+14155552671';

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

async function shot(name, { width, height, dsf = 1, url = BASE, theme = null }) {
  // A fresh context per shot: the settings live in localStorage, so a dark
  // shot would otherwise leak into the next one.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  if (theme) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('chatlauncher:settings', JSON.stringify({ theme: t }));
    }, theme);
  }
  await page.setViewport({ width, height, deviceScaleFactor: dsf });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  // The install CTA appears once the PWA reports itself installable; it can
  // take a beat after the service worker registers, so wait for it briefly.
  await page
    .waitForFunction(() => {
      const b = document.getElementById('installBtn');
      return b && !b.hidden;
    }, { timeout: 3000 })
    .catch(() => {});
  await page.screenshot({ path: join(OUT, name) });
  console.log(`✓ screenshots/${name}`);
  await context.close();
}

await shot('desktop-dark.png', {
  width: 1280, height: 860,
  url: BASE + '?number=' + encodeURIComponent(DEMO),
});
await shot('desktop-light.png', {
  width: 1280, height: 860, theme: 'light',
  url: BASE + '?number=' + encodeURIComponent(DEMO),
});
await shot('mobile-dark.png', {
  width: 390, height: 844, dsf: 2,
  url: BASE + '?number=' + encodeURIComponent(DEMO),
});

await browser.close();
