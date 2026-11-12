/**
 * End-to-end encrypted sync. The whole payload (settings/history/stats/
 * templates/lists) is AES-GCM encrypted with a key derived from the user's
 * passphrase (PBKDF2-SHA256, 310k iterations) — the sync server (WebDAV,
 * e.g. Nextcloud) only ever sees ciphertext. Zero knowledge by design:
 * the passphrase never leaves the device and the server holds no secrets.
 *
 * Wire format ("chat-launcher-sync" envelope):
 *   { format, v: 1, salt: b64, iv: b64, ct: b64, updatedAt }
 */

const FORMAT = 'chat-launcher-sync';
const VERSION = 1;
const PBKDF2_ITERATIONS = 310000;

const te = new TextEncoder();
const td = new TextDecoder();

/** @param {Uint8Array} bytes */
function b64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** @param {string} str */
function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {{subtle?: SubtleCrypto}} [cryptoImpl] injectable for tests
 */
async function deriveKey(passphrase, salt, cryptoImpl = globalThis.crypto) {
  const subtle = cryptoImpl.subtle;
  const base = await subtle.importKey('raw', te.encode(String(passphrase)), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a payload with a passphrase. Throws only when crypto is unavailable.
 * @param {unknown} payload JSON-serializable data
 * @param {string} passphrase
 * @param {{subtle?: SubtleCrypto}} [cryptoImpl]
 */
export async function encryptPayload(payload, passphrase, cryptoImpl = globalThis.crypto) {
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, cryptoImpl);
  const ct = await cryptoImpl.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(JSON.stringify(payload)),
  );
  return {
    format: FORMAT,
    v: VERSION,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypt an envelope produced by encryptPayload. Rejects wrong passphrases
 * (GCM auth) and tampered envelopes.
 * @param {unknown} envelope
 * @param {string} passphrase
 * @param {{subtle?: SubtleCrypto}} [cryptoImpl]
 */
export async function decryptPayload(envelope, passphrase, cryptoImpl = globalThis.crypto) {
  if (!envelope || envelope.format !== FORMAT || Number(envelope.v) !== VERSION) {
    throw new Error('not a chat-launcher sync file');
  }
  const key = await deriveKey(passphrase, unb64(String(envelope.salt)), cryptoImpl);
  const plain = await cryptoImpl.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(String(envelope.iv)) },
    key,
    unb64(String(envelope.ct)),
  );
  return JSON.parse(td.decode(plain));
}

/**
 * WebDAV transport with an injectable fetch (tests pass a stub).
 * @param {{fetchImpl?: typeof fetch}} [opts]
 */
export function createSync(opts = {}) {
  const doFetch = opts.fetchImpl ?? ((...a) => fetch(...a));

  /** @param {{url: string, username?: string, password?: string}} cfg */
  function headers(cfg) {
    const h = {};
    if (cfg.username || cfg.password) {
      h.Authorization = `Basic ${b64(te.encode(`${cfg.username ?? ''}:${cfg.password ?? ''}`))}`;
    }
    return h;
  }

  /** Only https (or http on localhost for self-hosted testing) is allowed. */
  function assertSafeUrl(raw) {
    let u;
    try {
      u = new URL(String(raw));
    } catch {
      throw new Error('invalid sync URL');
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('invalid sync URL');
    if (u.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) {
      throw new Error('plain http is only allowed for localhost');
    }
    return u.toString();
  }

  return {
    assertSafeUrl,
    /**
     * Upload the (already encrypted) envelope.
     * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
     */
    async push(cfg, envelope) {
      let url;
      try {
        url = assertSafeUrl(cfg?.url);
      } catch (e) {
        return { ok: false, error: e.message };
      }
      try {
        const res = await doFetch(url, {
          method: 'PUT',
          headers: { ...headers(cfg), 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope),
        });
        return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    },

    /**
     * Download and decrypt. Returns {ok:false, status:404} when nothing has
     * been synced yet.
     * @returns {Promise<{ok: boolean, status?: number, payload?: unknown, error?: string}>}
     */
    async pull(cfg, passphrase) {
      let url;
      try {
        url = assertSafeUrl(cfg?.url);
      } catch (e) {
        return { ok: false, error: e.message };
      }
      let res;
      try {
        res = await doFetch(url, { method: 'GET', headers: headers(cfg) });
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
      if (res.status === 404) return { ok: false, status: 404 };
      if (!res.ok) return { ok: false, status: res.status };
      try {
        const envelope = await res.json();
        const payload = await decryptPayload(envelope, passphrase);
        return { ok: true, payload };
      } catch {
        return { ok: false, error: 'decrypt failed — wrong passphrase or corrupted file' };
      }
    },
  };
}

/**
 * Merge a pulled payload into the live stores without clobbering newer local
 * data: entries/keys that only exist remotely are added, existing keys keep
 * the locally newer copy (per-entry lastUsed / list created).
 * @param {unknown} remote sanitized payload (same shape as a backup file)
 * @param {{history: {list(): any[], replaceAll(any): any[]}, stats: object,
 *          templates: {list(): any[], replaceAll(any): any[]},
 *          lists: {list(): any[], replaceAll(any): any[]}}} stores
 */
export function mergeRemote(remote, stores) {
  if (!remote || typeof remote !== 'object') return { history: 0, templates: 0, lists: 0 };
  let addedHistory = 0;
  if (Array.isArray(remote.history)) {
    const local = stores.history.list();
    const byE164 = new Map(local.map((e) => [e.e164, e]));
    for (const r of remote.history) {
      const l = byE164.get(r.e164);
      if (!l) {
        byE164.set(r.e164, r);
        addedHistory++;
      } else if ((Number(r.lastUsed) || 0) > (Number(l.lastUsed) || 0)) {
        byE164.set(r.e164, { ...l, ...r });
      }
    }
    stores.history.replaceAll([...byE164.values()]);
  }
  let addedTemplates = 0;
  if (Array.isArray(remote.templates)) {
    const known = new Set(stores.templates.list().map((t) => t.id));
    const merged = [...stores.templates.list()];
    for (const t of remote.templates) {
      if (!known.has(t.id)) {
        merged.push(t);
        addedTemplates++;
      }
    }
    stores.templates.replaceAll(merged);
  }
  let addedLists = 0;
  if (Array.isArray(remote.lists)) {
    const known = new Set(stores.lists.list().map((l) => l.id));
    const merged = [...stores.lists.list()];
    for (const l of remote.lists) {
      if (!known.has(l.id)) {
        merged.push(l);
        addedLists++;
      }
    }
    stores.lists.replaceAll(merged);
  }
  return { history: addedHistory, templates: addedTemplates, lists: addedLists };
}
