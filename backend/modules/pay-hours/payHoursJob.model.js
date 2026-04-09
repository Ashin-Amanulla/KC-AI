import mongoose from 'mongoose';

const payHoursJobSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    progress: { type: Number, default: 0 },
    staffProcessed: { type: Number, default: 0 },
    payHoursCreated: { type: Number, default: 0 },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    errors: { type: [String], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const PayHoursJob = mongoose.model('PayHoursJob', payHoursJobSchema);
