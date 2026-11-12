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
  // Deterministic journeys: View Transitions otherwise make style flips
  // asynchronous (computed styles lag one frame behind the DOM attributes).
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
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

/* Journey 9 — command palette opens with Ctrl+K and runs actions */
try {
  const page = await fresh(BASE + '?number=%2B919876543210');
  await page.evaluate(() => {
    window.__open = [];
    window.open = (u) => {
      window.__open.push(String(u));
      return {};
    };
  });
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await sleep(250);
  const opened = await page.evaluate(() => document.getElementById('paletteDialog').open);
  await page.type('#paletteInput', 'whats');
  await sleep(200);
  await page.keyboard.press('Enter');
  await sleep(400);
  const result = await page.evaluate(() => ({
    launched: window.__open[0] ?? null,
    closed: !document.getElementById('paletteDialog').open,
  }));
  check(
    'palette',
    'Ctrl+K opens palette, Enter launches the typed app',
    opened && result.closed && result.launched === 'https://wa.me/919876543210',
    JSON.stringify(result),
  );
  await page.close();
} catch (e) {
  check('palette', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 10 — message templates: create via dialog, insert via chip */
try {
  const page = await fresh(BASE + '?number=%2B919876543210&text=hello');
  await page.click('#settingsOpen');
  await page.click('#templateNew');
  await page.type('#templateName', 'Quick hi');
  await page.type('#templateText', 'Hey {name}! ({number})');
  await page.click('#templateForm button[type="submit"]');
  await sleep(200);
  await page.evaluate(() => document.getElementById('settingsDialog').close());
  await sleep(200);
  // The message row is open (?text=), so chips render; insert one.
  await page.click('.template-chip');
  const inserted = await page.evaluate(() => document.getElementById('message').value);
  const expanded = await page.evaluate(async () => {
    const m = await import('./js/templates.js');
    return m.expandTemplate('Hey {name}! ({number})', { name: 'Ada', number: '+919876543210' });
  });
  check(
    'templates',
    'template saved, chip inserts, variables expand',
    inserted.includes('{name}') && expanded === 'Hey Ada! (+919876543210)',
    JSON.stringify({ inserted, expanded }),
  );
  await page.close();
} catch (e) {
  check('templates', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 11 — broadcast list: create, add member */
try {
  const page = await fresh();
  await page.click('#settingsOpen');
  await page.click('#listNew');
  await sleep(200);
  await page.keyboard.type('Team');
  await page.keyboard.press('Enter');
  await sleep(300);
  await page.type('#listAddInput', 'Ada, +15551234567');
  await page.click('#listAddForm button[type="submit"]');
  await page.type('#listAddInput', '15552223333');
  await page.click('#listAddForm button[type="submit"]');
  await sleep(200);
  const state = await page.evaluate(() => ({
    rows: document.querySelectorAll('#listItems .manage-row').length,
    title: document.getElementById('listsTitle').textContent,
  }));
  await page.evaluate(() => document.getElementById('listsDialog').close());
  await page.evaluate(() => document.getElementById('settingsDialog').close());
  check(
    'lists',
    'list created, members parsed and added',
    state.rows === 2 && state.title === 'Team',
    JSON.stringify(state),
  );
  await page.close();
} catch (e) {
  check('lists', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 12 — scanner dialog opens and degrades safely headless */
try {
  const page = await fresh(BASE + '?number=%2B919876543210');
  await page.click('#scanBtn');
  await sleep(400);
  const scan = await page.evaluate(() => ({
    open: document.getElementById('scannerDialog').open,
    hasVideo: !!document.getElementById('scannerVideo'),
  }));
  await page.keyboard.press('Escape');
  const stopped = await page.evaluate(() => !document.getElementById('scannerDialog').open);
  check(
    'scanner',
    'scan dialog opens with video and closes cleanly',
    scan.open && scan.hasVideo && stopped,
    JSON.stringify(scan),
  );
  await page.close();
} catch (e) {
  check('scanner', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 13 — large-text mode + high contrast flip document attributes */
try {
  const page = await fresh();
  await page.click('#settingsOpen');
  // programmatic clicks — the View Transition can shift layout under the cursor
  await page.evaluate(() => {
    document.querySelector('#textGroup input[value="large"]').click();
    document.getElementById('contrastToggle').click();
  });
  await sleep(150);
  const attrs = await page.evaluate(async () => {
    const target = { text: document.documentElement.dataset.text, contrast: document.documentElement.dataset.contrast, rootFont: '' };
    // font-size application can lag the DOM attribute by a frame in headless
    for (let i = 0; i < 30; i++) {
      target.rootFont = getComputedStyle(document.documentElement).fontSize;
      if (parseFloat(target.rootFont) >= 17) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    return target;
  });
  await page.keyboard.press('Escape');
  check(
    'a11y',
    'large text + high contrast apply instantly',
    attrs.text === 'large' && attrs.contrast === 'high' && parseFloat(attrs.rootFont) >= 17,
    JSON.stringify(attrs),
  );
  await page.close();
} catch (e) {
  check('a11y', 'journey crashed', false, String(e).slice(0, 120));
}

/* Journey 14 — suggestion badge follows per-number history */
try {
  const page = await fresh();
  await page.evaluate(() => {
    window.open = () => ({});
    const fill = (v) => {
      const i = document.getElementById('phone');
      i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('5551234567');
    document.querySelector('.tile[data-app=telegram]').click();
  });
  await sleep(300);
  await page.evaluate(() => {
    const i = document.getElementById('phone');
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.value = '5551234567';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  const badge = await page.evaluate(
    () => document.querySelector('.tile.suggested')?.dataset.app ?? null,
  );
  check('suggest', 'suggested badge lands on the last-used app', badge === 'telegram', String(badge));
  await page.close();
} catch (e) {
  check('suggest', 'journey crashed', false, String(e).slice(0, 120));
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} e2e checks passed`);
process.exit(failed.length ? 1 : 0);
