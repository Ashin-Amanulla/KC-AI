import mongoose from 'mongoose';

const payHoursSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    periodStart: {
      type: Date,
      default: null,
    },
    periodEnd: {
      type: Date,
      default: null,
    },
    // Snapshot of the effective-dated SCHADS award-rate set used for this
    // compute (resolved by periodStart) — recomputes of historical fortnights
    // must reproduce historical dollars.
    awardRateSetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AwardRateSet',
      default: null,
    },
    awardRateSetLabel: { type: String, default: null },
    // Backend-computed dollars (hours × staff rate card via wageCalculator).
    // null when the staff member has no matching rate card.
    gross: { type: Number, default: null },
    grossSource: { type: String, default: null }, // 'rate-card' when computed
    breakdownLines: {
      type: [
        {
          _id: false,
          label: String,
          hours: Number,
          effRate: Number,
          pay: Number,
          cat: String, // 'ord' | 'penalty' | 'ot' | 'ot76'
        },
      ],
      default: [],
    },
    // Personal Care — time of day (weekdays only)
    morningHours: { type: Number, default: 0 },
    afternoonHours: { type: Number, default: 0 },
    nightHours: { type: Number, default: 0 },
    // Weekday overtime tiers
    weekdayOtUpto2: { type: Number, default: 0 },
    weekdayOtAfter2: { type: Number, default: 0 },
    // Saturday
    saturdayHours: { type: Number, default: 0 },
    saturdayOtUpto2: { type: Number, default: 0 },
    saturdayOtAfter2: { type: Number, default: 0 },
    // Sunday
    sundayHours: { type: Number, default: 0 },
    sundayOtUpto2: { type: Number, default: 0 },
    sundayOtAfter2: { type: Number, default: 0 },
    // Holiday
    holidayHours: { type: Number, default: 0 },
    holidayOtUpto2: { type: Number, default: 0 },
    holidayOtAfter2: { type: Number, default: 0 },
    // Nursing Care (flat rate)
    nursingCareHours: { type: Number, default: 0 },
    nursingAfternoonHours: { type: Number, default: 0 },
    nursingNightHours: { type: Number, default: 0 },
    nursingSaturdayHours: { type: Number, default: 0 },
    nursingSundayHours: { type: Number, default: 0 },
    nursingHolidayHours: { type: Number, default: 0 },
    shortTurnaroundHours: { type: Number, default: 0 },
    // 76-hour universal cap overflow — tracked by day type for correct rates
    otAfter76Hours: { type: Number, default: 0 },       // total (legacy compat)
    otAfter76Weekday: { type: Number, default: 0 },      // weekday OT rates (1.5×/2×)
    otAfter76Saturday: { type: Number, default: 0 },     // Sat OT rates (1.5×/2×)
    otAfter76Sunday: { type: Number, default: 0 },       // Sun rate (2.0× flat)
    otAfter76Holiday: { type: Number, default: 0 },      // PH rate (2.5× flat)
    otAfter76WeekdayUpto2: { type: Number, default: 0 }, // global 1.5× band (WD+Sat combined)
    otAfter76WeekdayAfter2: { type: Number, default: 0 },
    otAfter76SaturdayUpto2: { type: Number, default: 0 },
    otAfter76SaturdayAfter2: { type: Number, default: 0 },
    // Shift counts
    brokenShiftCount:       { type: Number, default: 0 }, // days with 1 break ($20.82)
    brokenShift2BreakCount: { type: Number, default: 0 }, // days with 2 breaks ($27.56)
    mealAllowanceCount:     { type: Number, default: 0 }, // shifts where OT>1h (+1 each) or OT>4h (+2 each)
    sleepoversCount: { type: Number, default: 0 },
    /** Personal care shifts under 2h (minimum payment review; engine pays actual hours). */
    minimumEngagementExceptionCount: { type: Number, default: 0 },
    totalKm: { type: Number, default: 0 },
    computedAt: {
      type: Date,
      default: null,
    },
    manualFields: {
      type: Map,
      of: Number,
      default: undefined,
    },
    isManuallyAdjusted: { type: Boolean, default: false },
    adjustedAt: { type: Date, default: null },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PayHours = mongoose.model('PayHours', payHoursSchema);
