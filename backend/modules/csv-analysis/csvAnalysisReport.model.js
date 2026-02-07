import mongoose from 'mongoose';

const csvAnalysisReportSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    fileName: String,
    totalRows: Number,
    cachedRows: Number,
    freshRows: Number,
    tokensUsed: Number,
    results: [mongoose.Schema.Types.Mixed],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: true }
);

export const CsvAnalysisReport = mongoose.model(
  'CsvAnalysisReport',
  csvAnalysisReportSchema
);
