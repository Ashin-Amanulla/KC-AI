import mongoose from 'mongoose';

const crmMarketingActivitySchema = new mongoose.Schema(
  {
    activityId: { type: String, required: true, trim: true, unique: true, index: true },
    date: { type: Date, default: null },
    activityType: { type: String, trim: true, default: '' },
    relatedScOrLeadId: { type: String, trim: true, default: '' },
    organisationName: { type: String, trim: true, default: '' },
    channel: { type: String, trim: true, default: '' },
    objective: { type: String, trim: true, default: '' },
    outcome: { type: String, trim: true, default: '' },
    followUpRequired: { type: Boolean, default: false },
    followUpOwner: { type: String, trim: true, default: '' },
    nextActionDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const CrmMarketingActivity = mongoose.model(
  'CrmMarketingActivity',
  crmMarketingActivitySchema
);
