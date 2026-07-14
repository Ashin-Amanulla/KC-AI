import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    testName: { type: String, required: true },
    ruleIds: { type: [String], default: [] }, // parsed from [Rxxx] tags
    file: { type: String, default: '' },
    status: { type: String, enum: ['pass', 'fail'], required: true },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },
  },
  { _id: false }
);

const ruleTestRunSchema = new mongoose.Schema(
  {
    ranAt: { type: Date, default: Date.now, index: true },
    ranBy: { type: String, default: null }, // user email/name
    durationMs: { type: Number, default: null },
    gitSha: { type: String, default: null },
    awardRateSetLabel: { type: String, default: null },
    totals: {
      pass: { type: Number, default: 0 },
      fail: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    ok: { type: Boolean, default: false },
    results: { type: [resultSchema], default: [] },
  },
  { timestamps: true }
);

const HISTORY_CAP = 100;

ruleTestRunSchema.statics.pruneHistory = async function pruneHistory() {
  const excess = await this.countDocuments() - HISTORY_CAP;
  if (excess > 0) {
    const oldest = await this.find({}).sort({ ranAt: 1 }).limit(excess).select('_id').lean();
    await this.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
  }
};

export const RuleTestRun = mongoose.model('RuleTestRun', ruleTestRunSchema);
