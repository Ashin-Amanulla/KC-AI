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
    // 76-hour universal cap overflow — tracked by day type for correct rates
    otAfter76Hours: { type: Number, default: 0 },       // total (legacy compat)
    otAfter76Weekday: { type: Number, default: 0 },      // weekday OT rates (1.5×/2×)
    otAfter76Saturday: { type: Number, default: 0 },     // Sat OT rates (1.5×/2×)
    otAfter76Sunday: { type: Number, default: 0 },       // Sun rate (2.0× flat)
    otAfter76Holiday: { type: Number, default: 0 },      // PH rate (2.5× flat)
    // Shift counts
    brokenShiftCount: { type: Number, default: 0 },
    sleepoversCount: { type: Number, default: 0 },
    computedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PayHours = mongoose.model('PayHours', payHoursSchema);
