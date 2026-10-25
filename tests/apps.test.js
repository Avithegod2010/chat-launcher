import test from 'node:test';
import assert from 'node:assert/strict';
import { APPS, getApp, isAppleDevice, isDesktopUA } from '../js/apps.js';

const IN = '919876543210';
const US = '15551234567';

test('registry has 9 unique, well-formed targets', () => {
  assert.equal(APPS.length, 9);
  const ids = APPS.map((a) => a.id);
  assert.equal(new Set(ids).size, 9);
  for (const app of APPS) {
    assert.ok(app.name && app.color.startsWith('#'), `${app.id} metadata`);
    assert.ok(['full', 'limited'].includes(app.capability), `${app.id} capability`);
    assert.equal(typeof app.buildUrl, 'function', `${app.id} buildUrl`);
    assert.ok(app.icon.includes('<svg'), `${app.id} icon svg`);
  }
});

test('whatsapp builds wa.me links with optional text', () => {
  const wa = getApp('whatsapp');
  assert.equal(wa.buildUrl(IN), `https://wa.me/${IN}`);
  assert.equal(wa.buildUrl(IN, 'hello world'), `https://wa.me/${IN}?text=hello%20world`);
});

test('message text is encoded exactly once', () => {
  const wa = getApp('whatsapp');
  assert.equal(wa.buildUrl(IN, '👋 hi'), `https://wa.me/${IN}?text=%F0%9F%91%8B%20hi`);
  assert.equal(wa.buildUrl(IN, 'a&b=c #1'), `https://wa.me/${IN}?text=a%26b%3Dc%20%231`);
  assert.equal(wa.buildUrl(IN, 'C++'), `https://wa.me/${IN}?text=C%2B%2B`);
  assert.equal(wa.buildUrl(IN, "50% off!"), `https://wa.me/${IN}?text=50%25%20off!`);
});

test('telegram uses the +number form', () => {
  assert.equal(getApp('telegram').buildUrl(IN), 'https://t.me/+919876543210');
});

test('signal links through the #p fragment', () => {
  assert.equal(getApp('signal').buildUrl(IN), 'https://signal.me/#p/%2B919876543210');
});

test('sms body separator differs by platform', () => {
  const sms = getApp('sms');
  assert.equal(sms.buildUrl(US, 'Hi', { isApple: false }), 'sms:+15551234567?body=Hi');
  assert.equal(sms.buildUrl(US, 'Hi', { isApple: true }), 'sms:+15551234567&body=Hi');
  assert.equal(sms.buildUrl(US), 'sms:+15551234567');
  assert.equal(sms.buildUrl(US, 'a b', { isApple: true }), 'sms:+15551234567&body=a%20b');
});

test('call uses tel:', () => {
  assert.equal(getApp('call').buildUrl(US), 'tel:+15551234567');
});

test('viber percent-encodes the plus', () => {
  assert.equal(getApp('viber').buildUrl(IN), 'viber://chat?number=%2B919876543210');
});

test('skype appends ?chat', () => {
  assert.equal(getApp('skype').buildUrl(US), 'skype:+15551234567?chat');
});

test('limited targets only open the app and are labeled honestly', () => {
  assert.equal(getApp('line').buildUrl(IN), 'line://');
  assert.equal(getApp('threema').buildUrl(IN), 'threema://');
  assert.equal(getApp('line').capability, 'limited');
  assert.equal(getApp('threema').capability, 'limited');
  assert.ok(getApp('line').note);
  assert.ok(getApp('threema').note);
});

test('isAppleDevice sniffs Apple platforms', () => {
  assert.equal(isAppleDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), true);
  assert.equal(isAppleDevice('Mozilla/5.0 (iPad; CPU OS 16_6)'), true);
  assert.equal(isAppleDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari'), true);
  assert.equal(
    isAppleDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0'),
    false,
  );
  assert.equal(isAppleDevice('Mozilla/5.0 (Linux; Android 14) Chrome/126.0'), false);
});

test('message support flags match reality', () => {
  assert.equal(getApp('whatsapp').supportsMessage, true);
  assert.equal(getApp('sms').supportsMessage, true);
  for (const id of ['telegram', 'signal', 'call', 'viber', 'skype', 'line', 'threema']) {
    assert.equal(getApp(id).supportsMessage, false, id);
  }
});

test('native app schemes are built for whatsapp and telegram only', () => {
  const wa = getApp('whatsapp');
  assert.equal(wa.appScheme('919876543210'), 'whatsapp://send?phone=%2B919876543210');
  assert.equal(
    wa.appScheme('919876543210', 'hi there'),
    'whatsapp://send?phone=%2B919876543210&text=hi%20there',
  );
  assert.equal(getApp('telegram').appScheme('919876543210'), 'tg://resolve?phone=+919876543210');
  for (const id of ['signal', 'sms', 'call', 'viber', 'skype', 'line', 'threema']) {
    assert.equal(getApp(id).appScheme, undefined, `${id} has no app scheme`);
  }
});

test('isDesktopUA separates desktop from mobile agents', () => {
  const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile';
  const iPhone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1';
  assert.equal(isDesktopUA(desktop), true);
  assert.equal(isDesktopUA(android), false);
  assert.equal(isDesktopUA(iPhone), false);
});
