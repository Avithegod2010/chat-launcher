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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z"/><path d="M9 8.5c0 4 2.5 6.5 6.5 6.5l.9-1.8-2-1-1 1c-1.2-.6-2-1.4-2.6-2.6l1-1-1-2L9 8.5Z" fill="currentColor" stroke="none"/></svg>`,
    buildUrl: (e164, message) =>
      message
        ? `https://wa.me/${e164}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${e164}`,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#229ed9',
    capability: 'full',
    supportsMessage: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4 3.4 10.7c-.8.3-.8 1.4 0 1.7l4.6 1.6L9.9 19c.2.7 1.1.9 1.6.3l2.4-2.9 4.3 3.2c.6.4 1.4.1 1.6-.6L22 5c.2-.8-.6-1.4-1-1Z"/><path d="m7.5 14.6 10-7.6-7.3 8.6-.3 3"/></svg>`,
    buildUrl: (e164) => `https://t.me/${plus(e164)}`,
  },
  {
    id: 'signal',
    name: 'Signal',
    color: '#3a76f0',
    capability: 'full',
    supportsMessage: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 5.5v5c0 4.5 2.8 7.9 7 10 4.2-2.1 7-5.5 7-10v-5L12 3Z"/><path d="M9 12h6M9 12l2-2m-2 2 2 2" stroke-width="1.5"/></svg>`,
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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z"/><path d="M9.5 9c.2 2.6 2.9 5.3 5.5 5.5l.7-1.6-1.9-.9-.8.8a7 7 0 0 1-1.8-1.8l.8-.8-.9-1.9L9.5 9Z" fill="currentColor" stroke="none"/></svg>`,
    buildUrl: (e164) => `viber://chat?number=${encodeURIComponent(plus(e164))}`,
  },
  {
    id: 'skype',
    name: 'Skype',
    color: '#00aff0',
    capability: 'full',
    supportsMessage: false,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 1 7.7 10.2A5 5 0 0 1 14 20a8 8 0 0 1-9.7-10.2A5 5 0 0 1 12 4Z" transform="translate(0 0)"/><path d="M9.5 10.5c0-1.4 1.1-2.2 2.6-2.2 1.4 0 2.4.7 2.4 1.8 0 2.4-4.4 1.6-4.4 3.7 0 1 1 1.7 2.4 1.7 1.5 0 2.6-.8 2.6-2.1M9.5 10.5c-.9.5-1.2 1.4-1 2.3m7-2.1c.8.5 1 1.4.7 2.3"/></svg>`,
    buildUrl: (e164) => `skype:${plus(e164)}?chat`,
  },
  {
    id: 'line',
    name: 'LINE',
    color: '#06c755',
    capability: 'limited',
    supportsMessage: false,
    note: 'LINE has no open-by-phone link; it opens the app and you pick the chat.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="12" rx="4"/><path d="M8 20l2.5-3.5"/><path d="M8 9.5h8M8 12.5h5"/></svg>`,
    buildUrl: () => 'line://',
  },
  {
    id: 'threema',
    name: 'Threema',
    color: '#05a63f',
    capability: 'limited',
    supportsMessage: false,
    note: 'Threema matches contacts itself; the link just opens the app.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3 8.2 7.5 10 4.5-1.8 7.5-5.4 7.5-10V6L12 3Z"/><circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg>`,
    buildUrl: () => 'threema://',
  },
];

/** Default display order = the order above. */
export const DEFAULT_ORDER = APPS.map((a) => a.id);

/** @param {string} id */
export function getApp(id) {
  return APPS.find((a) => a.id === id) ?? null;
}
