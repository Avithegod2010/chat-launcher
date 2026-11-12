import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload, createSync, mergeRemote } from '../js/sync.js';

const PASS = 'correct horse battery staple';

test('encrypt → decrypt round-trips the payload', async () => {
  const payload = { history: [{ e164: '15551234567' }], settings: { theme: 'dark' } };
  const envelope = await encryptPayload(payload, PASS);
  assert.equal(envelope.format, 'chat-launcher-sync');
  assert.equal(envelope.v, 1);
  const back = await decryptPayload(envelope, PASS);
  assert.deepEqual(back, payload);
});

test('wrong passphrase or tampered ciphertext is rejected', async () => {
  const envelope = await encryptPayload({ secret: 1 }, PASS);
  await assert.rejects(() => decryptPayload(envelope, 'wrong'));
  const tampered = { ...envelope, ct: envelope.ct.slice(0, -4) + 'AAAA' };
  await assert.rejects(() => decryptPayload(tampered, PASS));
});

test('foreign or malformed envelopes are rejected', async () => {
  await assert.rejects(() => decryptPayload({ format: 'other' }, PASS));
  await assert.rejects(() => decryptPayload(null, PASS));
});

test('ciphertext differs between runs (random salt/iv)', async () => {
  const a = await encryptPayload({ x: 1 }, PASS);
  const b = await encryptPayload({ x: 1 }, PASS);
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.salt, b.salt);
});

const stubFetch = (routes) => async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${new URL(url).href}`;
  const handler = routes[key];
  if (!handler) return { ok: false, status: 404 };
  return handler(init);
};

const cfg = { url: 'https://dav.example.com/remote.php/dav/cl.json', username: 'u', password: 'p' };

test('webdav push uploads and pull decrypts', async () => {
  let stored = null;
  const sync = createSync({
    fetchImpl: stubFetch({
      'PUT https://dav.example.com/remote.php/dav/cl.json': (init) => {
        stored = JSON.parse(init.body);
        return { ok: true, status: 201 };
      },
      'GET https://dav.example.com/remote.php/dav/cl.json': () => ({
        ok: true,
        status: 200,
        json: async () => stored,
      }),
    }),
  });
  const envelope = await encryptPayload({ history: [1, 2, 3] }, PASS);
  const pushed = await sync.push(cfg, envelope);
  assert.equal(pushed.ok, true);
  const pulled = await sync.pull(cfg, PASS);
  assert.deepEqual(pulled.payload, { history: [1, 2, 3] });
});

test('pull reports 404 for nothing-synced and fails on wrong passphrase', async () => {
  const sync = createSync({ fetchImpl: stubFetch({}) });
  const none = await sync.pull(cfg, PASS);
  assert.equal(none.status, 404);

  const wrong = await sync.pull(cfg, 'nope');
  assert.equal(wrong.ok, false);
});

test('plain http is only allowed for localhost', () => {
  const sync = createSync();
  assert.equal(sync.assertSafeUrl('http://127.0.0.1:8080/x.json'), 'http://127.0.0.1:8080/x.json');
  assert.throws(() => sync.assertSafeUrl('http://dav.example.com/x.json'));
  assert.throws(() => sync.assertSafeUrl('ftp://x/y'));
  assert.throws(() => sync.assertSafeUrl('not a url'));
});

test('mergeRemote unions remote-only entries, keeps newer local copies', () => {
  const localHistory = [{ e164: '15551234567', lastUsed: 200, label: 'local' }];
  const fakeStore = (initial) => ({
    items: initial,
    list() {
      return this.items;
    },
    replaceAll(next) {
      this.items = next;
      return next;
    },
  });
  const history = fakeStore(localHistory);
  const templates = fakeStore([{ id: 'a' }]);
  const lists = fakeStore([]);
  const added = mergeRemote(
    {
      history: [
        { e164: '15551234567', lastUsed: 100, label: 'older remote' },
        { e164: '919876543210', lastUsed: 5, label: 'new remote' },
      ],
      templates: [{ id: 'b', text: 'x' }],
      lists: [{ id: 'l1', name: 'Team', items: [] }],
    },
    { history, templates, lists },
  );
  assert.equal(added.history, 1);
  assert.equal(added.templates, 1);
  assert.equal(added.lists, 1);
  assert.equal(history.items.length, 2);
  assert.equal(history.items.find((x) => x.e164 === '15551234567').label, 'local', 'local newer kept');
});
