import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe } from 'node:test';
import * as backendWage from './wageCalculator.js';
import * as frontendWage from '../../../../frontend/src/lib/schadsWageCalc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLE_RATES = {
  daytime: 38.4,
  afternoon: 42.24,
  night: 43.01,
  otUpto2: 53.76,
  otAfter2: 69.12,
  saturday: 53.76,
  satOtAfter2: 69.12,
  sunday: 69.12,
  ph: 84.48,
  nursingDaytime: 42,
  nursingAfternoon: 46.2,
  nursingNight: 47.04,
  nursingSaturday: 58.8,
  nursingSunday: 75.6,
  nursingPh: 92.4,
  mealAllow: 16.62,
  brokenShift: 20.82,
  sleepover: 90,
  sleepoverExtra: 5,
  kmRate: 0.99,
  allowance: 25,
};

const SAMPLE_PAY_HOURS = [
  {
    morningHours: 60, afternoonHours: 6, nightHours: 20, saturdayHours: 8, sundayHours: 8,
    holidayHours: 4, weekdayOtUpto2: 2, weekdayOtAfter2: 3.5, saturdayOtUpto2: 1,
    saturdayOtAfter2: 0.5, sundayOtUpto2: 1, sundayOtAfter2: 0, holidayOtUpto2: 0.5,
    holidayOtAfter2: 0, nursingCareHours: 5, nursingAfternoonHours: 2, nursingNightHours: 1,
    nursingSaturdayHours: 2, nursingSundayHours: 1, nursingHolidayHours: 0.5,
    shortTurnaroundHours: 4, otAfter76Hours: 3.75, otAfter76Weekday: 3.75,
    otAfter76WeekdayUpto2: 2, otAfter76WeekdayAfter2: 1.75, otAfter76Saturday: 0,
    otAfter76Sunday: 1, otAfter76Holiday: 0.5, brokenShiftCount: 2, brokenShift2BreakCount: 1,
    sleepoversCount: 3, mealAllowanceCount: 2, totalKm: 120,
  },
  { morningHours: 38 },
  {},
];

describe('frontend/backend wage layer parity (until schadsWageCalc.js is retired)', () => {
  test('ot76GlobalTier: frontend and backend copies are code-identical', () => {
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
    const frontendSrc = fs.readFileSync(
      path.join(__dirname, '../../../../frontend/src/lib/ot76GlobalTier.js'), 'utf8');
    const backendSrc = fs.readFileSync(
      path.join(__dirname, '../utils/ot76GlobalTier.js'), 'utf8');
    assert.strictEqual(strip(frontendSrc), strip(backendSrc),
      'ot76GlobalTier.js has diverged between frontend and backend — sync them');
  });

  test('calcGrossFromRates parity across sample pay-hours', () => {
    for (const ph of SAMPLE_PAY_HOURS) {
      assert.strictEqual(
        backendWage.calcGrossFromRates(ph, SAMPLE_RATES),
        frontendWage.calcGrossFromRates(ph, SAMPLE_RATES)
      );
    }
  });

  test('calcBreakdownFromRates parity (gross + line items)', () => {
    for (const ph of SAMPLE_PAY_HOURS) {
      const b = backendWage.calcBreakdownFromRates(ph, SAMPLE_RATES);
      const f = frontendWage.calcBreakdownFromRates(ph, SAMPLE_RATES);
      assert.deepStrictEqual(b, f);
    }
  });

  test('calcGross multiplier-fallback parity (casual + permanent)', () => {
    for (const ph of SAMPLE_PAY_HOURS) {
      for (const empType of ['casual', 'permanent']) {
        assert.strictEqual(
          backendWage.calcGross(ph, 35, empType),
          frontendWage.calcGross(ph, 35, empType)
        );
      }
    }
  });

  test('calcAllowances parity', () => {
    for (const ph of SAMPLE_PAY_HOURS) {
      assert.deepStrictEqual(backendWage.calcAllowances(ph), frontendWage.calcAllowances(ph));
    }
  });
});
