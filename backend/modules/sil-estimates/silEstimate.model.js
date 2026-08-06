import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.Mixed, required: true },
    label: { type: String, trim: true, default: '' },
    start: { type: String, trim: true, default: '' },
    end: { type: String, trim: true, default: '' },
    templateId: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    budget: { type: Number, default: 0 },
    planStart: { type: String, trim: true, default: '' },
    planEnd: { type: String, trim: true, default: '' },
    activeTemplateId: { type: String, trim: true, default: '' },
    segments: { type: [segmentSchema], default: [] },
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.Mixed },
    date: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const silEstimateSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    state: { type: String, trim: true, default: 'QLD' },
    ratesNew: { type: mongoose.Schema.Types.Mixed, default: {} },
    ratesOld: { type: mongoose.Schema.Types.Mixed, default: {} },
    oldRatesConfirmed: { type: Boolean, default: true },
    holidays: { type: [holidaySchema], default: [] },
    templates: { type: mongoose.Schema.Types.Mixed, default: {} },
    participants: { type: [participantSchema], default: [] },
    activeParticipantName: { type: String, trim: true, default: '' },
    computedSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

silEstimateSchema.index({ name: 1 });
silEstimateSchema.index({ updatedAt: -1 });

export const SilEstimate = mongoose.model('SilEstimate', silEstimateSchema);
