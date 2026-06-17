import mongoose from 'mongoose';

const crmStaffingRequirementSchema = new mongoose.Schema(
  {
    participant: { type: String, trim: true, default: '' },
    staffRequired: { type: Number, default: null },
    supportWorkerAge: { type: String, trim: true, default: '' },
    sex: { type: String, trim: true, default: '' },
    drivingLicenseRequired: { type: String, trim: true, default: '' },
    vehicleRequired: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

crmStaffingRequirementSchema.index({ participant: 1, dueDate: 1 });

export const CrmStaffingRequirement = mongoose.model(
  'CrmStaffingRequirement',
  crmStaffingRequirementSchema
);
