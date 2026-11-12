/**
 * Message templates: reusable pre-filled messages with {variables}.
 * Stored under `chatlauncher:templates`:
 *   [{ id, name, text, appId? }] — appId optionally scopes a template to one app.
 */

const KEY = 'chatlauncher:templates';
const CAP = 30;
const NAME_CAP = 40;
const TEXT_CAP = 500;

/** @typedef {{getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void}} StringStorage */

/** Variables a template may reference. */
const VARIABLE_RE = /\{(name|number|app|date|time)\}/g;

/**
 * Expand `{name}`, `{number}`, `{app}`, `{date}`, `{time}` in a template.
 * Unknown `{placeholders}` are left untouched so users never lose text.
 * @param {string} text
 * @param {{name?: string, number?: string, app?: string, now?: Date}} [vars]
 */
export function expandTemplate(text, vars = {}) {
  const now = vars.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return String(text ?? '').replace(VARIABLE_RE, (m, key) => {
    if (key === 'date') return date;
    if (key === 'time') return time;
    const v = vars[key];
    return v == null || v === '' ? m : String(v);
  });
}

/** @param {StringStorage} storage */
export function createTemplates(storage) {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (t) => t && typeof t.id === 'string' && typeof t.text === 'string',
      );
    } catch {
      return [];
    }
  }

  function write(list) {
    try {
      storage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage blocked — templates stay in memory for the session */
    }
  }

  return {
    /** @returns {any[]} */
    list() {
      return read();
    },

    /**
     * Create or update a template. Returns the stored template, or null when
     * the input is unusable.
     * @param {{id?: string, name: string, text: string, appId?: string|null}} t
     */
    save(t) {
      if (!t || typeof t.text !== 'string' || !t.text.trim()) return null;
      const name = String(t.name ?? '').trim().slice(0, NAME_CAP) || 'Template';
      const entry = {
        id:
          typeof t.id === 'string' && t.id
            ? t.id
            : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name,
        text: t.text.slice(0, TEXT_CAP),
      };
      if (typeof t.appId === 'string' && /^[\w-]{1,24}$/.test(t.appId)) entry.appId = t.appId;
      const list = read();
      const i = list.findIndex((x) => x.id === entry.id);
      if (i >= 0) list[i] = entry;
      else if (list.length >= CAP) list.shift();
      else list.push(entry);
      write(list);
      return entry;
    },

    /** @param {string} id */
    remove(id) {
      const list = read().filter((t) => t.id !== id);
      write(list);
      return list;
    },

    /** Replace all (backup/sync import). */
    replaceAll(list) {
      const clean = (Array.isArray(list) ? list : [])
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .map((t) => ({
          id: typeof t.id === 'string' && t.id ? t.id.slice(0, 24) : `t${Math.random().toString(36).slice(2, 10)}`,
          name: String(t.name ?? 'Template').slice(0, NAME_CAP),
          text: t.text.slice(0, TEXT_CAP),
          ...(typeof t.appId === 'string' && /^[\w-]{1,24}$/.test(t.appId) ? { appId: t.appId } : {}),
        }))
        .slice(0, CAP);
      write(clean);
      return clean;
    },

    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      return [];
    },
  };
}
