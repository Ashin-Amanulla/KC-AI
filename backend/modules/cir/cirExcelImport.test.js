import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCirRow } from './cirExcelImport.js';

test('parseCirRow maps header columns', () => {
  const row = {
    'CIR ID': 'CIR-2026-001',
    'Date Raised': '11/06/2026',
    'Client / Area': "Sunny's Team",
    'Issue / Task Description': 'Welfare check calls',
    'Issue Source': 'Other',
    Priority: 'Medium',
    'Entered By (Name)': 'Sharada',
    'Date Entered': '11/06/2026',
    'Responsible Officer': 'Sharada',
    Department: 'HR',
    'Actions ': 'Conduct welfare check calls',
    'Root Cause': 'Process improvement',
    'Due Date': '12/06/2026',
    'Review Date': '',
    Status: 'Open',
    'Outcome / Evidence': '',
    'Date Closed': '',
    Notes: '',
  };
  const parsed = parseCirRow(row);
  assert.equal(parsed.cirId, 'CIR-2026-001');
  assert.equal(parsed.clientArea, "Sunny's Team");
  assert.equal(parsed.issueSource, 'Other');
  assert.equal(parsed.actions, 'Conduct welfare check calls');
  assert.equal(parsed.status, 'Open');
});

test('parseCirRow returns null without cir id', () => {
  assert.equal(parseCirRow({ 'CIR ID': '' }), null);
});
