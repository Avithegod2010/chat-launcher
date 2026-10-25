/**
 * Launch history with an injectable storage backend (tests pass a fake;
 * the app passes localStorage wrapped in try/catch by ui storage helper).
 *
 * Shape stored under `chatlauncher:history`:
 *   [{ e164, label, count, lastUsed, pinned }]
 * Ordered pinned-first, then most recently used. Capped at 50 entries,
 * dropping the oldest unpinned entries first.
 */

const KEY = 'chatlauncher:history';
const CAP = 50;

/**
 * @typedef {{getItem(k: string): string|null, setItem(k: string, v: string): void,
 *            removeItem(k: string): void}} StringStorage
 */

/**
 * @param {StringStorage} storage
 */
export function createHistory(storage) {
  /** Monotonic counter so same-millisecond adds still order correctly. */
  let seq = 0;
  /** @returns {any[]|null} parsed entries, null when unreadable */
  function read() {
    let raw;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return null;
    }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e) =>
          e && typeof e.e164 === 'string' && /^\d{7,15}$/.test(e.e164),
      );
    } catch {
      return []; // corrupt JSON degrades to empty instead of throwing
    }
  }

  /** @param {any[]} entries */
  function write(entries) {
    try {
      storage.setItem(KEY, JSON.stringify(entries));
    } catch {
      /* storage full or blocked — history silently stops persisting */
    }
  }

  /** @param {any[]} entries */
  function sorted(entries) {
    return [...entries].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      if ((b.lastUsed ?? 0) !== (a.lastUsed ?? 0)) {
        return (b.lastUsed ?? 0) - (a.lastUsed ?? 0);
      }
      return (b.seq ?? 0) - (a.seq ?? 0);
    });
  }

  /** @param {any[]} entries */
  function enforceCap(entries) {
    const pinned = entries.filter((e) => e.pinned);
    const rest = entries.filter((e) => !e.pinned).slice(0, CAP - pinned.length);
    return [...pinned, ...rest];
  }

  return {
    /**
     * @param {string} e164
     * @param {string} [label]
     */
    add(e164, label) {
      const entries = read() ?? [];
      const i = entries.findIndex((e) => e.e164 === e164);
      seq++;
      if (i >= 0) {
        entries[i] = {
          ...entries[i],
          count: (entries[i].count ?? 0) + 1,
          lastUsed: Date.now(),
          seq,
          label: label ?? entries[i].label,
        };
      } else {
        entries.push({ e164, label: label || '', count: 1, lastUsed: Date.now(), seq, pinned: false });
      }
      const capped = enforceCap(entries);
      write(capped);
      return sorted(capped);
    },

    /** @returns {any[]} */
    list() {
      return sorted(read() ?? []);
    },

    /** @param {string} e164 */
    pin(e164) {
      const entries = read() ?? [];
      const e = entries.find((x) => x.e164 === e164);
      if (e) {
        e.pinned = true;
        write(entries);
      }
      return sorted(entries);
    },

    /** @param {string} e164 */
    unpin(e164) {
      const entries = read() ?? [];
      const e = entries.find((x) => x.e164 === e164);
      if (e) {
        e.pinned = false;
        write(entries);
      }
      return sorted(entries);
    },

    /** @param {string} e164 */
    remove(e164) {
      const entries = (read() ?? []).filter((e) => e.e164 !== e164);
      write(entries);
      return sorted(entries);
    },

    /**
     * @param {string} e164
     * @param {string} label
     */
    renameLabel(e164, label) {
      const entries = read() ?? [];
      const e = entries.find((x) => x.e164 === e164);
      if (e) {
        e.label = String(label).slice(0, 40);
        write(entries);
      }
      return sorted(entries);
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
