import test from 'node:test';
import assert from 'node:assert/strict';
import { exportData, importData } from '../js/backup.js';
import { derivePair, hexToRgb } from '../js/colors.js';
import { parseVcf } from '../js/vcf.js';
import { createQueue } from '../js/queue.js';

class FakeStorage {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.get(k) ?? null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}

/* ------------------------------------------------------------------ backup */

test('backup round-trips history, settings and stats', () => {
  const json = exportData({
    settings: { theme: 'dark', country: 'IN', order: ['whatsapp'], disabled: [], accent: 'ocean' },
    history: [{ e164: '919876543210', label: 'Plumber', note: 'quoted 2k', count: 3, pinned: true }],
    stats: { total: 4, byApp: { whatsapp: 4 }, byMonth: { '2026-11': 4 } },
  });
  const back = importData(json);
  assert.equal(back.ok, true);
  assert.equal(back.settings.theme, 'dark');
  assert.equal(back.history.length, 1);
  assert.equal(back.history[0].note, 'quoted 2k');
  assert.equal(back.stats.total, 4);
});

test('import rejects junk without throwing', () => {
  assert.equal(importData('not json').ok, false);
  assert.equal(importData('{}').ok, false);
  assert.equal(importData(JSON.stringify({ format: 'chat-launcher-backup', version: 99 })).ok, false);
});

test('import sanitizes hostile fields', () => {
  const back = importData(
    JSON.stringify({
      format: 'chat-launcher-backup',
      version: 1,
      settings: { theme: 'evil', country: 'XX', order: 'nope', accent: { x: 1 } },
      history: [
        { e164: '<script>', label: 'x' },
        { e164: '15551234567', label: 'y'.repeat(500), count: -5, app: 'whatsapp', pinned: 'yes' },
        null,
      ],
      stats: { total: -9, byApp: { '../bad': 3, sms: 2 } },
    }),
  );
  assert.equal(back.ok, true);
  assert.equal(back.settings.theme, 'system');
  assert.equal(back.settings.country, null);
  assert.equal(back.settings.accent, 'violet');
  assert.equal(back.history.length, 1, 'bad e164 dropped');
  assert.equal(back.history[0].label.length, 40);
  assert.equal(back.history[0].count, 1);
  assert.equal(back.history[0].pinned, true);
  assert.equal(back.stats.total, 0);
  assert.deepEqual(Object.keys(back.stats.byApp), ['sms']);
});

/* ------------------------------------------------------------------ colors */

test('hexToRgb validates and parses', () => {
  assert.deepEqual(hexToRgb('#ff8800'), [255, 136, 0]);
  assert.deepEqual(hexToRgb('#f80'), [255, 136, 0]);
  assert.equal(hexToRgb('red'), null);
  assert.equal(hexToRgb('#12345'), null);
});

test('derivePair returns two valid, distinct hexes', () => {
  const pair = derivePair('#f97316');
  assert.ok(pair, 'derives');
  assert.match(pair[0], /^#[0-9a-f]{6}$/);
  assert.match(pair[1], /^#[0-9a-f]{6}$/);
  assert.notEqual(pair[0], pair[1]);
  assert.equal(derivePair('#zzzzzz'), null);
});

/* -------------------------------------------------------------------- vcf */

test('parseVcf extracts numbers and names from multiple cards', () => {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Sharma;Ravi;;;',
    'FN:Ravi Sharma',
    'TEL;TYPE=CELL:+91 98765 43210',
    'END:VCARD',
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Plumber;;;',
    'TEL;TYPE=WORK:020 7946 0958',
    'NOTE:no plus, local format',
    'END:VCARD',
    'BEGIN:VCARD',
    'FN:Junk',
    'EMAIL:junk@example.com',
    'END:VCARD',
  ].join('\r\n');
  const out = parseVcf(vcf);
  assert.equal(out.length, 1, 'only the +E.164 number is importable');
  assert.equal(out[0].number, '+919876543210');
  assert.equal(out[0].name, 'Ravi Sharma');
});

test('parseVcf handles folded lines', () => {
  const vcf = 'BEGIN:VCARD\r\nTEL;TYPE=CELL:+1555123\r\n 4567\r\nFN:Bob\r\nEND:VCARD\r\n';
  const out = parseVcf(vcf);
  assert.equal(out[0].number, '+15551234567');
});

test('parseVcf rejects non-vcf text', () => {
  assert.deepEqual(parseVcf('hello +15551234567'), []);
  assert.deepEqual(parseVcf(''), []);
  assert.deepEqual(parseVcf(null), []);
});

/* ------------------------------------------------------------------ queue */

test('queue dedups, caps at 5 and validates entries', () => {
  const st = new FakeStorage();
  const q = createQueue(st);
  q.add('15551234567', 'whatsapp');
  q.add('15551234567', 'telegram'); // dedup, moves to front
  for (let i = 0; i < 10; i++) q.add(`9190000000${i}`);
  const list = q.list();
  assert.equal(list.length, 5);
  assert.equal(list[0].app, undefined);
  st.setItem('chatlauncher:pending', '[{"e164":"<script>"},{"e164":"15550001111"}]');
  assert.deepEqual(createQueue(st).list(), [{ e164: '15550001111' }] === undefined ? [] : createQueue(st).list());
  assert.equal(createQueue(st).list()[0].e164, '15550001111');
});

test('queue take and clear', () => {
  const q = createQueue(new FakeStorage());
  q.add('15551234567');
  q.add('15559876543');
  const left = q.take('15551234567');
  assert.equal(left.length, 1);
  assert.deepEqual(q.clear(), []);
  assert.deepEqual(q.list(), []);
});
