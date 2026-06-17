import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  parseSupportCoordinatorRow,
  parseLeadRow,
  parseStaffingRequirementRow,
  parseWorkbookBuffer,
  parseBoolean,
  parseLinkedLeadIds,
} from './crmExcelImport.js';

test('parseBoolean handles common values', () => {
  assert.strictEqual(parseBoolean('Y'), true);
  assert.strictEqual(parseBoolean('yes'), true);
  assert.strictEqual(parseBoolean('N'), false);
  assert.strictEqual(parseBoolean(''), false);
});

test('parseLinkedLeadIds splits comma-separated IDs', () => {
  assert.deepStrictEqual(parseLinkedLeadIds('L-0001, L-0002'), ['L-0001', 'L-0002']);
  assert.deepStrictEqual(parseLinkedLeadIds(''), []);
});

test('parseSupportCoordinatorRow maps Excel columns', () => {
  const row = {
    'SC_ID (Unique)': 'SC-001',
    'Coordinator Name': 'Jane Doe',
    Organisation: 'Acme',
    Phone: '0400 000 000',
    Email: 'jane@example.com',
    'Relationship Status': 'Warm',
    'Current Participants': 'Alice',
    Location: 'Brisbane',
    'Last Contact Date': '2026-01-15',
    'Next Follow-up Date': '2026-02-01',
    Notes: 'Test note',
    'Specialty (Complex/HI/etc)': 'Complex',
    Source: 'Referral',
    'Linked Lead ID(s)': 'L-0001, L-0002',
  };
  const parsed = parseSupportCoordinatorRow(row);
  assert.strictEqual(parsed.scId, 'SC-001');
  assert.strictEqual(parsed.coordinatorName, 'Jane Doe');
  assert.strictEqual(parsed.relationshipStatus, 'Warm');
  assert.deepStrictEqual(parsed.linkedLeadIds, ['L-0001', 'L-0002']);
});

test('parseLeadRow maps Excel columns', () => {
  const row = {
    'Lead ID (Unique)': 'L-0001',
    'Date Received': '2026-02-09',
    Name: 'Test Lead',
    'Referral Source (Name/Org)': 'Hospital',
    'Referral Phone': '0400111222',
    'Referral Email': 'ref@example.com',
    'Participant Type': 'SIL Only',
    'Current Stage': 'Active',
    Status: 'New',
    'Meet & Greet Planned': 'Yes',
    'Est. Annual Value ($)': '50000',
  };
  const parsed = parseLeadRow(row);
  assert.strictEqual(parsed.leadId, 'L-0001');
  assert.strictEqual(parsed.name, 'Test Lead');
  assert.strictEqual(parsed.participantType, 'SIL Only');
  assert.strictEqual(parsed.status, 'New');
  assert.strictEqual(parsed.meetAndGreetPlanned, true);
  assert.strictEqual(parsed.estAnnualValue, 50000);
});

test('parseStaffingRequirementRow maps Excel columns', () => {
  const row = {
    Participant: 'Brandon',
    'Staff Required': 1,
    'Support Worker Age': '20-30',
    Sex: 'Male',
    'Driving License Required': 'Yes',
    'Vehicle Required': 'Yes',
    Location: 'Caboolture',
    'Start Date': '2026-03-01',
    'End Date': '2026-03-31',
    'Due Date': '2026-03-14',
    Notes: 'Coverage needed',
    Completed: 'No',
  };
  const parsed = parseStaffingRequirementRow(row);
  assert.strictEqual(parsed.participant, 'Brandon');
  assert.strictEqual(parsed.staffRequired, 1);
  assert.strictEqual(parsed.completed, false);
  assert.ok(parsed.startDate instanceof Date);
  assert.ok(parsed.endDate instanceof Date);
});

test('parseWorkbookBuffer reads sample BDM tracker', () => {
  const samplePath = path.resolve(process.cwd(), '../tmp/test/BDM Master Tracker.xlsx');
  if (!fs.existsSync(samplePath)) {
    return;
  }
  const buffer = fs.readFileSync(samplePath);
  const sheets = parseWorkbookBuffer(buffer);
  assert.ok(sheets.supportCoordinators.length > 0);
  assert.ok(sheets.leads.length > 0);
  assert.ok(sheets.staffingRequirements.length > 0);
});
