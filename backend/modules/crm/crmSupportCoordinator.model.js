import mongoose from 'mongoose';
import { RELATIONSHIP_STATUSES } from './crm.constants.js';

const crmSupportCoordinatorSchema = new mongoose.Schema(
  {
    bdmOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    scId: { type: String, required: true, trim: true, unique: true, index: true },
    coordinatorName: { type: String, trim: true, default: '' },
    organisation: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    relationshipStatus: {
      type: String,
      enum: [...RELATIONSHIP_STATUSES, ''],
      default: '',
    },
    currentParticipants: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    lastContactDate: { type: Date, default: null },
    nextFollowUpDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    specialty: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: '' },
    linkedLeadIds: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

export const CrmSupportCoordinator = mongoose.model(
  'CrmSupportCoordinator',
  crmSupportCoordinatorSchema
);
