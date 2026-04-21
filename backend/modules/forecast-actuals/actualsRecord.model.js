import mongoose from 'mongoose';

const actualsRowSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    clientDirectoryId: { type: String, required: true, index: true },
    staffDirectoryId: { type: String, default: null, index: true },
    clientName: { type: String, required: true },
    staffName: { type: String, default: '' },
    shiftDescription: { type: String, default: '' },
    shiftcareId: { type: String, default: '' },
    shiftDate: { type: Date, required: true, index: true },
    startDatetime: { type: Date, required: true, index: true },
    endDatetime: { type: Date, required: true },
    duration: { type: Number, required: true },
    cost: { type: Number, required: true },
    additionalCost: { type: Number, default: 0 },
    kms: { type: Number, default: 0 },
    totalCost: { type: Number, required: true },
    isAbsent: { type: Boolean, default: false },
    status: { type: String, default: '' },
    invoiceNumbers: { type: String, default: '' },
    rateGroups: { type: String, default: '' },
    referenceNo: { type: String, default: '' },
    shiftType: { type: String, default: '' },
    additionalShiftType: { type: String, default: '' },
    clientType: { type: String, default: '' },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

actualsRowSchema.index({ location: 1, shiftDate: -1 });
actualsRowSchema.index({ location: 1, clientDirectoryId: 1 });
actualsRowSchema.index({ location: 1, shiftcareId: 1 });

export const ActualsRecord = mongoose.model('ActualsRecord', actualsRowSchema);
