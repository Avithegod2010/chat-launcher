/**
 * Launch-target registry: every messenger/telephony platform the app can open.
 *
 * A target is either:
 *  - `full`    — the deep link addresses a specific phone number
 *  - `limited` — the platform has no open-by-number URL, so the link only
 *                opens the app itself (LINE, Threema); shown with a badge
 *
 * All buildUrl() functions are pure and unit-tested (tests/apps.test.js).
 * Message text is passed through encodeURIComponent exactly once, by these
 * functions and nowhere else.
 */

import { BRAND_PATHS } from './brand-icons.js';

/** Render a real brand glyph (Simple Icons path) as a fill SVG. */
const brand = (key) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BRAND_PATHS[key]}"/></svg>`;

/**
 * @param {string} e164 digits only, with country code, no '+'
 * @returns {string} the number with a literal '+'
 */
const plus = (e164) => `+${e164}`;

/** Apple platforms join sms body params with '&' (no query string before it). */
export function isAppleDevice(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /iPhone|iPad|iPod|Macintosh/i.test(userAgent);
}

/**
 * @typedef {{id: string, name: string, color: string, capability: 'full'|'limited',
 *            supportsMessage: boolean, note?: string,
 *            icon: string,
 *            buildUrl: (e164: string, message?: string, opts?: {isApple?: boolean}) => string}} LaunchTarget
 */

/** @type {LaunchTarget[]} */
export const APPS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '#25d366',
    capability: 'full',
    supportsMessage: true,
    icon: brand('whatsapp'),
    buildUrl: (e164, message) =>
      message
        ? `https://wa.me/${e164}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${e164}`,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#26a5e4',
    capability: 'full',
    supportsMessage: false,
    icon: brand('telegram'),
    buildUrl: (e164) => `https://t.me/${plus(e164)}`,
  },
  {
    id: 'signal',
    name: 'Signal',
    color: '#3b45fd',
    capability: 'full',
    supportsMessage: false,
    icon: brand('signal'),
    buildUrl: (e164) => `https://signal.me/#p/${encodeURIComponent(plus(e164))}`,
  },
  {
    id: 'sms',
    name: 'SMS',
    color: '#8b5cf6',
    capability: 'full',
    supportsMessage: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>`,
    buildUrl: (e164, message, opts = {}) => {
      const base = `sms:${plus(e164)}`;
      if (!message) return base;
      const sep = opts.isApple ?? isAppleDevice() ? '&' : '?';
      return `${base}${sep}body=${encodeURIComponent(message)}`;
    },
  },
  {
    id: 'call',
    name: 'Call',
    color: '#14b8a6',
    capability: 'full',
    supportsMessage: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>`,
    buildUrl: (e164) => `tel:${plus(e164)}`,
  },
  {
    id: 'viber',
    name: 'Viber',
    color: '#7360f2',
    capability: 'full',
    supportsMessage: false,
    icon: brand('viber'),
    buildUrl: (e164) => `viber://chat?number=${encodeURIComponent(plus(e164))}`,
  },
  {
    id: 'skype',
    name: 'Skype',
    color: '#00aff0',
    capability: 'full',
    supportsMessage: false,
    note: 'Skype was retired by Microsoft in 2025; the tile is kept for legacy installs.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 1 7.7 10.2A5 5 0 0 1 14 20a8 8 0 0 1-9.7-10.2A5 5 0 0 1 12 4Z"/><path d="M9.5 10.5c0-1.4 1.1-2.2 2.6-2.2 1.4 0 2.4.7 2.4 1.8 0 2.4-4.4 1.6-4.4 3.7 0 1 1 1.7 2.4 1.7 1.5 0 2.6-.8 2.6-2.1M9.5 10.5c-.9.5-1.2 1.4-1 2.3m7-2.1c.8.5 1 1.4.7 2.3"/></svg>`,
    buildUrl: (e164) => `skype:${plus(e164)}?chat`,
  },
  {
    id: 'line',
    name: 'LINE',
    color: '#00c300',
    capability: 'limited',
    supportsMessage: false,
    note: 'LINE has no open-by-phone link; it opens the app and you pick the chat.',
    icon: brand('line'),
    buildUrl: () => 'line://',
  },
  {
    id: 'threema',
    name: 'Threema',
    color: '#3fe669',
    capability: 'limited',
    supportsMessage: false,
    note: 'Threema matches contacts itself; the link just opens the app.',
    icon: brand('threema'),
    buildUrl: () => 'threema://',
  },
];

/** Default display order = the order above. */
export const DEFAULT_ORDER = APPS.map((a) => a.id);

/** @param {string} id */
export function getApp(id) {
  return APPS.find((a) => a.id === id) ?? null;
}
