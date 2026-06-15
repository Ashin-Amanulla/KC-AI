import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateOt76GlobalTierFromTotals,
  resolveOt76PayTiers,
} from './ot76GlobalTier.js';

test('allocateOt76GlobalTierFromTotals: weekday pool consumes global 1.5× first', () => {
  assert.deepEqual(allocateOt76GlobalTierFromTotals(9, 6), {
    wdT1: 2,
    wdT2: 7,
    satT1: 0,
    satT2: 6,
  });
});

test('resolveOt76PayTiers prefers persisted tier fields', () => {
  const tiers = resolveOt76PayTiers({
    otAfter76Weekday: 9,
    otAfter76Saturday: 6,
    otAfter76WeekdayUpto2: 2,
    otAfter76WeekdayAfter2: 7,
    otAfter76SaturdayUpto2: 0,
    otAfter76SaturdayAfter2: 6,
  });
  assert.deepEqual(tiers, { wdT1: 2, wdT2: 7, satT1: 0, satT2: 6 });
});
