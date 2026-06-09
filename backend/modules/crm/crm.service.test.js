import assert from 'node:assert';
import mongoose from 'mongoose';
import test from 'node:test';
import { connectDB, markMongoShutdown } from '../../config/db.js';
import { getDashboardSummary } from './crm.service.js';

test('getDashboardSummary returns expected shape', async (t) => {
  try {
    await connectDB();
  } catch {
    t.skip('MongoDB not available');
    return;
  }

  try {
    const summary = await getDashboardSummary();
    assert.ok(summary.keyMetrics);
    assert.ok('totalSupportCoordinators' in summary.keyMetrics);
    assert.ok('totalLeads' in summary.keyMetrics);
    assert.ok(summary.followUps);
    assert.ok('scFollowUpsOverdue' in summary.followUps);
    assert.ok(summary.activitySummary);
    assert.ok(summary.relationshipStatus);
    assert.ok(typeof summary.relationshipStatus.Cold === 'number');
  } finally {
    markMongoShutdown();
    await mongoose.disconnect();
  }
});
