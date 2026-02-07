import mongoose from 'mongoose';

const csvAnalysisJobSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    fileName: String,
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    progress: { type: Number, default: 0 },
    totalRows: Number,
    processedRows: { type: Number, default: 0 },
    estimatedSeconds: Number,
    error: String,
    results: [mongoose.Schema.Types.Mixed],
    startedAt: Date,
    completedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: true }
);

export const CsvAnalysisJob = mongoose.model(
  'CsvAnalysisJob',
  csvAnalysisJobSchema
);
