/**
 * Offline launch queue: numbers shared into the app while offline wait
 * here until connectivity returns, then the UI offers a one-tap launch.
 * Stored under `chatlauncher:pending`.
 */

const KEY = 'chatlauncher:pending';
const CAP = 5;

/** @typedef {{getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void}} StringStorage */

/**
 * @param {StringStorage} storage
 */
export function createQueue(storage) {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (e) =>
            e &&
            typeof e.e164 === 'string' &&
            /^\d{7,15}$/.test(e.e164) &&
            (e.app === undefined || /^[\w-]{1,24}$/.test(e.app)),
        )
        .slice(0, CAP);
    } catch {
      return [];
    }
  }

  function write(list) {
    try {
      storage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage blocked — queue lives in memory only */
    }
  }

  return {
    /** @param {string} e164 @param {string} [appId] */
    add(e164, appId) {
      const list = read().filter((e) => e.e164 !== e164);
      list.unshift({ e164, app: appId, queuedAt: Date.now() });
      const capped = list.slice(0, CAP);
      write(capped);
      return capped;
    },

    /** @returns {{e164: string, app?: string}[]} */
    list() {
      return read();
    },

    /** Remove one entry (after a successful launch). */
    take(e164) {
      const list = read().filter((e) => e.e164 !== e164);
      write(list);
      return list;
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
