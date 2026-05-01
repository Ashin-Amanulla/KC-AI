import mongoose from 'mongoose';

/** Approvals: single source of truth — staff IDs approved for this participant. */
const rosterParticipantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    locationLabel: { type: String, trim: true, default: '' },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    timezone: {
      type: String,
      trim: true,
      default: null,
    },
    approvedStaffIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RosterStaff',
      },
    ],
  },
  { timestamps: true }
);

export const RosterParticipant = mongoose.model('RosterParticipant', rosterParticipantSchema);
