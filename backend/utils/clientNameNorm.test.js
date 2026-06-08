import assert from 'node:assert';
import test from 'node:test';
import { normClientNameForMatch, resolveClientEntry } from './clientNameNorm.js';

test('normClientNameForMatch trims and collapses spaces', () => {
  assert.strictEqual(normClientNameForMatch('  Amy  Hamerslag '), 'amy hamerslag');
});

test('resolveClientEntry matches collapsed directory keys', () => {
  const clientMap = new Map([
    ['amy hamerslag', { id: '1', displayName: 'Amy Hamerslag' }],
  ]);
  assert.deepStrictEqual(resolveClientEntry('  Amy   Hamerslag', clientMap), {
    id: '1',
    displayName: 'Amy Hamerslag',
  });
  assert.strictEqual(resolveClientEntry('Unknown Client', clientMap), null);
});
