import mongoose from 'mongoose';

const shiftPayHoursSchema = new mongoose.Schema(
  {
    payHoursId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayHours',
      required: true,
      index: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      index: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
    },
    shiftDate: { type: Date, required: true },
    shiftStart: { type: Date, required: true },
    shiftEnd: { type: Date, required: true },
    shiftType: { type: String, required: true },
    clientName: { type: String, default: null },
    totalHours: { type: Number, default: 0 },
    morningHours: { type: Number, default: 0 },
    afternoonHours: { type: Number, default: 0 },
    nightHours: { type: Number, default: 0 },
    saturdayHours: { type: Number, default: 0 },
    sundayHours: { type: Number, default: 0 },
    holidayHours: { type: Number, default: 0 },
    nursingCareHours: { type: Number, default: 0 },
    weekdayOtUpto2: { type: Number, default: 0 },
    weekdayOtAfter2: { type: Number, default: 0 },
    saturdayOtUpto2: { type: Number, default: 0 },
    saturdayOtAfter2: { type: Number, default: 0 },
    sundayOtUpto2: { type: Number, default: 0 },
    sundayOtAfter2: { type: Number, default: 0 },
    holidayOtUpto2: { type: Number, default: 0 },
    holidayOtAfter2: { type: Number, default: 0 },
    isBrokenShift: { type: Boolean, default: false },
    isSleepover: { type: Boolean, default: false },
    mileage: { type: Number, default: null },
  },
  {
    timestamps: true,
  }
);

shiftPayHoursSchema.index({ payHoursId: 1, shiftStart: 1 });

export const ShiftPayHours = mongoose.model('ShiftPayHours', shiftPayHoursSchema);
