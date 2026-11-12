import test from 'node:test';
import assert from 'node:assert/strict';
import { createLists, parseCsv, toCsv, parseMembers } from '../js/lists.js';

const mem = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
};

test('parseCsv handles quotes, embedded commas and CRLF', () => {
  const rows = parseCsv('name,number\r\n"Doe, Jane",+15551234567\r\nBob,+15552223333');
  assert.deepEqual(rows, [
    ['name', 'number'],
    ['Doe, Jane', '+15551234567'],
    ['Bob', '+15552223333'],
  ]);
  assert.deepEqual(parseCsv('"say ""hi""",x'), [['say "hi"', 'x']]);
  assert.deepEqual(parseCsv(''), []);
});

test('toCsv quotes dangerous cells and round-trips through parseCsv', () => {
  const csv = toCsv([['a', 'b,c'], ['say "x"', 'd']]);
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [['a', 'b,c'], ['say "x"', 'd']]);
});

test('parseMembers extracts label/number pairs from mixed text', () => {
  const members = parseMembers(
    ['Ada, +15551234567', 'Bob <15552223333>', 'not a number', '+91 98765 43210'].join('\n'),
  );
  assert.equal(members.length, 3);
  assert.equal(members[0].label, 'Ada');
  assert.equal(members[0].e164, '15551234567');
  assert.equal(members[2].label, '', 'bare number has no label');
  assert.equal(members[2].e164, '919876543210');
  // dedupes by number
  const dup = parseMembers('+15551234567\n15551234567');
  assert.equal(dup.length, 1);
});

test('lists CRUD: create, add, dedupe, rename, remove', () => {
  const l = createLists(mem());
  const team = l.create('Team', [{ e164: '15551234567', label: 'Ada' }]);
  l.addItem(team.id, { e164: '919876543210' });
  l.addItem(team.id, { e164: '15551234567' }); // duplicate ignored
  assert.equal(l.get(team.id).items.length, 2);
  l.rename(team.id, 'Team X');
  assert.equal(l.get(team.id).name, 'Team X');
  l.removeItem(team.id, '15551234567');
  assert.equal(l.get(team.id).items.length, 1);
  l.remove(team.id);
  assert.equal(l.get(team.id), null);
});

test('create rejects junk numbers and enforces caps', () => {
  const l = createLists(mem());
  const bad = l.create('Bad', [{ e164: '123' }, { e164: 'nope' }, { e164: '15551234567' }]);
  assert.equal(bad.items.length, 1);
  // Fill one list past its member cap before hitting the list cap.
  const one = l.create('One');
  for (let i = 0; i < 250; i++) l.addItem(one.id, { e164: `15551${String(i).padStart(6, '0')}` });
  assert.ok(one.items.length <= 200);
  for (let i = 0; i < 25; i++) l.create(`L${i}`);
  assert.ok(l.list().length <= 20);
});

test('replaceAll is a strict sanitizer', () => {
  const l = createLists(mem());
  const clean = l.replaceAll([
    { id: 'ok', name: 'Ok', items: [{ e164: '15551234567', label: 'x'.repeat(99) }] },
    { evil: true },
    null,
    { name: 'NoNums', items: [{ e164: '1' }, 'junk'] },
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].items[0].label.length, 40);
  assert.equal(clean[1].items.length, 0);
});

test('corrupt storage degrades to empty', () => {
  const s = mem();
  s.setItem('chatlauncher:lists', '[{broken');
  assert.deepEqual(createLists(s).list(), []);
});
