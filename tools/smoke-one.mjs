/* Run a single v1.2 smoke scenario by name: node tools/smoke-one.mjs qr|hindi|valid|bulk|usage|accent|csp */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8143/';
const which = process.argv[2] ?? 'qr';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || EDGE,
  headless: 'new',
  protocolTimeout: 20000,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 860 });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 140)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

async function fresh(url = BASE) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
}

try {
  if (which === 'qr') {
    await fresh(BASE + '?number=%2B919876543210');
    console.log('page ready, qrcode global:', await page.evaluate(() => typeof window.qrcode));
    await page.click('#qrBtn');
    await new Promise((r) => setTimeout(r, 400));
    console.log('dialog open:', await page.evaluate(() => !!document.querySelector('#qrDialog[open]')));
    const qr = await page.evaluate(() => {
      const c = document.querySelector('#qrDialog canvas');
      if (!c) return null;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) dark++;
      return { w: c.width, dark };
    });
    console.log('canvas:', JSON.stringify(qr));
  } else if (which === 'hindi') {
    await fresh();
    await page.click('#settingsOpen');
    await page.evaluate(() => document.querySelector('#langGroup input[value=hi]').click());
    await new Promise((r) => setTimeout(r, 400));
    console.log(await page.evaluate(() => [
      document.documentElement.lang,
      document.querySelector('#installBtn').textContent,
    ]));
  } else if (which === 'valid') {
    await fresh();
    await page.evaluate(() => {
      const i = document.getElementById('phone');
      i.value = '9876543';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 300));
    console.log('msg:', await page.evaluate(() => document.getElementById('validityMsg').textContent));
  } else if (which === 'bulk') {
    await fresh(BASE + '?number=%2B919876543210');
    await page.click('#bulkBtn');
    await page.type('#bulkTextarea', '9876543210');
    await page.click('#bulkParse');
    await new Promise((r) => setTimeout(r, 300));
    console.log(await page.evaluate(() => ({
      rows: document.querySelectorAll('#bulkRows .bulk-row').length,
      invalid: document.querySelectorAll('#bulkRows .bulk-row.invalid').length,
      openAll: !document.querySelector('#bulkOpenAll').disabled,
    })));
  } else if (which === 'usage') {
    await fresh();
    await page.evaluate(() => {
      window.__opened = [];
      window.open = (url) => {
        window.__opened.push(String(url));
        return {};
      };
      const i = document.getElementById('phone');
      i.value = '9876543210';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('.tile[data-app=whatsapp]');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#settingsOpen');
    await new Promise((r) => setTimeout(r, 300));
    await page.click('#usageOpen');
    await new Promise((r) => setTimeout(r, 300));
    console.log(await page.evaluate(() => ({
      total: document.querySelector('#usageBody .usage-total')?.textContent,
      bars: document.querySelectorAll('#usageBody .stat-row').length,
    })));
  } else if (which === 'accent') {
    await fresh();
    await page.click('#settingsOpen');
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => document.querySelectorAll('.accent-swatch')[2].click());
    await new Promise((r) => setTimeout(r, 200));
    console.log('accent:', await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()));
  } else if (which === 'csp') {
    await fresh();
    await new Promise((r) => setTimeout(r, 500));
    console.log('csp scenario loaded clean');
  }
  console.log('SCENARIO DONE:', which);
} catch (e) {
  console.log('SCENARIO ERROR:', which, String(e).slice(0, 300));
} finally {
  await browser.close();
}
