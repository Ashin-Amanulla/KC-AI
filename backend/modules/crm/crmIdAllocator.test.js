import assert from 'node:assert';
import test from 'node:test';
import {
  maxNumericSuffix,
  formatNextId,
  CRM_ID_CONFIG,
} from './crmIdAllocator.js';

test('maxNumericSuffix picks highest matching PREFIX-NUM id', () => {
  const ids = ['SC-001', 'SC-ABC', 'SC-010', 'sc-002', 'L-0001'];
  assert.strictEqual(maxNumericSuffix(ids, 'SC'), 10);
  assert.strictEqual(maxNumericSuffix(ids, 'L'), 1);
  assert.strictEqual(maxNumericSuffix(['SC-ABC'], 'SC'), 0);
});

test('formatNextId pads correctly', () => {
  assert.strictEqual(formatNextId('SC', 3, 0), 'SC-001');
  assert.strictEqual(formatNextId('SC', 3, 10), 'SC-011');
  assert.strictEqual(formatNextId('L', 4, 2), 'L-0003');
  assert.strictEqual(formatNextId('ACT', 4, 99), 'ACT-0100');
});

test('CRM_ID_CONFIG has expected entities', () => {
  assert.ok(CRM_ID_CONFIG['support-coordinators']);
  assert.ok(CRM_ID_CONFIG.leads);
  assert.ok(CRM_ID_CONFIG['marketing-activities']);
  assert.strictEqual(CRM_ID_CONFIG.leads.prefix, 'L');
});
