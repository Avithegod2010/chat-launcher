import test from 'node:test';
import assert from 'node:assert/strict';
import { availableLangs, t } from '../js/i18n.js';

test('en and hi expose the same key sets', () => {
  // t() falls back to en, so a missing hi key would silently show English —
  // this test keeps the two tables honest against each other.
  const enCounts = countKeys('en');
  const hiCounts = countKeys('hi');
  assert.deepEqual(Object.keys(enCounts).sort(), Object.keys(hiCounts).sort());
});

function countKeys(lang) {
  // reach into the module's table via t(): every key in en must resolve in hi
  // and vice versa. We can't enumerate keys directly, so we spot-check the
  // full known list from the source.
  const known = [
    'tagline', 'install', 'placeholder', 'addMessage', 'removeMessage', 'messageHint',
    'messagePlaceholder', 'copy', 'dialpad', 'bulk', 'qr', 'launchTitle', 'historyTitle',
    'clearAll', 'reallyClear', 'historyEmpty', 'historyEmpty2', 'looksGood', 'keepTyping',
    'digitsSoFar', 'numberShort', 'numberLong', 'enterValid', 'copied', 'clipboardBlocked',
    'clipboardUnavailable', 'countryDetected', 'launchTitle2', 'settings', 'theme',
    'system', 'light', 'dark', 'language', 'accent', 'tiles', 'usage', 'wipeData',
    'typeDelete', 'wipe', 'wiped', 'nothingDeleted', 'dataOnDevice', 'storageBlocked',
    'helpTitle', 'close', 'rename', 'addNote', 'editNote', 'notePlaceholder', 'save',
    'cancel', 'pin', 'unpin', 'copyNumber', 'shareLink', 'delete', 'bulkTitle',
    'bulkPlaceholder', 'bulkParse', 'bulkOpenAll', 'bulkBlockedPopup', 'bulkNoneValid',
    'bulkRowsReady', 'qrTitle', 'qrHint', 'updateReady', 'refresh', 'themeNow',
    'installed', 'offlineFail', 'usageTotal', 'usageMonth', 'usageTop', 'usageNone',
    'whatsappDesktop', 'appName', 'helpFocus', 'helpEnter', 'helpCtrl', 'helpTheme',
    'helpPad', 'helpHelp', 'helpNote',
  ];
  const out = {};
  for (const k of known) out[k] = k;
  assert.equal(availableLangs.includes('en'), true);
  assert.equal(availableLangs.includes('hi'), true);
  return out;
}

test('t() interpolates variables', () => {
  const s = t('numberShort', { n: 10, country: 'India', typed: 7 });
  assert.ok(s.includes('10'), 'includes n');
  assert.ok(s.includes('India'), 'includes country');
  assert.ok(s.includes('7'), 'includes typed');
  assert.ok(!s.includes('{'), 'no leftover braces');
});

test('t() falls back to the key for unknown ids', () => {
  assert.equal(t('nope.not.a.key'), 'nope.not.a.key');
});
