import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, availableLangs, t } from '../js/i18n.js';

test('every language exposes exactly the en key set', () => {
  // t() falls back to en, so a missing key would silently show English —
  // this keeps every table honest against the source of truth.
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.ok(enKeys.length > 150, `en table looks complete (${enKeys.length} keys)`);
  for (const lang of availableLangs) {
    const keys = Object.keys(STRINGS[lang]).sort();
    assert.deepEqual(keys, enKeys, `${lang} key set matches en`);
    for (const k of keys) {
      assert.equal(typeof STRINGS[lang][k], 'string', `${lang}.${k} is a string`);
      assert.ok(STRINGS[lang][k].length > 0, `${lang}.${k} is non-empty`);
    }
  }
});

test('all 12 languages are registered', () => {
  assert.deepEqual(
    [...availableLangs].sort(),
    ['ar', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'mr', 'pt', 'ru', 'ta'],
  );
});

test('placeholders survive every translation', () => {
  // {vars} are interpolated positionally — every table must keep them.
  const withVars = [
    'numberShort', 'numberLong', 'countryDetected', 'bulkBlockedPopup', 'usageTotal',
    'usageMonth', 'backupImported', 'contactsImported', 'unusualLength', 'themeNow',
    'listCount', 'listImported', 'syncMerged', 'syncFail', 'syncLast', 'scheduleSummary',
  ];
  for (const lang of availableLangs) {
    for (const key of withVars) {
      const s = STRINGS[lang][key];
      assert.match(s, /\{\w+\}/, `${lang}.${key} keeps at least one {var}`);
    }
  }
});

test('t() interpolates variables', () => {
  const s = t('numberShort', { n: 10, country: 'India', typed: 7 });
  assert.ok(s.includes('10'), 'includes n');
  assert.ok(s.includes('India'), 'includes country');
  assert.ok(s.includes('7'), 'includes typed');
  assert.ok(!s.includes('{'), 'no leftover braces');
});

test('t() falls back to the key for unknown ids', () => {
  assert.equal(t('nope.not.a.key'), 'nope.not.a.key');
});
