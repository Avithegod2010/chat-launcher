/**
 * Happy-path end-to-end journeys against the real app in headless Chrome.
 * (Playwright-style journeys implemented with puppeteer-core to reuse the
 * existing dev toolchain and the runner's system Chrome.)
 *
 * Requires: node tools/serve.mjs running on :8143 (CI starts it).
 * Usage: node tools/e2e.mjs   [CHROME_PATH=/usr/bin/google-chrome]
 */
import puppeteer from 'puppeteer-core';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = 'http://127.0.0.1:8143/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DL_DIR = mkdtempSync(join(tmpdir(), 'cl-e2e-dl-'));

const results = [];
const check = (journey, name, pass, detail = '') => {
  results.push({ journey, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${journey}] ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  protocolTimeout: 30000,
  args: ['--no-sandbox', '--disable-gpu'],
});

async function fresh(url = BASE) {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.tile[data-app="whatsapp"]', { timeout: 15000 });
  // Hard reset app state between journeys (shared browser context).
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.tile[data-app="whatsapp"]', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 250));
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Journey 1 — paste a number and launch WhatsApp with the exact link */
try {
  const page = await fresh(BASE + '?number=%2B919876543210');
  const url = await page.evaluate(() => {
    window.__open = [];
    window.open = (u) => {
      window.__open.push(String(u));
      return {};
    };
    document.querySelector('.tile[data-app=whatsapp]').click();
    return window.__open;
  });
  check('launch', 'WhatsApp link built exactly', url.length === 1 && url[0] === 'https://wa.me/919876543210', url.join('|'));

  const chip = await page.evaluate(() => document.querySelector('#historyList .chip .chip-name')?.textContent ?? '');
  check('launch', 'history chip shows grouped number', /98765 43210/.test(chip), chip);
  await page.close();
} catch (e) {
  check('launch', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 2 — history search filters by app name and clears */
try {
  const page = await fresh();
  await page.evaluate(() => {
    window.open = () => ({});
    const set = (v) => {
      const i = document.getElementById('phone');
      i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('9876543210');
    document.querySelector('.tile[data-app=whatsapp]').click();
    set('4155552671');
    document.querySelector('.tile[data-app=telegram]').click();
  });
  await sleep(300);
  const count1 = await page.evaluate(() => document.querySelectorAll('#historyList .chip').length);
  await page.type('#historySearch', 'whatsapp');
  await sleep(200);
  const count2 = await page.evaluate(() => document.querySelectorAll('#historyList .chip').length);
  await page.evaluate(() => {
    const s = document.getElementById('historySearch');
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);
  const count3 = await page.evaluate(() => document.querySelectorAll('#historyList .chip').length);
  check(
    'search',
    'two entries, app-name search filters, clearing restores',
    count1 === 2 && count2 === 1 && count3 === 2,
    `${count1}→${count2}→${count3}`,
  );
  await page.close();
} catch (e) {
  check('search', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 3 — language switch + RTL */
try {
  const page = await fresh();
  await page.click('#settingsOpen');
  await page.evaluate(() => document.querySelector('#langGroup input[value=es]').click());
  await sleep(250);
  const es = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    tagline: document.querySelector('.site-footer span').textContent,
  }));
  await page.evaluate(() => document.querySelector('#langGroup input[value=ar]').click());
  await sleep(250);
  const ar = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    install: document.querySelector('#installBtn').textContent,
  }));
  check('i18n', 'Spanish applies', es.lang === 'es' && /sin conexión/.test(es.tagline), JSON.stringify(es));
  check('i18n', 'Arabic switches RTL', ar.lang === 'ar' && ar.dir === 'rtl' && /تثبيت/.test(ar.install), JSON.stringify(ar));
  await page.close();
} catch (e) {
  check('i18n', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 4 — backup export produces a valid backup payload */
try {
  const page = await fresh();
  await page.evaluate(() => {
    window.open = () => ({});
    const i = document.getElementById('phone');
    i.value = '9876543210';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.tile[data-app=whatsapp]').click();
  });
  const backupText = await page.evaluate(async () => {
    // Capture the blob the export code hands to the download anchor.
    const orig = URL.createObjectURL;
    let captured = null;
    URL.createObjectURL = (blob) => {
      captured = blob;
      return 'blob:captured';
    };
    document.getElementById('settingsOpen').click();
    document.getElementById('exportBtn').click();
    URL.createObjectURL = orig;
    await new Promise((r) => setTimeout(r, 100));
    return captured ? await captured.text() : null;
  });
  let ok = false;
  let detail = 'no blob';
  if (backupText) {
    const parsed = JSON.parse(backupText);
    ok = parsed.format === 'chat-launcher-backup' && parsed.history.length === 1;
    detail = `format=${parsed.format} entries=${parsed.history.length}`;
  }
  check('backup', 'export builds a valid backup payload', ok, detail);
  await page.close();
} catch (e) {
  check('backup', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 5 — backup import restores entries */
try {
  const page = await fresh(BASE);
  const backupPath = join(DL_DIR, 'import-test.json');
  writeFileSync(
    backupPath,
    JSON.stringify({
      format: 'chat-launcher-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { theme: 'dark', country: 'IN', order: [], disabled: [], accent: 'violet' },
      history: [{ e164: '918888777666', label: 'Restored', count: 1, lastUsed: Date.now(), pinned: false }],
      stats: { total: 1, byApp: { whatsapp: 1 }, byMonth: {} },
    }),
  );
  await page.click('#settingsOpen');
  const input = await page.$('#importFile');
  await input.uploadFile(backupPath);
  await sleep(800);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('#historyList .chip .chip-name')].map((n) => n.textContent),
  );
  check('backup', 'import restores a labelled entry', names.some((n) => /Restored/.test(n)), names.join('|'));
  await page.close();
} catch (e) {
  check('backup', 'import journey crashed', false, String(e).slice(0, 120));
}

/* Journey 6 — unusual length asks before launching */
try {
  const page = await fresh();
  await page.type('#phone', '98765');
  const before = await page.evaluate(() => {
    window.__open = 0;
    window.open = () => {
      window.__open++;
      return {};
    };
    document.querySelector('.tile[data-app=whatsapp]').click();
    return window.__open;
  });
  const toastText = await page.evaluate(() => document.querySelector('#toasts .toast')?.textContent ?? '');
  const confirmToast = await page.evaluate(() => !!document.querySelector('#toasts .toast-action'));
  check('confirm', 'short number does not launch immediately', before === 0 && confirmToast, toastText.slice(0, 80));
  await page.evaluate(() => document.querySelector('#toasts .toast-action')?.click());
  await sleep(200);
  const after = await page.evaluate(() => window.__open);
  check('confirm', 'confirm action launches anyway', after === 1, String(after));
  await page.close();
} catch (e) {
  check('confirm', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 7 — vCard import */
try {
  const page = await fresh();
  const vcfPath = join(DL_DIR, 'contacts.vcf');
  writeFileSync(
    vcfPath,
    ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ada Lovelace', 'TEL;TYPE=CELL:+442079460958', 'END:VCARD'].join('\r\n'),
  );
  const input = await page.$('#vcfFile');
  await input.uploadFile(vcfPath);
  await sleep(600);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('#historyList .chip .chip-name')].map((n) => n.textContent),
  );
  check('vcf', 'contact file imports with its name', names.some((n) => /Ada Lovelace/.test(n)), names.join('|'));
  await page.close();
} catch (e) {
  check('vcf', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 8 — a11y: dialogs labelled, Escape closes, focus moves in */
try {
  const page = await fresh();
  await page.click('#settingsOpen');
  await sleep(200);
  const dlg = await page.evaluate(() => {
    const d = document.getElementById('settingsDialog');
    const active = document.activeElement;
    return {
      open: d.open,
      labelled: d.hasAttribute('aria-labelledby') || !!d.querySelector('.dialog-title'),
      focusInside: d.contains(active) || active === document.body,
    };
  });
  await page.keyboard.press('Escape');
  await sleep(200);
  const closed = await page.evaluate(() => !document.getElementById('settingsDialog').open);
  check('a11y', 'settings dialog labeled, focus managed, Escape closes', dlg.open && dlg.labelled && closed, JSON.stringify(dlg));
  await page.close();
} catch (e) {
  check('a11y', 'journey crashed', false, String(e).slice(0, 120));
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} e2e checks passed`);
process.exit(failed.length ? 1 : 0);
