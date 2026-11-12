/**
 * Regression tests for the Expo shortcuts config plugin: AAPT requires
 * shortcut labels to be @string references (literal text fails the build).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../expo-app/plugins/shortcuts-plugin.js');

test('shortcuts.xml references string resources, never literals', () => {
  const xml = plugin.shortcutsXml();
  for (const { id } of plugin.SHORTCUTS) {
    assert.ok(xml.includes(`@string/shortcut_${id}_short`), `${id} short label is a resource ref`);
    assert.ok(xml.includes(`@string/shortcut_${id}_long`), `${id} long label is a resource ref`);
  }
  // No raw label text directly in the attribute values.
  assert.ok(!/shortcutShortLabel="[^@]/.test(xml), 'no literal short labels');
  assert.ok(!/shortcutLongLabel="[^@]/.test(xml), 'no literal long labels');
  assert.equal((xml.match(/<shortcut\s/g) || []).length, plugin.SHORTCUTS.length);
});

test('label resources exist for every shortcut', () => {
  const xml = plugin.shortcutLabelsXml();
  for (const { id, label } of plugin.SHORTCUTS) {
    assert.ok(xml.includes(`name="shortcut_${id}_short">${label}<`), `${id} short resource`);
    assert.ok(xml.includes(`name="shortcut_${id}_long">Launch on ${label}<`), `${id} long resource`);
  }
  assert.match(xml, /^<\?xml/);
  assert.ok(xml.includes('<resources>'));
});

test('shortcut urls point at the app origin with ?app=', () => {
  for (const { url } of plugin.SHORTCUTS) {
    assert.match(url, /^https:\/\/avithegod2010\.github\.io\/chat-launcher\/\?app=[a-z]+$/);
  }
});
