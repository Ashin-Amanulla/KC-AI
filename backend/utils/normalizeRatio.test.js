import assert from 'node:assert';
import test from 'node:test';
import { normalizeRatio } from './normalizeRatio.js';

test('normalizeRatio strips leading zeros', () => {
  assert.strictEqual(normalizeRatio('01:02'), '1:2');
  assert.strictEqual(normalizeRatio('1:02'), '1:2');
  assert.strictEqual(normalizeRatio('1:01'), '1:1');
  assert.strictEqual(normalizeRatio('01:01'), '1:1');
});

test('normalizeRatio trims whitespace', () => {
  assert.strictEqual(normalizeRatio('  01 : 02  '), '1:2');
});

test('normalizeRatio empty and passthrough', () => {
  assert.strictEqual(normalizeRatio(''), '');
  assert.strictEqual(normalizeRatio(null), '');
  assert.strictEqual(normalizeRatio('N/A'), 'N/A');
});

test('normalizeRatio already canonical', () => {
  assert.strictEqual(normalizeRatio('1:2'), '1:2');
});
