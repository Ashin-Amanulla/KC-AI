import mongoose from 'mongoose';

export const HOLIDAY_RULES = [
  'good_friday',
  'easter_saturday',
  'easter_sunday',
  'easter_monday',
  'first_monday_march',
  'first_monday_may',
  'first_monday_june',
  'first_monday_august',
  'first_monday_october',
  'second_monday_march',
  'second_monday_june',
  'first_tuesday_november',
  'second_wednesday_august',
  'last_monday_september',
];

const holidaySchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    /** @deprecated use month+day or rule; still read for migration / old rows */
    date: { type: Date, default: null, index: true },
    name: { type: String, required: true, trim: true },
    month: { type: Number, min: 1, max: 12, default: null },
    day: { type: Number, min: 1, max: 31, default: null },
    rule: {
      type: String,
      default: null,
      validate: {
        validator(v) {
          return v == null || HOLIDAY_RULES.includes(v);
        },
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

holidaySchema.index(
  { location: 1, rule: 1 },
  { unique: true, partialFilterExpression: { rule: { $type: 'string' } } }
);
holidaySchema.index(
  { location: 1, month: 1, day: 1 },
  {
    unique: true,
    partialFilterExpression: { rule: null, month: { $type: 'number' }, day: { $type: 'number' } },
  }
);
/** Legacy rows until migrated */
holidaySchema.index(
  { location: 1, date: 1 },
  { unique: true, partialFilterExpression: { date: { $type: 'date' } } }
);

export const Holiday = mongoose.model('Holiday', holidaySchema);
