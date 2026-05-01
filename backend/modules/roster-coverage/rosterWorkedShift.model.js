import mongoose from 'mongoose';

const shiftStatusEnum = ['active', 'completed', 'cancelled'];

const rosterWorkedShiftSchema = new mongoose.Schema(
  {
    rosterStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterStaff',
      required: true,
      index: true,
    },
    rosterParticipantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterParticipant',
      required: true,
      index: true,
    },
    startDatetime: { type: Date, required: true, index: true },
    endDatetime: { type: Date, required: true },
    sleepover: { type: Boolean, default: false },
    sleepoverStart: { type: Date, default: null },
    shiftStatus: {
      type: String,
      enum: shiftStatusEnum,
      default: 'completed',
    },
  },
  { timestamps: true }
);

rosterWorkedShiftSchema.index({ rosterStaffId: 1, startDatetime: 1 });
rosterWorkedShiftSchema.index({ rosterStaffId: 1, endDatetime: 1 });

export const RosterWorkedShift = mongoose.model('RosterWorkedShift', rosterWorkedShiftSchema);
export const ROSTER_WORKED_SHIFT_STATUS = shiftStatusEnum;
