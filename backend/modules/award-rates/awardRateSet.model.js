import mongoose from 'mongoose';

/**
 * Effective-dated SCHADS award constants (MA000100).
 *
 * Only FWC-indexed dollar amounts and award multipliers live here. Structural
 * award constants (6am/8pm bands, 10h daily cap, 76h fortnight cap, 12h broken
 * span) stay in code — they are award structure, not annually indexed amounts.
 *
 * A pay run resolves the set whose effectiveFrom is the greatest one at or
 * before the fortnight's periodStart, so recomputing a historical fortnight
 * always reproduces the dollars that applied at the time.
 */
const constantsSchema = new mongoose.Schema(
  {
    // Allowances (FWC-indexed each 1 July)
    brokenShiftAllowance1: { type: Number, required: true }, // 1 unpaid break
    brokenShiftAllowance2: { type: Number, required: true }, // 2 unpaid breaks
    mealAllowance: { type: Number, required: true },
    vehicleKmRate: { type: Number, required: true },
    sleepoverDefault: { type: Number, required: true }, // fallback when rate card has none

    // Percent-of-standard-rate definitions (award formulas behind the dollar values)
    brokenShiftAllowancePct1: { type: Number, default: 0.017 }, // cl. 20.11 — 1.7%
    brokenShiftAllowancePct2: { type: Number, default: 0.0225 }, // 2.25%
    sleepoverPct: { type: Number, default: 0.049 }, // cl. 25.7 — 4.9% per night
    standardRateWeekly: { type: Number, default: 0 }, // SACS Level 3 pay point 3 weekly rate

    // Ordinary-hours structure used by the manual week-mode calculator
    dailyOrdHours: { type: Number, default: 7.6 },
    weeklyOrdHours: { type: Number, default: 38 },

    // Multipliers (permanent employees; casual loading applied on top)
    otTier1Mult: { type: Number, default: 1.5 },
    otTier2Mult: { type: Number, default: 2.0 },
    casualLoading: { type: Number, default: 0.25 },
    eveningMult: { type: Number, default: 1.125 },
    nightMult: { type: Number, default: 1.15 },
    satMult: { type: Number, default: 1.5 },
    sunMult: { type: Number, default: 2.0 },
    phMult: { type: Number, default: 2.5 },
  },
  { _id: false }
);

const awardRateSetSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // e.g. 'FY2026-27'
    effectiveFrom: { type: Date, required: true, unique: true, index: true },
    effectiveTo: { type: Date, default: null },
    source: { type: String, default: '' }, // FWC determination reference / URL
    status: {
      type: String,
      enum: ['active', 'draft', 'needs-verification'],
      default: 'draft',
      index: true,
    },
    constants: { type: constantsSchema, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const AwardRateSet = mongoose.model('AwardRateSet', awardRateSetSchema);
