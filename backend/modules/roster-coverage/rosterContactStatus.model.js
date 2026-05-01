import mongoose from 'mongoose';

/** Per vacant shift + staff: contacted / confirmed tracking (Phase 3). */
const rosterContactStatusSchema = new mongoose.Schema(
  {
    vacantShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterVacantShift',
      required: true,
      index: true,
    },
    rosterStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterStaff',
      required: true,
      index: true,
    },
    contacted: { type: Boolean, default: false },
    contactedAt: { type: Date, default: null },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rosterContactStatusSchema.index({ vacantShiftId: 1, rosterStaffId: 1 }, { unique: true });

export const RosterContactStatus = mongoose.model('RosterContactStatus', rosterContactStatusSchema);
