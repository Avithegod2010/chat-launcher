/* One-shot visual smoke for v1.2 features: QR dialog, Hindi i18n, bulk mode,
 * usage dashboard, accent presets. Prints PASS/FAIL per check.
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8143/';
const out = [];
const check = (name, pass, detail = '') =>
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});

async function fresh(url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 860 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  return page;
}

/* QR dialog renders a real QR canvas */
{
  const page = await fresh(BASE + '?number=%2B919876543210');
  await page.click('#qrBtn');
  await new Promise((r) => setTimeout(r, 300));
  const qr = await page.evaluate(() => {
    const dlg = document.querySelector('#qrDialog[open]');
    const c = document.querySelector('#qrDialog canvas');
    if (!dlg || !c) return { open: false };
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) dark++;
    return { open: true, size: c.width, coloredPx: dark };
  });
  check('QR dialog opens with painted canvas', qr.open && qr.size > 100 && qr.coloredPx > 2000, JSON.stringify(qr));
  await page.screenshot({ path: 'C:\\Users\\Anish\\AppData\\Local\\Temp\\v12-qr.png' });
  await page.close();
}

/* Hindi switch translates static UI */
{
  const page = await fresh(BASE);
  await page.click('#settingsOpen');
  await page.evaluate(() => {
    document.querySelector('#langGroup input[value=hi]').click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const hi = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    install: document.querySelector('#installBtn').textContent,
    tagline: document.querySelector('.site-footer span').textContent,
  }));
  const isHindi = hi.htmlLang === 'hi' && /ऐप इंस्टॉल/.test(hi.install) && /ट्रैकिंग/.test(hi.tagline);
  check('Hindi localization applies', isHindi, JSON.stringify(hi));
  await page.screenshot({ path: 'C:\\Users\\Anish\\AppData\\Local\\Temp\\v12-hindi.png' });
  await page.close();
}

/* Per-country validation message */
{
  const page = await fresh(BASE);
  await page.evaluate(() => {
    const i = document.getElementById('phone');
    i.value = '9876543'; // 7 digits — India needs 10
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  const msg = await page.evaluate(() => document.getElementById('validityMsg').textContent);
  check('country-aware validation message', /10/.test(msg) && /India/.test(msg), msg);
  await page.close();
}

/* Bulk mode parses and blocks invalid rows */
{
  const page = await fresh(BASE + '?number=%2B919876543210');
  await page.click('#bulkBtn');
  await page.type('#bulkTextarea', '9876543210\n+1 555 123 4567\nnot-a-phone');
  await page.click('#bulkParse');
  await new Promise((r) => setTimeout(r, 300));
  const bulk = await page.evaluate(() => ({
    rows: document.querySelectorAll('#bulkRows .bulk-row').length,
    invalid: document.querySelectorAll('#bulkRows .bulk-row.invalid').length,
    openAll: !document.querySelector('#bulkOpenAll').disabled,
  }));
  check('bulk parse: 3 rows, 1 invalid, open-all armed', bulk.rows === 3 && bulk.invalid === 1 && bulk.openAll, JSON.stringify(bulk));
  await page.close();
}

/* Usage dashboard reflects launches */
{
  const page = await fresh(BASE);
  await page.evaluate(() => {
    const i = document.getElementById('phone');
    i.value = '9876543210';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.tile[data-app=whatsapp]').click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#settingsOpen');
  await page.click('#usageOpen');
  await new Promise((r) => setTimeout(r, 300));
  const usage = await page.evaluate(() => {
    document.querySelector('#settingsDialog').close();
    const t = document.querySelector('#usageBody .usage-total')?.textContent ?? '';
    const bars = document.querySelectorAll('#usageBody .stat-row').length;
    return { total: t, bars };
  });
  check('usage dashboard counts launches', /1/.test(usage.total) && usage.bars >= 1, JSON.stringify(usage));
  await page.close();
}

/* Accent presets swap the CSS vars */
{
  const page = await fresh(BASE);
  await page.click('#settingsOpen');
  await page.evaluate(() => document.querySelectorAll('.accent-swatch')[2].click());
  await new Promise((r) => setTimeout(r, 200));
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  check('accent preset applies', accent === '#f97316', accent);
  await page.close();
}

/* Vendored QR lib loaded and CSP-clean */
{
  const page = await fresh(BASE);
  const violations = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Refused|Content Security/i.test(m.text())) violations.push(m.text().slice(0, 100));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));
  check('no CSP violations with vendor script', violations.length === 0, violations.join(';'));
  await page.close();
}

await browser.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
