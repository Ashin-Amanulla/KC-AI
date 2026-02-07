import mongoose from 'mongoose';

const csvAnalysisCacheSchema = new mongoose.Schema(
  {
    rowHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    analysisResult: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    modelVersion: {
      type: String,
      default: 'gpt-4o',
    },
    promptVersion: {
      type: String,
      default: 'v1',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: true }
);

csvAnalysisCacheSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
); // TTL 30 days

export const CsvAnalysisCache = mongoose.model(
  'CsvAnalysisCache',
  csvAnalysisCacheSchema
);
