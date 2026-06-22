import test from 'node:test';
import assert from 'node:assert/strict';
import { maxCirSuffix, formatCirId, cirIdPrefixForYear } from './cirIdAllocator.js';

test('cirIdPrefixForYear', () => {
  assert.equal(cirIdPrefixForYear(2026), 'CIR-2026');
});

test('maxCirSuffix finds highest suffix for year', () => {
  const ids = ['CIR-2026-001', 'CIR-2026-012', 'CIR-2025-099'];
  assert.equal(maxCirSuffix(ids, 2026), 12);
});

test('formatCirId pads suffix', () => {
  assert.equal(formatCirId(2026, 3), 'CIR-2026-003');
});
