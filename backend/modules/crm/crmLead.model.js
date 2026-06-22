import mongoose from 'mongoose';
import { PARTICIPANT_TYPES, LEAD_STAGES, LEAD_STATUSES } from './crm.constants.js';

const crmLeadSchema = new mongoose.Schema(
  {
    bdmOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    leadId: { type: String, required: true, trim: true, unique: true, index: true },
    dateReceived: { type: Date, default: null },
    name: { type: String, trim: true, default: '' },
    referralSource: { type: String, trim: true, default: '' },
    referralPhone: { type: String, trim: true, default: '' },
    referralEmail: { type: String, trim: true, default: '' },
    requirementSummary: { type: String, trim: true, default: '' },
    participantType: {
      type: String,
      enum: [...PARTICIPANT_TYPES, ''],
      default: '',
    },
    currentStage: {
      type: String,
      enum: [...LEAD_STAGES, ''],
      default: '',
    },
    status: {
      type: String,
      enum: [...LEAD_STATUSES, ''],
      default: '',
    },
    lastContactDate: { type: Date, default: null },
    followUpNotes: { type: String, trim: true, default: '' },
    meetAndGreetPlanned: { type: Boolean, default: false },
    meetAndGreetDateTime: { type: Date, default: null },
    estAnnualValue: { type: Number, default: null },
    daysStale: { type: Number, default: null },
    lostReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const CrmLead = mongoose.model('CrmLead', crmLeadSchema);
