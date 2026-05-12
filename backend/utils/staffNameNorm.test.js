import assert from 'node:assert';
import { describe, it } from 'node:test';
import { nameMatchKeys, normFromLastCommaFirst, normStaffNameForMatch } from './staffNameNorm.js';

describe('staffNameNorm', () => {
  it('normFromLastCommaFirst maps Last, First to first last', () => {
    assert.strictEqual(normFromLastCommaFirst('Bloggs, Joe'), 'joe bloggs');
    assert.strictEqual(normFromLastCommaFirst('Bloggs,Joe'), 'joe bloggs');
  });

  it('nameMatchKeys links roster First Last with export Last, First', () => {
    const roster = normStaffNameForMatch('Joe Bloggs');
    const keys = nameMatchKeys('Bloggs, Joe');
    assert.ok(keys.has(roster), `expected keys ${[...keys].join(',')} to include ${roster}`);
  });

  it('normStaffNameForMatch on Last, First without comma handler is not enough', () => {
    const bad = normStaffNameForMatch('Bloggs, Joe');
    const good = normStaffNameForMatch('Joe Bloggs');
    assert.notStrictEqual(bad, good);
  });
});
