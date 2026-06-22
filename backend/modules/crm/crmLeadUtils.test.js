import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDaysStale, enrichLead, stripLeadComputedFields } from './crmLeadUtils.js';

test('computeDaysStale returns null without dateReceived', () => {
  assert.equal(computeDaysStale({}), null);
  assert.equal(computeDaysStale({ dateReceived: null }), null);
});

test('computeDaysStale counts days from dateReceived', () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const anchor = new Date(today);
  anchor.setDate(anchor.getDate() - 11);
  assert.equal(computeDaysStale({ dateReceived: anchor }), 11);
});

test('computeDaysStale is never negative', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  assert.equal(computeDaysStale({ dateReceived: tomorrow }), 0);
});

test('enrichLead adds computed daysStale', () => {
  const anchor = new Date();
  anchor.setDate(anchor.getDate() - 3);
  const enriched = enrichLead({ leadId: 'L001', dateReceived: anchor });
  assert.equal(enriched.daysStale, 3);
});

test('stripLeadComputedFields removes daysStale', () => {
  const body = stripLeadComputedFields({ leadId: 'L001', daysStale: 99, status: 'New' });
  assert.deepEqual(body, { leadId: 'L001', status: 'New' });
});
