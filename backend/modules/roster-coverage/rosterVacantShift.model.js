import mongoose from 'mongoose';

const vacancyReasonEnum = ['sick_call', 'vacancy', 'other'];

const rosterVacantShiftSchema = new mongoose.Schema(
  {
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
    reason: {
      type: String,
      enum: vacancyReasonEnum,
      default: 'vacancy',
    },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'filled', 'cancelled'],
      default: 'open',
      index: true,
    },
    filledByStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterStaff',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const RosterVacantShift = mongoose.model('RosterVacantShift', rosterVacantShiftSchema);
export const ROSTER_VACANCY_REASONS = vacancyReasonEnum;
