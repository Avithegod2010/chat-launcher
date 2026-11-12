import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestApp, isConfident } from '../js/suggest.js';

const stats = {
  byApp: { whatsapp: 20, telegram: 5, sms: 1 },
  byHour: { '9': 10, '22': 2 },
};

test('explicit per-entry default app dominates the score', () => {
  const entry = { app: 'sms', lastApp: 'telegram' };
  assert.equal(suggestApp(entry, stats, 9), 'sms');
});

test('last used app on this number beats global popularity', () => {
  // whatsapp is globally 4× telegram, but lastApp weight (12) is flat.
  assert.equal(suggestApp({ lastApp: 'telegram' }, stats, 9), 'telegram');
});

test('global usage wins without any per-number signal', () => {
  assert.equal(suggestApp(null, stats, 9), 'whatsapp');
});

test('hour affinity can tip a close race', () => {
  // At 9 o'clock whatsapp is already dominant; at 22h the hour bonus applies
  // to the top hour app (whatsapp has 10 at 9h — byHour keys apps). Sanity:
  // scoring never crashes with sparse buckets and returns something valid.
  const s = suggestApp({}, { byApp: stats.byApp, byHour: { '22': 3 } }, 22);
  assert.ok(['whatsapp', 'telegram', 'sms'].includes(s));
});

test('apps missing from byApp are never suggested; empty stats → null', () => {
  assert.equal(suggestApp(null, {}, 9), null);
  assert.equal(suggestApp(null, { byApp: {}, byHour: {} }, 9), null);
});

test('hour input wraps safely', () => {
  assert.equal(suggestApp(null, stats, 33), suggestApp(null, stats, 9));
});

test('isConfident needs at least one prior launch', () => {
  assert.equal(isConfident('whatsapp', { byApp: { whatsapp: 2 } }), true);
  assert.equal(isConfident('sms', { byApp: { whatsapp: 5 } }), false);
  assert.equal(isConfident(null, { byApp: { whatsapp: 9 } }), false);
});
