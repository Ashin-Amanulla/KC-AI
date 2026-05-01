import mongoose from 'mongoose';

const rosterCoverageAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['find_cover', 'contacted', 'confirmed', 'timesheet_upload'],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    vacantShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterVacantShift',
      default: null,
    },
    rosterStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RosterStaff',
      default: null,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

rosterCoverageAuditSchema.index({ createdAt: -1 });

export const RosterCoverageAudit = mongoose.model('RosterCoverageAudit', rosterCoverageAuditSchema);
