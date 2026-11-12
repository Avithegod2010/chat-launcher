/**
 * Pure phone-number helpers. No DOM access — everything here is unit-tested
 * under Node (tests/phone.test.js).
 */
import { matchDialCode, nationalGroups, nationalLengthRange, primaryCountryForDial } from './countries.js';

/**
 * Strip everything except digits.
 * @param {string} s
 */
export function digitsOnly(s) {
  return String(s ?? '').replace(/\D+/g, '');
}

/**
 * Build an E.164 digit string (no '+') from a dial code and a national number.
 *
 * Rules:
 * - formatting characters are dropped
 * - trunk zeros are dropped (Italy famously keeps its leading 0: +39 06 …)
 * - if the user retyped the country code inside the national part, it is
 *   stripped (e.g. dial chip '+91' + typed '919876543210')
 *
 * @param {string} dial country calling code, digits only ('91', '1', …)
 * @param {string} national national number as typed
 * @param {{iso?: string}} [opts] country ISO code for trunk-zero exceptions
 * @returns {string|null} E.164 digits or null when nothing usable remains
 */
export function toE164(dial, national, opts = {}) {
  const cc = digitsOnly(dial);
  let n = digitsOnly(national);
  if (!cc || !n) return null;
  if (n.startsWith(cc) && n.length - cc.length >= 8) {
    n = n.slice(cc.length);
  }
  if (opts.iso !== 'IT' && n.startsWith('0')) {
    n = n.replace(/^0+/, '');
  }
  const e = cc + (n || '');
  return e || null;
}

/**
 * ITU E.164 sanity check on a digit string: 7–15 digits, no leading zero.
 * @param {string} e164 digits only (with country code)
 */
export function isValid(e164) {
  return /^[1-9]\d{6,14}$/.test(e164 ?? '');
}

/**
 * Country-aware validation: checks the national number length against the
 * selected country's numbering plan when we know it, falling back to the
 * generic ITU rule.
 *
 * @param {string} dial country calling code in use
 * @param {string} national national digits as typed
 * @param {string} [iso] country ISO code (enables per-country rules)
 * @returns {{state: 'empty'|'ok'|'short'|'long'|'bad', e164: string|null,
 *            typed: number, min: number, max: number}}
 *  `bad` = generic invalid (leading zero, bad chars, outside 7–15 total).
 */
export function checkNumber(dial, national, iso) {
  const range = nationalLengthRange(iso, digitsOnly(dial));
  const typed = digitsOnly(national).length;
  if (!typed) return { state: 'empty', e164: null, typed: 0, min: range?.[0] ?? 7, max: range?.[1] ?? 15 };
  const e164 = toE164(dial, national, { iso });
  const genericOk = !!e164 && isValid(e164);
  if (range) {
    const [min, max] = range;
    if (typed < min) return { state: 'short', e164, typed, min, max };
    if (typed > max) return { state: 'long', e164, typed, min, max };
    return genericOk
      ? { state: 'ok', e164, typed, min, max }
      : { state: 'bad', e164, typed, min, max };
  }
  if (genericOk) return { state: 'ok', e164, typed, min: 7, max: 15 };
  // Still forming a plausible generic number vs definitely broken.
  return typed + digitsOnly(dial).length <= 15
    ? { state: 'short', e164, typed, min: 7, max: 15 }
    : { state: 'long', e164, typed, min: 7, max: 15 };
}

/**
 * As-you-type grouping for display. Uses the country's own grouping when
 * known (India 98765 43210, US 555 123 4567), otherwise generic chunks of
 * 3 with a stretched final group.
 * ('9876543210' → '987 654 3210' generically, '98765 43210' for IN)
 * @param {string} national digits only
 * @param {string} [iso] country ISO code for country-specific grouping
 * @param {string} [dial] dial code in use (NANP area-aware)
 */
export function formatAsYouType(national, iso, dial) {
  const d = digitsOnly(national);
  if (d.length <= 3) return d;
  const groups = iso ? nationalGroups(iso, digitsOnly(dial ?? '')) : null;
  if (groups && groups.length > 1) {
    const out = [];
    let rest = d;
    for (const size of groups) {
      if (rest.length <= 0) break;
      out.push(rest.slice(0, size));
      rest = rest.slice(size);
      if (rest.length <= 0) break;
    }
    if (rest) out.push(rest);
    // Only honour the country pattern while it still fits the digits typed
    // (a half-typed US number shouldn't get the GB pattern's leftovers).
    if (out.length <= groups.length + 1) return out.join(' ');
  }
  const chunks = [];
  let rest = d;
  while (rest.length > 4) {
    chunks.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  chunks.push(rest);
  return chunks.join(' ');
}

/**
 * Parse a pasted/URL-supplied number into country + national parts by
 * longest-prefix matching against known dial codes.
 *
 * @param {string} input anything the user pasted ('+91 98765 43210', '+16644912345')
 * @returns {{iso: string, dial: string, national: string}|null} null when the
 * input is not an international number we can resolve
 */
export function parsePaste(input) {
  const raw = String(input ?? '').trim();
  const looksInternational =
    raw.startsWith('+') || raw.startsWith('00') || raw.startsWith('011');
  if (!looksInternational) return null;
  const body = digitsOnly(raw).replace(/^(00|011)/, '');
  if (body.length < 8 || body.length > 15) return null;
  const dial = matchDialCode(body);
  if (!dial) return null;
  const national = body.slice(dial.length);
  if (national.length < 4 || national.length > 14) return null;
  const country = primaryCountryForDial(dial);
  if (!country) return null;
  return { iso: country.iso, dial, national };
}
