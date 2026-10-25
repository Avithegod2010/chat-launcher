import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, countriesByDial, countryByIso, flagOf, matchDialCode } from '../js/countries.js';

test('ISO codes are unique uppercase pairs', () => {
  const isos = COUNTRIES.map((c) => c.iso);
  assert.equal(new Set(isos).size, COUNTRIES.length, 'no duplicates');
  for (const c of COUNTRIES) {
    assert.match(c.iso, /^[A-Z]{2}$/, `${c.iso} format`);
    assert.ok(c.name.length > 1, `${c.iso} has a name`);
    assert.match(c.dial, /^\d{1,4}$/, `${c.iso} dial '${c.dial}' is 1-4 digits`);
  }
});

test('spot checks on well-known codes', () => {
  assert.equal(countryByIso('US').dial, '1');
  assert.equal(countryByIso('IN').dial, '91');
  assert.equal(countryByIso('GB').dial, '44');
  assert.equal(countryByIso('MS').dial, '1664', 'Montserrat area code');
  assert.equal(countryByIso('IT').dial, '39');
});

test('lookups round-trip', () => {
  for (const c of COUNTRIES.slice(0, 60)) {
    assert.equal(countryByIso(c.iso).name, c.name);
    assert.ok(countriesByDial(c.dial).some((x) => x.iso === c.iso));
  }
});

test('flagOf produces regional-indicator emoji', () => {
  const flag = flagOf('IN');
  assert.equal([...flag].length, 2);
  const cps = [...flag].map((ch) => ch.codePointAt(0));
  assert.deepEqual(cps, [0x1f1ee, 0x1f1f3]);
  assert.equal(flagOf('us'), flagOf('US'), 'case-insensitive');
});

test('matchDialCode prefers the longest prefix', () => {
  assert.equal(matchDialCode('16644912345'), '1664');
  assert.equal(matchDialCode('919876543210'), '91');
  assert.equal(matchDialCode('15551234567'), '1');
  assert.equal(matchDialCode('9999'), null, 'unknown code');
  assert.equal(matchDialCode('91'), null, 'bare dial code with no number');
});

test('the dataset covers the major zones', () => {
  assert.ok(COUNTRIES.length >= 200, `have ${COUNTRIES.length} entries`);
  for (const iso of ['CN', 'RU', 'BR', 'NG', 'JP', 'DE', 'AU', 'ZA', 'AE', 'SG']) {
    assert.ok(countryByIso(iso), `${iso} present`);
  }
});
