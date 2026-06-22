import mongoose from 'mongoose';

const actionUpdateSchema = new mongoose.Schema(
  {
    authorName: { type: String, trim: true, default: 'Staff' },
    authorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, trim: true, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const cirRecordSchema = new mongoose.Schema(
  {
    cirId: { type: String, required: true, trim: true, unique: true, index: true },
    dateRaised: { type: Date, default: null },
    clientArea: { type: String, trim: true, default: '' },
    issueDescription: { type: String, trim: true, default: '' },
    issueSource: { type: String, trim: true, default: '' },
    priority: { type: String, trim: true, default: '' },
    enteredByName: { type: String, trim: true, default: '' },
    dateEntered: { type: Date, default: null },
    responsibleOfficer: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    actions: { type: String, trim: true, default: '' },
    rootCause: { type: String, trim: true, default: '' },
    dueDate: { type: Date, default: null },
    reviewDate: { type: Date, default: null },
    status: { type: String, trim: true, default: 'Open' },
    outcomeEvidence: { type: String, trim: true, default: '' },
    dateClosed: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    actionUpdates: { type: [actionUpdateSchema], default: [] },
  },
  { timestamps: true }
);

export const CirRecord = mongoose.model('CirRecord', cirRecordSchema);
