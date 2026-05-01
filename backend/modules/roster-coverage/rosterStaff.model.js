import mongoose from 'mongoose';

const rosterStaffSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: 'Support Worker' },
    contractedFortnightlyHours: { type: Number, required: true, min: 0 },
    timezone: {
      type: String,
      trim: true,
      default: null,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
  },
  { timestamps: true }
);

export const RosterStaff = mongoose.model('RosterStaff', rosterStaffSchema);
