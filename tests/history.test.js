import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../js/history.js';

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

const N1 = '919876543210';
const N2 = '15551234567';
const N3 = '442079460958';

test('add dedups by number and bumps the count', () => {
  const h = createHistory(new FakeStorage());
  h.add(N1);
  h.add(N2);
  const list = h.add(N1);
  assert.equal(list.length, 2);
  const n1 = list.find((e) => e.e164 === N1);
  assert.equal(n1.count, 2);
});

test('list is most-recent-first', () => {
  const h = createHistory(new FakeStorage());
  h.add(N1);
  h.add(N2);
  h.add(N3);
  assert.deepEqual(
    h.list().map((e) => e.e164),
    [N3, N2, N1],
  );
});

test('pinned entries float to the top', () => {
  const h = createHistory(new FakeStorage());
  h.add(N1);
  h.add(N2);
  h.add(N3);
  const list = h.pin(N1);
  assert.equal(list[0].e164, N1);
  const list2 = h.unpin(N1);
  assert.notEqual(list2[0].e164, N1);
});

test('cap keeps 50 entries, dropping oldest unpinned first', () => {
  const h = createHistory(new FakeStorage());
  for (let i = 0; i < 60; i++) h.add(`91000000${String(i).padStart(3, '0')}`);
  assert.equal(h.list().length, 50);
  h.pin('91000000000'); // oldest entry, pinned
  for (let i = 60; i < 80; i++) h.add(`91000000${String(i).padStart(3, '0')}`);
  const list = h.list();
  assert.equal(list.length, 50);
  assert.ok(list.some((e) => e.e164 === '91000000000'), 'pinned entry survives the cap');
});

test('corrupt JSON degrades to empty instead of throwing', () => {
  const s = new FakeStorage();
  s.setItem('chatlauncher:history', '{broken json,,');
  const h = createHistory(s);
  assert.deepEqual(h.list(), []);
  const list = h.add(N1);
  assert.equal(list.length, 1);
});

test('malformed entries are filtered out on read', () => {
  const s = new FakeStorage();
  s.setItem(
    'chatlauncher:history',
    JSON.stringify([{ e164: 'not-a-number' }, { e164: N1, count: 2 }, null, 42]),
  );
  const h = createHistory(s);
  assert.deepEqual(
    h.list().map((e) => e.e164),
    [N1],
  );
});

test('rename, remove and clear', () => {
  const h = createHistory(new FakeStorage());
  h.add(N1);
  h.add(N2);
  h.renameLabel(N1, 'Pizza place');
  assert.equal(h.list().find((e) => e.e164 === N1).label, 'Pizza place');
  h.remove(N1);
  assert.equal(h.list().length, 1);
  assert.deepEqual(h.clear(), []);
  assert.deepEqual(h.list(), []);
});

test('rename is clamped to 40 chars', () => {
  const h = createHistory(new FakeStorage());
  h.add(N1);
  h.renameLabel(N1, 'x'.repeat(80));
  assert.equal(h.list()[0].label.length, 40);
});

test('persisted across instances through the same storage', () => {
  const s = new FakeStorage();
  createHistory(s).add(N1);
  const h2 = createHistory(s);
  assert.equal(h2.list()[0].e164, N1);
});
