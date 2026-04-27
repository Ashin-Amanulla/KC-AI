import mongoose from 'mongoose';

const ratesSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    daytime: { type: Number, default: 0 },
    afternoon: { type: Number, default: 0 },
    night: { type: Number, default: 0 },
    otUpto2: { type: Number, default: 0 },
    otAfter2: { type: Number, default: 0 },
    saturday: { type: Number, default: 0 },
    satOtAfter2: { type: Number, default: 0 },
    sunday: { type: Number, default: 0 },
    ph: { type: Number, default: 0 },
    mealAllow: { type: Number, default: 0 },
    brokenShift: { type: Number, default: 0 },
    sleepover: { type: Number, default: 0 },
    sleepoverExtra: { type: Number, default: 0 },
    kmRate: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
  },
  { _id: false }
);

const staffSchadsRateSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    shiftcareStaffId: { type: String, required: true, trim: true },
    staffName: { type: String, required: true, trim: true },
    normName: { type: String, required: true, trim: true, index: true },
    rates: { type: ratesSchema, required: true },
  },
  { timestamps: true }
);

staffSchadsRateSchema.index({ locationId: 1, shiftcareStaffId: 1 }, { unique: true });

export const StaffSchadsRate = mongoose.model('StaffSchadsRate', staffSchadsRateSchema);
