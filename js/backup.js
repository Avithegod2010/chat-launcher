/**
 * Backup / restore: serialize app data to a JSON file and validate it back
 * in. Everything is local — export is a download, import is a file read.
 * The importer never trusts its input: shapes are re-checked field by field.
 */
import { countryByIso } from './countries.js';

const FORMAT_VERSION = 1;

/** Strip anything unexpected from a history entry. */
function sanitizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.e164 !== 'string' || !/^\d{7,15}$/.test(e.e164)) return null;
  const out = {
    e164: e.e164,
    label: typeof e.label === 'string' ? e.label.slice(0, 40) : '',
    note: typeof e.note === 'string' ? e.note.slice(0, 80) : '',
    count: Number.isFinite(Number(e.count)) && Number(e.count) > 0 ? Number(e.count) : 1,
    lastUsed: Number.isFinite(Number(e.lastUsed)) ? Number(e.lastUsed) : 0,
    pinned: !!e.pinned,
    app: typeof e.app === 'string' && /^[\w-]{1,24}$/.test(e.app) ? e.app : undefined,
  };
  return out;
}

function sanitizeSettings(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
    country:
      typeof s.country === 'string' && /^[A-Z]{2}$/.test(s.country) && countryByIso(s.country)
        ? s.country
        : null,
    order: Array.isArray(s.order) ? s.order.filter((x) => typeof x === 'string').slice(0, 30) : [],
    disabled: Array.isArray(s.disabled) ? s.disabled.filter((x) => typeof x === 'string').slice(0, 30) : [],
    accent: typeof s.accent === 'string' ? s.accent.slice(0, 40) : 'violet',
  };
}

function sanitizeStats(s) {
  if (!s || typeof s !== 'object') return null;
  const counts = (obj) => {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj)) {
      if (/^[\w-]{1,24}$/.test(k) && Number.isFinite(Number(v)) && Number(v) > 0) out[k] = Number(v);
    }
    return out;
  };
  return {
    total: Math.max(0, Number(s.total) || 0),
    firstUsed: Math.max(0, Number(s.firstUsed) || 0),
    byApp: counts(s.byApp),
    byMonth: counts(s.byMonth),
  };
}

/**
 * @param {{settings?: object, history?: object[], stats?: object}} data
 * @returns {string} pretty JSON ready to download
 */
export function exportData({ settings, history, stats }) {
  return JSON.stringify(
    {
      format: 'chat-launcher-backup',
      version: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      settings: settings ?? null,
      history: Array.isArray(history) ? history : [],
      stats: stats ?? null,
    },
    null,
    2,
  );
}

/**
 * Validate a backup string. Returns the sanitized pieces on success, or
 * {ok:false, error}. Never throws.
 * @param {string} json
 * @returns {{ok: true, settings: object|null, history: object[], stats: object|null}
 *          | {ok: false, error: string}}
 */
export function importData(json) {
  let parsed;
  try {
    parsed = JSON.parse(String(json));
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== 'chat-launcher-backup') {
    return { ok: false, error: 'not-a-chat-launcher-backup' };
  }
  if (Number(parsed.version) > FORMAT_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  const history = (Array.isArray(parsed.history) ? parsed.history : [])
    .map(sanitizeEntry)
    .filter(Boolean)
    .slice(0, 500);
  return {
    ok: true,
    settings: sanitizeSettings(parsed.settings),
    history,
    stats: sanitizeStats(parsed.stats),
  };
}
