import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichCostMapWithStaffRateAliases } from '../lib/staffCostMapEnrich.js';

test('enrichCostMapWithStaffRateAliases links billing alias to pay-hours cost row', () => {
  const costMap = new Map([
    [
      'jonathan smith',
      { name: 'Jonathan Smith', earnings: 500, superAmt: 57.5, totalCost: 557.5 },
    ],
  ]);
  enrichCostMapWithStaffRateAliases(costMap, [
    {
      staffName: 'Jonathan Smith',
      normName: 'jonathan smith',
      rates: { daytime: 35 },
      aliases: ['John Smith'],
    },
  ]);
  assert.ok(costMap.has('john smith'));
  assert.equal(costMap.get('john smith').earnings, 500);
});

test('enrichCostMapWithStaffRateAliases finds row when pay hours uses alias spelling', () => {
  const costMap = new Map([
    ['john smith', { name: 'John Smith', earnings: 120, superAmt: 13.8, totalCost: 133.8 }],
  ]);
  enrichCostMapWithStaffRateAliases(costMap, [
    {
      staffName: 'Jonathan Smith',
      normName: 'jonathan smith',
      rates: { daytime: 35 },
      aliases: ['John Smith'],
    },
  ]);
  assert.ok(costMap.has('jonathan smith'));
  assert.equal(costMap.get('jonathan smith').earnings, 120);
});
