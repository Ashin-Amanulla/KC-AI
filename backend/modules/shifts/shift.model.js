import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    staffName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    clientName: {
      type: String,
      trim: true,
      default: null,
    },
    startDatetime: {
      type: Date,
      required: true,
      index: true,
    },
    endDatetime: {
      type: Date,
      required: true,
    },
    hours: {
      type: Number,
      required: true,
    },
    shiftType: {
      type: String,
      enum: ['personal_care', 'sleepover', 'nursing_support'],
      required: true,
      default: 'personal_care',
    },
    isBrokenShift: {
      type: Boolean,
      default: false,
      index: true,
    },
    dayOfWeek: {
      type: Number, // 0=Mon…6=Sun
      min: 0,
      max: 6,
    },
    timezoneOffset: {
      type: String,
      default: '+10:00',
    },
    shiftStatus: {
      type: String,
      default: null,
    },
    absent: {
      type: Boolean,
      default: false,
    },
    mileage: {
      type: Number,
      default: null,
    },
    expense: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    shiftcareUrl: {
      type: String,
      default: '',
    },
    shiftcareId: {
      type: String,
      default: null,
    },
    clockinDatetime: {
      type: Date,
      default: null,
    },
    clockoutDatetime: {
      type: Date,
      default: null,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

shiftSchema.index({ staffName: 1, startDatetime: 1 });
shiftSchema.index({ startDatetime: 1, endDatetime: 1 });

export const Shift = mongoose.model('Shift', shiftSchema);
