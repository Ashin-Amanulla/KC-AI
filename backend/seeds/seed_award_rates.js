import { connectDB } from '../config/db.js';
import { AwardRateSet } from '../modules/award-rates/awardRateSet.model.js';

/**
 * Seeds effective-dated SCHADS (MA000100) award-rate sets.
 *
 * FY2024-25 / FY2025-26 carry the values that were hardcoded in the app before
 * award rates became data, so historical recomputes are unchanged.
 *
 * FY2026-27 is seeded as `needs-verification`: the dollar amounts MUST be
 * confirmed against the FWC annual wage review determination effective
 * 1 July 2026 before activating. standardRateWeekly is derived backwards from
 * the broken-shift allowance (20.82 / 0.017) pending verification.
 */
const BASE_CONSTANTS = {
  brokenShiftAllowance1: 20.82,
  brokenShiftAllowance2: 27.56,
  mealAllowance: 16.62,
  vehicleKmRate: 0.99,
  sleepoverDefault: 90,
  brokenShiftAllowancePct1: 0.017,
  brokenShiftAllowancePct2: 0.0225,
  sleepoverPct: 0.049,
  standardRateWeekly: 1224.71,
  dailyOrdHours: 7.6,
  weeklyOrdHours: 38,
  otTier1Mult: 1.5,
  otTier2Mult: 2.0,
  casualLoading: 0.25,
  eveningMult: 1.125,
  nightMult: 1.15,
  satMult: 1.5,
  sunMult: 2.0,
  phMult: 2.5,
};

const seedSets = [
  {
    label: 'FY2024-25',
    effectiveFrom: new Date('2024-07-01T00:00:00+10:00'),
    effectiveTo: new Date('2025-06-30T23:59:59+10:00'),
    status: 'active',
    source: 'Legacy hardcoded application values',
    constants: { ...BASE_CONSTANTS },
    notes: 'Backfill of the constants previously hardcoded in schadsWageCalc.js.',
  },
  {
    label: 'FY2025-26',
    effectiveFrom: new Date('2025-07-01T00:00:00+10:00'),
    effectiveTo: new Date('2026-06-30T23:59:59+10:00'),
    status: 'active',
    source: 'Legacy hardcoded application values',
    constants: { ...BASE_CONSTANTS },
    notes: 'Backfill of the constants previously hardcoded in schadsWageCalc.js.',
  },
  {
    label: 'FY2026-27',
    effectiveFrom: new Date('2026-07-01T00:00:00+10:00'),
    effectiveTo: null,
    status: 'needs-verification',
    source: 'PENDING: FWC Annual Wage Review 2025-26 determination (effective 1 July 2026)',
    constants: { ...BASE_CONSTANTS },
    notes:
      'Placeholder copy of FY2025-26 values. Confirm indexed allowance amounts ' +
      '(broken shift 1.7%/2.25%, meal, km, sleepover 4.9%, standard rate) against ' +
      'the FWC determination and the current SCHADS pay guide before relying on ' +
      'this set for pay runs.',
  },
];

const seed = async () => {
  try {
    await connectDB();
    for (const s of seedSets) {
      const existing = await AwardRateSet.findOne({ effectiveFrom: s.effectiveFrom });
      if (existing) {
        console.log(`Award rate set ${s.label} already exists. Skipping.`);
        continue;
      }
      await AwardRateSet.create(s);
      console.log(`Award rate set ${s.label} created (${s.status}).`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Award rate seed failed:', err);
    process.exit(1);
  }
};

seed();
