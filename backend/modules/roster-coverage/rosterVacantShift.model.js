import mongoose from 'mongoose';

const vacancyReasonEnum = ['sick_call', 'vacancy', 'other'];

const updateLogSchema = new mongoose.Schema(
  {
    authorName: { type: String, trim: true, default: 'Staff' },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true, _id: true }
);

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
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    notes: { type: String, default: '' },
    updateLogs: { type: [updateLogSchema], default: [] },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'filled', 'cancelled'],
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
    shiftcareShiftId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const RosterVacantShift = mongoose.model('RosterVacantShift', rosterVacantShiftSchema);
export const ROSTER_VACANCY_REASONS = vacancyReasonEnum;
