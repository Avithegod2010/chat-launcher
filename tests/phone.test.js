import test from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, formatAsYouType, isValid, parsePaste, toE164 } from '../js/phone.js';

test('digitsOnly strips everything but digits', () => {
  assert.equal(digitsOnly('+91 (987) 65-43_210'), '919876543210');
  assert.equal(digitsOnly(''), '');
  assert.equal(digitsOnly(null), '');
  assert.equal(digitsOnly('abc'), '');
});

test('toE164 happy paths', () => {
  assert.equal(toE164('91', '98765 43210'), '919876543210');
  assert.equal(toE164('44', '020 7946 0958'), '442079460958');
  assert.equal(toE164('1', '(555) 123-4567'), '15551234567');
  assert.equal(toE164('49', '030 1234567'), '49301234567');
});

test('toE164 keeps the Italian trunk zero', () => {
  assert.equal(toE164('39', '06 1234 5678', { iso: 'IT' }), '390612345678');
  assert.equal(toE164('39', '312 345 6789'), '393123456789');
});

test('toE164 strips multiple leading zeros', () => {
  assert.equal(toE164('91', '009876543210'), '919876543210');
});

test('toE164 drops a retyped country code', () => {
  assert.equal(toE164('91', '919876543210'), '919876543210');
  // …but keeps short national numbers that merely start with the same digits
  assert.equal(toE164('91', '911234567'), '91911234567');
});

test('toE164 rejects empties', () => {
  assert.equal(toE164('91', ''), null);
  assert.equal(toE164('', '9876543210'), null);
});

test('isValid follows E.164 shape', () => {
  assert.equal(isValid('919876543210'), true);
  assert.equal(isValid('15551234567'), true);
  assert.equal(isValid('0987654321'), false, 'no leading zero');
  assert.equal(isValid('123456'), false, 'too short');
  assert.equal(isValid('1234567890123456'), false, 'too long (16)');
  assert.equal(isValid('123456789012345'), true, '15 is the max');
  assert.equal(isValid(''), false);
});

test('formatAsYouType groups nicely', () => {
  assert.equal(formatAsYouType('9876543210'), '987 654 3210');
  assert.equal(formatAsYouType('1234567'), '123 4567');
  assert.equal(formatAsYouType('123'), '123');
  assert.equal(formatAsYouType(''), '');
  assert.equal(formatAsYouType('98-76-54 3210'), '987 654 3210');
});

test('parsePaste resolves international numbers', () => {
  assert.deepEqual(parsePaste('+91 98765 43210'), { iso: 'IN', dial: '91', national: '9876543210' });
  assert.deepEqual(parsePaste('+15551234567'), { iso: 'US', dial: '1', national: '5551234567' });
  assert.deepEqual(parsePaste('+442079460958'), { iso: 'GB', dial: '44', national: '2079460958' });
  assert.deepEqual(parsePaste('0049 30 1234567'), { iso: 'DE', dial: '49', national: '301234567' });
});

test('parsePaste prefers the longest matching dial code (NANP area codes)', () => {
  assert.deepEqual(parsePaste('+16644912345'), { iso: 'MS', dial: '1664', national: '4912345' });
  assert.deepEqual(parsePaste('+1 242 555 1234'), { iso: 'BS', dial: '1242', national: '5551234' });
});

test('parsePaste rejects junk', () => {
  assert.equal(parsePaste('9876543210'), null, 'not international');
  assert.equal(parsePaste('+9991234567'), null, 'no such dial code');
  assert.equal(parsePaste('+1234567'), null, 'too short');
  assert.equal(parsePaste(''), null);
  assert.equal(parsePaste('call me maybe'), null);
});

test('parsePaste tolerates spaced and dashed input', () => {
  assert.deepEqual(parsePaste('+9-1 (987) 654 3210'), {
    iso: 'IN',
    dial: '91',
    national: '9876543210',
  });
});
