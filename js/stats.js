/**
 * Local-only launch statistics. Mirrors what the user does into a tiny
 * on-device aggregate — nothing ever leaves the browser. Stored under
 * `chatlauncher:stats`:
 *   { total, firstUsed, byApp: {whatsapp: n, …}, byMonth: {'2026-10': n, …} }
 */

const KEY = 'chatlauncher:stats';
const KEEP_MONTHS = 12;

/** @typedef {{getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void}} StringStorage */

const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * @param {StringStorage} storage
 */
export function createStats(storage) {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        total: Number(parsed.total) || 0,
        firstUsed: Number(parsed.firstUsed) || Date.now(),
        byApp: cleanCounts(parsed.byApp),
        byMonth: cleanCounts(parsed.byMonth),
      };
    } catch {
      return null;
    }
  }

  /** strips junk keys and coerces counts */
  function cleanCounts(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj)) {
      if (/^[\w-]{1,24}$/.test(k) && Number.isFinite(Number(v)) && Number(v) > 0) {
        out[k] = Number(v);
      }
    }
    return out;
  }

  function write(stats) {
    try {
      storage.setItem(KEY, JSON.stringify(stats));
    } catch {
      /* storage blocked — stats stay in memory for the session */
    }
  }

  /** Prune to the newest KEEP_MONTHS entries. */
  function pruneMonths(byMonth) {
    const keys = Object.keys(byMonth).sort().slice(-KEEP_MONTHS);
    const out = {};
    for (const k of keys) out[k] = byMonth[k];
    return out;
  }

  return {
    /**
     * @param {string} appId launch target that was opened
     * @returns {object} the updated aggregate
     */
    record(appId) {
      const s = read() ?? { total: 0, firstUsed: Date.now(), byApp: {}, byMonth: {} };
      s.total += 1;
      if (!/^[\w-]{1,24}$/.test(appId)) return s;
      s.byApp[appId] = (s.byApp[appId] ?? 0) + 1;
      const mk = monthKey(Date.now());
      s.byMonth[mk] = (s.byMonth[mk] ?? 0) + 1;
      s.byMonth = pruneMonths(s.byMonth);
      write(s);
      return s;
    },

    /** @returns {object} */
    get() {
      return read() ?? { total: 0, firstUsed: Date.now(), byApp: {}, byMonth: {} };
    },

    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      return { total: 0, firstUsed: Date.now(), byApp: {}, byMonth: {} };
    },
  };
}
