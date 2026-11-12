/**
 * Broadcast lists: named groups of numbers you launch together.
 * Stored under `chatlauncher:lists`:
 *   [{ id, name, items: [{ e164, label }], created }]
 * CSV import/export uses RFC-4180-ish quoting (Excel-compatible).
 */

const KEY = 'chatlauncher:lists';
const CAP = 20;
const LIST_CAP = 200;
const NAME_CAP = 40;

/** @typedef {{getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void}} StringStorage */

const E164_RE = /^\d{7,15}$/;

/**
 * Parse a CSV string into rows of cells. Handles quoted fields with embedded
 * commas, doubled quotes and CRLF line endings. Never throws.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/**
 * Serialize rows as CSV (quotes cells that contain commas, quotes or newlines).
 * @param {string[][]} rows
 */
export function toCsv(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) =>
      row
        .map((cell) => {
          const c = String(cell ?? '');
          return /[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
        })
        .join(','),
    )
    .join('\r\n');
}

/**
 * Extract (label, e164) pairs from pasted text: CSV rows, "Name,+123…",
 * "Name <number>" or bare numbers — one per line or comma separated.
 * @param {string} text
 * @returns {{label: string, e164: string}[]} e164 without the leading +
 */
export function parseMembers(text) {
  const out = [];
  const seen = new Set();
  const push = (label, raw) => {
    const digits = String(raw ?? '').replace(/[^\d]/g, '');
    if (!E164_RE.test(digits) || seen.has(digits)) return;
    seen.add(digits);
    out.push({ label: String(label ?? '').slice(0, NAME_CAP), e164: digits });
  };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells = trimmed.includes(',')
      ? parseCsv(trimmed)[0] ?? [trimmed]
      : [trimmed];
    // Prefer the first cell that looks like a number; every other cell is a label.
    let numCell = -1;
    for (let i = 0; i < cells.length; i++) {
      if (E164_RE.test(cells[i].replace(/[^\d]/g, ''))) {
        numCell = i;
        break;
      }
    }
    if (numCell === -1) continue;
    const label = cells.filter((_, i) => i !== numCell).join(' ').trim();
    push(label, cells[numCell]);
  }
  return out;
}

/** @param {StringStorage} storage */
export function createLists(storage) {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string')
        .map((l) => ({
          id: l.id,
          name: l.name,
          created: Number(l.created) || 0,
          items: (Array.isArray(l.items) ? l.items : []).filter(
            (it) => it && E164_RE.test(String(it.e164)),
          ),
        }));
    } catch {
      return [];
    }
  }

  function write(list) {
    try {
      storage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage blocked */
    }
  }

  return {
    /** @returns {any[]} */
    list() {
      return read();
    },

    /** @param {string} id @returns {any|null} */
    get(id) {
      return read().find((l) => l.id === id) ?? null;
    },

    /**
     * @param {string} name
     * @param {{label?: string, e164: string}[]} [items]
     */
    create(name, items = []) {
      const list = read();
      if (list.length >= CAP) return null;
      const entry = {
        id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: String(name ?? '').trim().slice(0, NAME_CAP) || 'List',
        created: Date.now(),
        items: items
          .map((it) => ({
            e164: String(it?.e164 ?? '').replace(/[^\d]/g, ''),
            label: String(it?.label ?? '').slice(0, NAME_CAP),
          }))
          .filter((it) => E164_RE.test(it.e164))
          .slice(0, LIST_CAP),
      };
      list.push(entry);
      write(list);
      return entry;
    },

    /** @param {string} id @param {string} name */
    rename(id, name) {
      const list = read();
      const l = list.find((x) => x.id === id);
      if (l) {
        l.name = String(name).trim().slice(0, NAME_CAP) || l.name;
        write(list);
      }
      return list;
    },

    /**
     * @param {string} id
     * @param {{label?: string, e164: string}} item
     */
    addItem(id, item) {
      const list = read();
      const l = list.find((x) => x.id === id);
      if (!l) return list;
      const e164 = String(item?.e164 ?? '').replace(/[^\d]/g, '');
      if (!E164_RE.test(e164) || l.items.some((it) => it.e164 === e164)) return list;
      l.items.push({ e164, label: String(item?.label ?? '').slice(0, NAME_CAP) });
      if (l.items.length > LIST_CAP) l.items.length = LIST_CAP;
      write(list);
      return list;
    },

    /** @param {string} id @param {string} e164 */
    removeItem(id, e164) {
      const list = read();
      const l = list.find((x) => x.id === id);
      if (l) {
        l.items = l.items.filter((it) => it.e164 !== e164);
        write(list);
      }
      return list;
    },

    /** @param {string} id */
    remove(id) {
      const list = read().filter((l) => l.id !== id);
      write(list);
      return list;
    },

    /** Replace all (backup/sync import). */
    replaceAll(list) {
      const clean = (Array.isArray(list) ? list : [])
        .filter(
          (l) =>
            l &&
            typeof l === 'object' &&
            !Array.isArray(l) &&
            (typeof l.name === 'string' || Array.isArray(l.items)),
        )
        .slice(0, CAP)
        .map((l, i) => ({
        id: typeof l?.id === 'string' && l.id ? l.id.slice(0, 24) : `l${i}${Date.now().toString(36)}`,
        name: String(l?.name ?? 'List').slice(0, NAME_CAP),
        created: Number(l?.created) || Date.now(),
        items: (Array.isArray(l?.items) ? l.items : [])
          .map((it) => ({
            e164: String(it?.e164 ?? '').replace(/[^\d]/g, ''),
            label: String(it?.label ?? '').slice(0, NAME_CAP),
          }))
          .filter((it) => E164_RE.test(it.e164))
          .slice(0, LIST_CAP),
      }));
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
