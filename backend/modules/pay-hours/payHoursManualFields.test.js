import assert from 'node:assert';
import test from 'node:test';
import {
  applyManualFields,
  pickManualFields,
  serializePayHoursRecord,
  STAFF_MANUAL_FIELD_KEYS,
} from './payHoursManualFields.js';

test('pickManualFields accepts only allowed numeric keys', () => {
  const picked = pickManualFields(
    { morningHours: '8', weekdayOtAfter2: 2, bogus: 99 },
    STAFF_MANUAL_FIELD_KEYS
  );
  assert.strictEqual(picked.morningHours, 8);
  assert.strictEqual(picked.weekdayOtAfter2, 2);
  assert.strictEqual(picked.bogus, undefined);
});

test('applyManualFields lets manual override computed', () => {
  const effective = applyManualFields(
    { morningHours: 4, afternoonHours: 2 },
    { afternoonHours: 6 },
    STAFF_MANUAL_FIELD_KEYS
  );
  assert.strictEqual(effective.morningHours, 4);
  assert.strictEqual(effective.afternoonHours, 6);
});

test('serializePayHoursRecord exposes computed and effective values', () => {
  const row = serializePayHoursRecord({
    _id: '507f1f77bcf86cd799439011',
    staffName: 'Test Staff',
    morningHours: 4,
    manualFields: { morningHours: 5 },
    isManuallyAdjusted: true,
  });
  assert.strictEqual(row.morningHours, 5);
  assert.strictEqual(row.computed.morningHours, 4);
  assert.strictEqual(row.manualFields.morningHours, 5);
  assert.strictEqual(row.isManuallyAdjusted, true);
});
