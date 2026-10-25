/**
 * Pure phone-number helpers. No DOM access — everything here is unit-tested
 * under Node (tests/phone.test.js).
 */
import { matchDialCode, primaryCountryForDial } from './countries.js';

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
 * Light as-you-type grouping for display: chunks of 3, with the final chunk
 * stretched to 4 when the remainder would otherwise be 1.
 * ('9876543210' -> '987 654 3210', '1234567' -> '123 4567')
 * @param {string} national digits only
 */
export function formatAsYouType(national) {
  const d = digitsOnly(national);
  if (d.length <= 4) return d;
  const groups = [];
  let rest = d;
  while (rest.length > 4) {
    groups.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  groups.push(rest);
  return groups.join(' ');
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
