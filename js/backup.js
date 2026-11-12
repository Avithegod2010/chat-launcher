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
  const avatar = cleanAvatar(e.avatar);
  if (avatar) out.avatar = avatar;
  return out;
}

const AVATAR_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Contact thumbnails ride along as small data URLs. */
function cleanAvatar(v) {
  return typeof v === 'string' && v.length <= 12000 && AVATAR_RE.test(v) ? v : undefined;
}

function sanitizeSettings(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
    textScale: s.textScale === 'large' ? 'large' : 'normal',
    contrast: s.contrast === 'high' ? 'high' : 'normal',
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
 * @param {{settings?: object, history?: object[], stats?: object,
 *          templates?: object[], lists?: object[]}} data
 * @returns {string} pretty JSON ready to download
 */
export function exportData({ settings, history, stats, templates, lists }) {
  return JSON.stringify(
    {
      format: 'chat-launcher-backup',
      version: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      settings: settings ?? null,
      history: Array.isArray(history) ? history : [],
      stats: stats ?? null,
      templates: Array.isArray(templates) ? templates : [],
      lists: Array.isArray(lists) ? lists : [],
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
    templates: sanitizeTemplates(parsed.templates),
    lists: sanitizeLists(parsed.lists),
  };
}

/** Templates and lists ride along in v1 backups too (optional sections). */
function sanitizeTemplates(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .slice(0, 30)
    .map((t) => ({
      id: typeof t.id === 'string' && t.id ? t.id.slice(0, 24) : `t${Math.random().toString(36).slice(2, 10)}`,
      name: typeof t.name === 'string' ? t.name.slice(0, 40) : 'Template',
      text: t.text.slice(0, 500),
      ...(typeof t.appId === 'string' && /^[\w-]{1,24}$/.test(t.appId) ? { appId: t.appId } : {}),
    }));
}

function sanitizeLists(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).map((l, i) => ({
    id: typeof l?.id === 'string' && l.id ? l.id.slice(0, 24) : `l${i}`,
    name: typeof l?.name === 'string' ? l.name.slice(0, 40) : 'List',
    created: Number(l?.created) || 0,
    items: (Array.isArray(l?.items) ? l.items : [])
      .filter((it) => it && /^\d{7,15}$/.test(String(it?.e164)))
      .slice(0, 200)
      .map((it) => ({
        e164: String(it.e164),
        label: typeof it.label === 'string' ? it.label.slice(0, 40) : '',
      })),
  }));
}
