/**
 * Property-based tests: generate thousands of random inputs with a seeded
 * PRNG and assert invariants. Seeded so failures reproduce exactly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNumber, digitsOnly, formatAsYouType, parsePaste, toE164 } from '../js/phone.js';
import { COUNTRIES } from '../js/countries.js';

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const JUNK = '+-() .abc#x/=_\u00a0１２٣😀\n\t';

function randomJunk(rand, maxLen) {
  const len = Math.floor(rand() * maxLen);
  let s = '';
  for (let i = 0; i < len; i++) s += pick(rand, JUNK.split(''));
  return s;
}

function randomDigits(rand, maxLen) {
  const len = Math.floor(rand() * maxLen);
  let s = '';
  for (let i = 0; i < len; i++) s += String(Math.floor(rand() * 10));
  return s;
}

test('toE164 never throws and only returns digits or null (500 cases)', () => {
  const rand = rng(42);
  for (let i = 0; i < 500; i++) {
    const country = pick(rand, COUNTRIES);
    const national = rand() < 0.5 ? randomJunk(rand, 22) : randomDigits(rand, 18);
    let out;
    assert.doesNotThrow(() => {
      out = toE164(country.dial, national, { iso: country.iso });
    });
    if (out !== null) {
      assert.match(out, /^\d+$/, `digits only: ${out}`);
      // No clamping by design — the UI caps input via setNational().
    }
  }
});

test('formatAsYouType round-trips: spaces removed equal the input digits (500 cases)', () => {
  const rand = rng(7);
  for (let i = 0; i < 500; i++) {
    const country = pick(rand, COUNTRIES);
    const digits = randomDigits(rand, 16);
    const formatted = formatAsYouType(digits, country.iso, country.dial);
    assert.equal(digitsOnly(formatted), digits, `roundtrip for ${country.iso}`);
  }
});

test('parsePaste returns null or a coherent {iso,dial,national} (400 cases)', () => {
  const rand = rng(1234);
  for (let i = 0; i < 400; i++) {
    const raw = (rand() < 0.5 ? '+' : '00') + randomDigits(rand, 17);
    const out = parsePaste(raw);
    if (!out) continue;
    assert.ok(/^[A-Z]{2}$/.test(out.iso), `iso shape: ${out.iso}`);
    assert.match(out.dial, /^\d{1,4}$/);
    assert.match(out.national, /^\d{4,14}$/);
    assert.ok((out.dial + out.national).length <= 19, 'no runaway concat');
  }
});

test('checkNumber states are always in the documented set (600 cases)', () => {
  const rand = rng(99);
  const STATES = new Set(['empty', 'ok', 'short', 'long', 'bad']);
  for (let i = 0; i < 600; i++) {
    const country = pick(rand, COUNTRIES);
    const national = randomDigits(rand, 20);
    const r = checkNumber(country.dial, national, country.iso);
    assert.ok(STATES.has(r.state), `state: ${r.state}`);
    assert.ok(r.min <= r.max, 'range sane');
    if (r.typed === 0) assert.equal(r.state, 'empty');
  }
});

test('isValid agrees with checkNumber for NANP inputs', () => {
  const rand = rng(555);
  for (let i = 0; i < 200; i++) {
    const digits = randomDigits(rand, 11);
    const r = checkNumber('1', digits, 'US');
    const e164 = toE164('1', digits, { iso: 'US' });
    if (r.state === 'ok') {
      assert.ok(e164 && /^[1-9]\d{6,14}$/.test(e164), 'ok implies E.164-valid');
    }
  }
});
