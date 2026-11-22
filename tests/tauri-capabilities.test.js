import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const CAP_DIR = 'desktop/src-tauri/capabilities';
const conf = readJson('desktop/src-tauri/tauri.conf.json');
const mainRs = read('desktop/src-tauri/src/main.rs');
const windowUrl = conf.app.windows.find((w) => w.label === 'main').url;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

test('the main window loads a remote origin (the reason capabilities matter)', () => {
  assert.match(windowUrl, /^https:\/\/avithegod2010\.github\.io\/chat-launcher\/$/);
  // The Rust side must target the same origin, so removing IPC changes nothing about what is shown.
  assert.match(mainRs, /const SITE: &str = "https:\/\/avithegod2010\.github\.io\/chat-launcher\/";/);
});

test('no capability is extended to remote content', () => {
  const cap = readJson(`${CAP_DIR}/default.json`);
  assert.equal(Object.prototype.hasOwnProperty.call(cap, 'remote'), false,
    'a remote block hands the live PWA origin an IPC surface inside a signed desktop app');
  assert.deepEqual(cap.remote ?? null, null);
  assert.equal(Object.prototype.hasOwnProperty.call(conf.app.security, 'dangerousRemoteDomainIpcAccess'), false);
});

test('a remote page is granted no IPC permission at all', () => {
  for (const rel of walk(CAP_DIR)) {
    if (extname(rel) !== '.json') continue;
    const cap = readJson(rel);
    assert.match(cap.identifier, /^[a-z0-9-]+$/i, `${rel}: identifier`);
    assert.ok(Array.isArray(cap.permissions), `${rel}: permissions must be an array`);
    assert.deepEqual(cap.permissions, [], `${rel}: ${cap.permissions.length} permission(s) reachable from an untrusted origin`);
  }
});

test('every native feature is still driven from Rust, not from the page', () => {
  assert.match(mainRs, /global_shortcut\(\)\s*\.on_shortcut\(/, 'global hotkey');
  assert.match(mainRs, /TrayIconBuilder::with_id\("chatlauncher-tray"\)/, 'tray');
  assert.match(mainRs, /fn start_clipboard_watcher/, 'clipboard watcher');
  assert.match(mainRs, /tauri_plugin_updater::Builder::new\(\)\.build\(\)/, 'updater');
});

test('the shipped front end never calls IPC, so an empty grant cannot break it', () => {
  const files = [...walk('desktop/src'), ...walk('js')].filter((rel) => /\.(html|js|mjs)$/.test(rel));
  assert.ok(files.length > 5);
  const offenders = files.filter((rel) => /__TAURI__|__TAURI_INTERNALS__|@tauri-apps\/api/.test(read(rel)));
  assert.deepEqual(offenders, [], 'these files use Tauri IPC and would need a capability: ' + offenders.join(', '));
});
