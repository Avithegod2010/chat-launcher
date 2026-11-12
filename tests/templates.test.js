import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplates, expandTemplate } from '../js/templates.js';

const mem = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
};

test('expandTemplate substitutes known variables and keeps unknown ones', () => {
  const out = expandTemplate('Hi {name} ({number}) via {app} on {date} {time}', {
    name: 'Ada',
    number: '+15551234567',
    app: 'WhatsApp',
    now: new Date('2026-11-12T10:30:00Z'),
  });
  assert.ok(out.includes('Ada'));
  assert.ok(out.includes('+15551234567'));
  assert.ok(out.includes('WhatsApp'));
  assert.ok(out.includes('2026-11-12'));
  assert.ok(!out.includes('{name}'));
});

test('expandTemplate leaves unknown placeholders and missing vars intact', () => {
  assert.equal(expandTemplate('Hello {name} and {unknown}', {}), 'Hello {name} and {unknown}');
  assert.equal(expandTemplate('no vars here'), 'no vars here');
});

test('save creates, updates and caps templates', () => {
  const t = createTemplates(mem());
  const a = t.save({ name: 'Greeting', text: 'Hi {name}!' });
  assert.ok(a.id);
  t.save({ id: a.id, name: 'Greeting 2', text: 'Hello!' });
  assert.equal(t.list().length, 1);
  assert.equal(t.list()[0].text, 'Hello!');
  for (let i = 0; i < 40; i++) t.save({ name: `T${i}`, text: 'x' });
  assert.ok(t.list().length <= 30, 'capped at 30');
});

test('save rejects empty text and sanitizes fields', () => {
  const t = createTemplates(mem());
  assert.equal(t.save({ name: 'x', text: '   ' }), null);
  const saved = t.save({ name: '  '.repeat(60) + 'Ok', text: 'y'.repeat(900) });
  assert.ok(saved.name.length <= 40);
  assert.ok(saved.text.length <= 500);
});

test('remove and replaceAll round-trip', () => {
  const t = createTemplates(mem());
  const a = t.save({ name: 'A', text: 'a' });
  const b = t.save({ name: 'B', text: 'b', appId: 'whatsapp;;;' });
  assert.equal(b.appId, undefined, 'hostile appId dropped');
  t.remove(a.id);
  assert.equal(t.list().length, 1);
  t.replaceAll([{ id: 'z', text: 'valid' }, null, { text: '   ' }, { id: 'q', text: 'ok' }]);
  assert.equal(t.list().length, 2);
  assert.deepEqual(t.list().map((x) => x.id).sort(), ['q', 'z']);
});

test('corrupt storage degrades to empty', () => {
  const s = mem();
  s.setItem('chatlauncher:templates', '{not json');
  assert.deepEqual(createTemplates(s).list(), []);
});
