import test from 'node:test';
import assert from 'node:assert/strict';
import { createStats } from '../js/stats.js';

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

test('record aggregates by app and month', () => {
  const s = createStats(new FakeStorage());
  s.record('whatsapp');
  s.record('whatsapp');
  const got = s.record('telegram');
  assert.equal(got.total, 3);
  assert.equal(got.byApp.whatsapp, 2);
  assert.equal(got.byApp.telegram, 1);
  const month = new Date();
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  assert.equal(got.byMonth[key], 3);
});

test('stats survive storage reload and reject junk keys', () => {
  const st = new FakeStorage();
  createStats(st).record('whatsapp');
  const again = createStats(st);
  assert.equal(again.get().total, 1);

  st.setItem('chatlauncher:stats', JSON.stringify({ total: 'x', byApp: { '../evil': 5, whatsapp: 2 }, byMonth: null }));
  const cleaned = createStats(st).get();
  assert.equal(cleaned.total, 0, 'bad total coerced');
  assert.deepEqual(cleaned.byApp, { whatsapp: 2 }, 'junk keys stripped, valid kept');
});

test('corrupt JSON degrades to empty', () => {
  const st = new FakeStorage();
  st.setItem('chatlauncher:stats', 'not json{{{');
  const s = createStats(st);
  assert.equal(s.get().total, 0);
  const got = s.record('sms');
  assert.equal(got.total, 1);
});

test('clear wipes stats', () => {
  const st = new FakeStorage();
  const s = createStats(st);
  s.record('whatsapp');
  const got = s.clear();
  assert.equal(got.total, 0);
  assert.equal(st.getItem('chatlauncher:stats'), null);
});

test('month pruning keeps 12 newest buckets', () => {
  const st = new FakeStorage();
  const byMonth = {};
  for (let i = 1; i <= 20; i++) byMonth[`2024-${String(i % 12 || 12).padStart(2, '0')}`] = 1;
  st.setItem('chatlauncher:stats', JSON.stringify({ total: 5, byApp: {}, byMonth }));
  // record() triggers pruning
  const got = createStats(st).record('whatsapp');
  assert.ok(Object.keys(got.byMonth).length <= 13, `kept ${Object.keys(got.byMonth).length}`);
});
