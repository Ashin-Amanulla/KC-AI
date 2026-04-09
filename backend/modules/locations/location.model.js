import mongoose from 'mongoose';

const AUSTRALIAN_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
];

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // Uppercase code used for fixture loading, e.g. "BRISBANE", "SYDNEY"
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    timezone: {
      type: String,
      enum: AUSTRALIAN_TIMEZONES,
      default: 'Australia/Brisbane',
    },
    pricingRegion: {
      type: String,
      enum: ['National', 'Remote', 'Very Remote'],
      default: 'National',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const TIMEZONE_OPTIONS = AUSTRALIAN_TIMEZONES;
export const Location = mongoose.model('Location', locationSchema);
