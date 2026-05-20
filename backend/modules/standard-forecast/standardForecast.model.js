import mongoose from 'mongoose';

const standardForecastSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    clientDirectoryId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    rateGroups: { type: String, default: '' },
    referenceNo: { type: String, default: '' },
    shiftType: { type: String, default: '' },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

standardForecastSchema.index({ location: 1, day: 1, startTime: 1 });
standardForecastSchema.index({ location: 1, clientDirectoryId: 1 });

export const StandardForecast = mongoose.model('StandardForecast', standardForecastSchema);
