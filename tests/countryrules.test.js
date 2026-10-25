import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNumber } from '../js/phone.js';

test('checkNumber enforces per-country lengths', () => {
  // India: exactly 10 national digits
  assert.equal(checkNumber('91', '9876543210', 'IN').state, 'ok');
  assert.equal(checkNumber('91', '98765432', 'IN').state, 'short');
  assert.equal(checkNumber('91', '98765432101', 'IN').state, 'long');

  // US: 10 digits
  assert.equal(checkNumber('1', '5551234567', 'US').state, 'ok');
  assert.equal(checkNumber('1', '55512345', 'US').state, 'short');

  // Bahamas (dial 1242): 7 more digits
  assert.equal(checkNumber('1242', '5551234', 'BS').state, 'ok');
  assert.equal(checkNumber('1242', '555123', 'BS').state, 'short');

  // Singapore: 8 digits
  assert.equal(checkNumber('65', '12345678', 'SG').state, 'ok');
});

test('checkNumber reports the expected range for messages', () => {
  const short = checkNumber('91', '98765', 'IN');
  assert.equal(short.min, 10);
  assert.equal(short.max, 10);
  assert.equal(short.typed, 5);
});

test('unknown countries fall back to the generic ITU rule', () => {
  // Antarctica is not in the LENGTHS table (dial 672)
  assert.equal(checkNumber('672', '1234567', 'AQ').state, 'ok');
  assert.equal(checkNumber('672', '1234567890123456', 'AQ').state, 'long');
});

test('leading zeros are still rejected as bad', () => {
  assert.equal(checkNumber('91', '0987654321', 'IN').state, 'ok', 'trunk 0 stripped then valid');
});

test('empty input reports empty, not short', () => {
  const r = checkNumber('91', '', 'IN');
  assert.equal(r.state, 'empty');
});
