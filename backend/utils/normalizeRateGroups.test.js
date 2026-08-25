import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRateGroups, rateGroupsEqual } from './normalizeRateGroups.js';

test('normalizeRateGroups collapses whitespace runs', () => {
  assert.equal(normalizeRateGroups('01 Assistance In  Supported  Independent'), '01 assistance in supported independent');
});

test('normalizeRateGroups trims leading/trailing spaces', () => {
  assert.equal(normalizeRateGroups('  High Intensity Pm  '), 'high intensity pm');
});

test('normalizeRateGroups lowercases for case-insensitive compare', () => {
  assert.equal(normalizeRateGroups('High Intensity AM'), normalizeRateGroups('high intensity am'));
});

test('normalizeRateGroups handles null/undefined', () => {
  assert.equal(normalizeRateGroups(null), '');
  assert.equal(normalizeRateGroups(undefined), '');
});

test('rateGroupsEqual treats spacing-only differences as equal', () => {
  assert.ok(rateGroupsEqual('High Intensity  Pm', 'High Intensity Pm'));
  assert.ok(rateGroupsEqual(' High Intensity Saturday ', 'High Intensity Saturday'));
});

test('rateGroupsEqual still flags genuinely different rate groups', () => {
  assert.equal(rateGroupsEqual('High Intensity Pm', 'Standard Pm'), false);
  assert.equal(rateGroupsEqual('Sleepover', 'High Intensity Am'), false);
});
