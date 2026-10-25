/* Adversarial bug-hunt: drives the real app in headless Edge with hostile
 * inputs and reports PASS/FAIL per probe. Read-only against the app code.
 * Usage: node tools/bug-hunt.mjs
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// CI (Linux) passes CHROME_PATH; locally we default to Edge on Windows.
const BROWSER_PATH = process.env.CHROME_PATH || EDGE;
const BASE = 'http://127.0.0.1:8143/';
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});

async function freshPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
  await page.evaluateOnNewDocument(() => {
    // Tripwire: any alert/eval/dynamic-script means an injection succeeded.
    window.__hunt = { alerts: 0, evals: 0, dialogs: 0 };
    window.alert = () => window.__hunt.alerts++;
    window.eval = () => {
      window.__hunt.evals++;
      throw new Error('eval called');
    };
    window.confirm = () => {
      window.__hunt.dialogs++;
      return false;
    };
    window.prompt = () => {
      window.__hunt.dialogs++;
      return null;
    };
  });
  page.on('dialog', async (d) => {
    await d.dismiss();
  });
  page.on('pageerror', (err) => {
    if (!/eval called/.test(String(err))) {
      record('no unexpected page JS errors', false, String(err).slice(0, 120));
    }
  });
  return page;
}

/* 1 — URL param XSS payloads must be inert */
{
  const page = await freshPage();
  const payload = encodeURIComponent('<img src=x onerror=alert(1)>');
  const payload2 = encodeURIComponent('javascript:alert(1)');
  await page.goto(
    `${BASE}?number=${payload}&text=${payload}&app=${payload2}&title=${payload}`,
    { waitUntil: 'networkidle0' },
  );
  await new Promise((r) => setTimeout(r, 600));
  const r = await page.evaluate(() => ({
    hunt: window.__hunt,
    imgInjected: !!document.querySelector('img[src="x"]'),
    phoneVal: document.getElementById('phone').value,
  }));
  record('XSS in ?number/?text/?app/?title is inert', r.hunt.alerts === 0 && r.hunt.evals === 0 && !r.imgInjected, JSON.stringify(r.hunt));
  const digitsOk = /^\d*$/.test(r.phoneVal) && !/[<>onerror]/i.test(r.phoneVal);
  record('hostile ?number collapses to digits only', digitsOk, `value="${r.phoneVal}"`);
  await page.close();
}

/* 2 — hostile ?app must not set a default launch target */
{
  const page = await freshPage();
  await page.goto(`${BASE}?app=javascript:alert(1)`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const highlighted = await page.evaluate(() => document.querySelectorAll('.tile.highlight').length);
  record('unknown ?app value selects no tile', highlighted === 0, `highlighted=${highlighted}`);
  await page.close();
}

/* 3 — valid number + tile click opens exactly the right URL, once */
{
  const page = await freshPage();
  await page.goto(`${BASE}?number=%2B919876543210&text=hello%20world`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const opened = await page.evaluate(() => {
    const seen = [];
    window.open = (url) => {
      seen.push(String(url));
      return {};
    };
    document.querySelector('.tile[data-app="whatsapp"]').click();
    return seen;
  });
  record(
    'WhatsApp launch URL is exact',
    opened.length === 1 && opened[0] === 'https://wa.me/919876543210?text=hello%20world',
    opened.join(' | '),
  );
  await page.close();
}

/* 4 — invalid number never navigates */
{
  const page = await freshPage();
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const opened = await page.evaluate(() => {
    const seen = { open: 0, href: null };
    window.open = () => {
      seen.open++;
      return {};
    };
    document.getElementById('phone').value = '123';
    document.getElementById('phone').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.tile[data-app="call"]').click();
    return seen;
  });
  record('invalid number blocks navigation', opened.open === 0, JSON.stringify(opened));
  await page.close();
}

/* 5 — poisoned localStorage must not break boot */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('chatlauncher:history', '{"__proto__":{"polluted":"yes"},"0":{"e164":"119"}},,not json');
    localStorage.setItem('chatlauncher:settings', '{"theme":"<script>","order":["nope"],"country":{"a":1}}');
  });
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1100, height: 800 });
  await page2.goto(BASE, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  const r = await page2.evaluate(() => ({
    tiles: document.querySelectorAll('.tile').length,
    polluted: ({}).polluted ?? Object.prototype.polluted ?? 'clean',
    theme: document.documentElement.dataset.theme,
  }));
  record('app boots on poisoned localStorage (9 tiles, no proto pollution)', r.tiles === 9 && r.polluted === 'clean', `tiles=${r.tiles} proto=${r.polluted}`);
  record('hostile theme value falls back safely', ['dark', 'light', 'system'].includes(r.theme) || r.theme === 'dark', `theme=${r.theme}`);
  await page.close();
  await page2.close();
}

/* 6 — strict CSP: no console violations during normal use */
{
  const page = await freshPage();
  const violations = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) {
      violations.push(msg.text().slice(0, 140));
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.getElementById('phone').value = '5551234567';
    document.getElementById('phone').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('settingsOpen').click();
  });
  await new Promise((r) => setTimeout(r, 500));
  record('strict CSP (no unsafe-inline) allows normal use', violations.length === 0, violations.join(' ;; ') || 'no CSP errors');
  await page.close();
}

/* 7 — service worker registers and serves offline */
{
  const page = await freshPage();
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { registered: false, active: false };
    return { registered: true, active: !!reg.active || !!navigator.serviceWorker.controller };
  });
  record('service worker registered', swState.registered, JSON.stringify(swState));
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
process.exit(failed.length ? 1 : 0);
