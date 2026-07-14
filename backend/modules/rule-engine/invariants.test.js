import assert from 'node:assert';
import test, { describe } from 'node:test';
import { computePayHoursForStaff } from '../pay-hours/services/payHoursCalculator.js';
import { staffTotalHours, shiftRowPayableHours } from '../pay-hours/services/wageCalculator.js';
import { detectBrokenShifts } from '../shifts/shiftCsvParser.js';

/**
 * Property-based invariant suite.
 *
 * Every discrepancy incident so far (double-counted broken shifts, backfilled
 * per-shift hours, 76h-cap drift) violated one of a small set of conservation
 * laws. Instead of testing single scenarios, this generates hundreds of
 * randomized fortnights from fixed seeds and asserts the laws hold on all of
 * them. A failure message always includes the seed — rerun with that seed to
 * reproduce deterministically.
 *
 * Invariants:
 *  I1  No pay bucket is ever negative.
 *  I2  Hours are conserved: staff payable hours == Σ active hours of input
 *      shifts (total hours − 8h per sleepover, floored at 0).
 *  I3  Per-shift breakdowns reconcile with staff totals (no bucket lost or
 *      double-counted when attributing to shifts).
 *  I4  Determinism/idempotence: same input → identical output.
 *  I5  After the 76h cap, ordinary (non-OT) hours never exceed 76.
 */

const SEED_COUNT = 200;
const r2 = (n) => Math.round(n * 100) / 100;

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** UTC ms for local Brisbane (+10, no DST) wall time. */
function bris(y, mo, d, h, min = 0) {
  return Date.UTC(y, mo - 1, d, h, min) - 10 * 3600000;
}

function generateFortnight(seed) {
  const rng = makeRng(seed);
  const startDay = 2 + Math.floor(rng() * 3); // 2026-03-02 .. 04
  let cursorMs = bris(2026, 3, startDay, 5 + Math.floor(rng() * 5));
  const endOfWindowMs = bris(2026, 3, startDay + 14, 0);
  const nShifts = 5 + Math.floor(rng() * 18);
  const shifts = [];

  for (let i = 0; i < nShifts && cursorMs < endOfWindowMs; i++) {
    const typeRoll = rng();
    const shiftType =
      typeRoll < 0.7 ? 'personal_care' : typeRoll < 0.85 ? 'sleepover' : 'nursing_support';

    const durH =
      shiftType === 'sleepover'
        ? 8 + Math.round(rng() * 8) / 4 // 8–10h
        : 1 + Math.round(rng() * 44) / 4; // 1–12h in 15-min steps

    if (i > 0) {
      const gapRoll = rng();
      const gapH =
        gapRoll < 0.2
          ? 0 // continuous chain
          : gapRoll < 0.5
            ? Math.round(rng() * 38) / 4 // 0–9.5h — broken / short turnaround territory
            : 10 + Math.round(rng() * 120) / 4; // adequate rest
      cursorMs += gapH * 3600000;
    }

    const start = new Date(cursorMs);
    const end = new Date(cursorMs + durH * 3600000);
    shifts.push({
      _id: `inv-${seed}-${i + 1}`,
      staffName: 'Prop Staff',
      shiftType,
      startDatetime: start,
      endDatetime: end,
      hours: durH,
      timezoneOffset: '+10:00',
      isBrokenShift: false,
      mileage: null,
      clientName: null,
    });
    cursorMs = end.getTime();
  }

  // ~30% of scenarios include a public holiday inside the window.
  const holidays = rng() < 0.3 ? new Set([`2026-03-${String(startDay + 4).padStart(2, '0')}`]) : new Set();
  return { shifts, holidays };
}

function cloneShifts(shifts) {
  return shifts.map((s) => ({
    ...s,
    startDatetime: new Date(s.startDatetime),
    endDatetime: new Date(s.endDatetime),
  }));
}

function expectedActiveHours(shifts) {
  return shifts.reduce((sum, s) => {
    const active = s.shiftType === 'sleepover' ? Math.max(0, s.hours - 8) : s.hours;
    return sum + active;
  }, 0);
}

const ORDINARY_FIELDS = [
  'morningHours',
  'afternoonHours',
  'nightHours',
  'saturdayHours',
  'sundayHours',
  'holidayHours',
  'nursingCareHours',
];

describe(`pay engine invariants (${SEED_COUNT} seeded random fortnights)`, () => {
  test('I1–I5 hold on every generated scenario', () => {
    const failures = [];

    for (let seed = 1; seed <= SEED_COUNT; seed++) {
      const { shifts, holidays } = generateFortnight(seed);
      if (!shifts.length) continue;

      const input = cloneShifts(shifts);
      detectBrokenShifts(input);
      const { data, shiftBreakdowns } = computePayHoursForStaff(input, holidays);

      // I1: non-negative buckets
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' && value < -0.001) {
          failures.push(`seed ${seed}: I1 negative bucket ${key}=${value}`);
        }
      }

      // I2: hours conservation (tolerance scales with shift count for 2dp rounding)
      const tolerance = 0.02 + shifts.length * 0.01;
      const expected = r2(expectedActiveHours(shifts));
      const actual = staffTotalHours(data);
      if (Math.abs(actual - expected) > tolerance) {
        failures.push(
          `seed ${seed}: I2 hours not conserved — expected ${expected}, engine paid ${actual} (Δ ${r2(actual - expected)})`
        );
      }

      // I3: per-shift breakdowns reconcile with staff totals
      const perShiftSum = r2(
        [...shiftBreakdowns.values()].reduce((sum, bd) => sum + shiftRowPayableHours(bd), 0)
      );
      if (Math.abs(perShiftSum - actual) > tolerance) {
        failures.push(
          `seed ${seed}: I3 per-shift sum ${perShiftSum} != staff total ${actual} (Δ ${r2(perShiftSum - actual)})`
        );
      }

      // I4: determinism
      const rerunInput = cloneShifts(shifts);
      detectBrokenShifts(rerunInput);
      const rerun = computePayHoursForStaff(rerunInput, holidays);
      try {
        assert.deepStrictEqual(rerun.data, data);
      } catch {
        failures.push(`seed ${seed}: I4 non-deterministic output across identical runs`);
      }

      // I5: post-cap ordinary hours ≤ 76
      const ordinary = r2(ORDINARY_FIELDS.reduce((sum, f) => sum + (data[f] || 0), 0));
      if (ordinary > 76 + 0.05) {
        failures.push(`seed ${seed}: I5 ordinary hours ${ordinary} exceed the 76h fortnight cap`);
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `engine invariant violations (${failures.length}):\n  ${failures.slice(0, 25).join('\n  ')}${failures.length > 25 ? `\n  … and ${failures.length - 25} more` : ''}`
    );
  });
});
