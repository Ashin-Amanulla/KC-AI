import * as XLSX from 'xlsx';
import { CRM_SHEETS } from './crm.constants.js';

export function normalizeColumnName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '');
}

export function buildNormalizedColumns(fieldnames) {
  const map = new Map();
  for (const col of fieldnames) {
    const n = normalizeColumnName(col);
    if (!map.has(n)) map.set(n, col);
  }
  return map;
}

export function getRowValue(row, colName, normalizedColumns) {
  const original = normalizedColumns.get(normalizeColumnName(colName));
  if (!original) return '';
  const v = row[original];
  return v == null ? '' : v;
}

export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const t = new Date(String(value).trim()).getTime();
  return Number.isFinite(t) ? new Date(t) : null;
}

export function parseBoolean(value) {
  if (value === true || value === false) return value;
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!s) return false;
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

export function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseLinkedLeadIds(value) {
  const s = String(value ?? '').trim();
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  return rows.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  );
}

export function parseWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return {
    supportCoordinators: sheetToRows(workbook, CRM_SHEETS.SUPPORT_COORDINATORS),
    leads: sheetToRows(workbook, CRM_SHEETS.POTENTIAL_LEADS),
    marketingActivities: sheetToRows(workbook, CRM_SHEETS.MARKETING_ACTIVITIES),
    staffingRequirements: sheetToRows(workbook, CRM_SHEETS.STAFFING_REQUIREMENTS),
  };
}

export function parseSupportCoordinatorRow(row) {
  const cols = buildNormalizedColumns(Object.keys(row));
  const scId = String(getRowValue(row, 'sc_id unique', cols) || getRowValue(row, 'sc_id', cols)).trim();
  if (!scId) return null;

  return {
    scId,
    coordinatorName: String(getRowValue(row, 'coordinator name', cols)).trim(),
    organisation: String(getRowValue(row, 'organisation', cols)).trim(),
    phone: String(getRowValue(row, 'phone', cols)).trim(),
    email: String(getRowValue(row, 'email', cols)).trim(),
    relationshipStatus: String(getRowValue(row, 'relationship status', cols)).trim(),
    currentParticipants: String(getRowValue(row, 'current participants', cols)).trim(),
    location: String(getRowValue(row, 'location', cols)).trim(),
    lastContactDate: parseDate(getRowValue(row, 'last contact date', cols)),
    nextFollowUpDate: parseDate(getRowValue(row, 'next follow-up date', cols)),
    notes: String(getRowValue(row, 'notes', cols)).trim(),
    specialty: String(getRowValue(row, 'specialty complex/hi/etc', cols) || getRowValue(row, 'specialty', cols)).trim(),
    source: String(getRowValue(row, 'source', cols)).trim(),
    linkedLeadIds: parseLinkedLeadIds(
      getRowValue(row, 'linked lead id(s)', cols) || getRowValue(row, 'linked lead ids', cols)
    ),
  };
}

export function parseLeadRow(row) {
  const cols = buildNormalizedColumns(Object.keys(row));
  const leadId = String(getRowValue(row, 'lead id unique', cols) || getRowValue(row, 'lead id', cols)).trim();
  if (!leadId) return null;

  return {
    leadId,
    dateReceived: parseDate(getRowValue(row, 'date received', cols)),
    name: String(getRowValue(row, 'name', cols)).trim(),
    referralSource: String(getRowValue(row, 'referral source name/org', cols) || getRowValue(row, 'referral source', cols)).trim(),
    referralPhone: String(getRowValue(row, 'referral phone', cols)).trim(),
    referralEmail: String(getRowValue(row, 'referral email', cols)).trim(),
    requirementSummary: String(getRowValue(row, 'requirement summary', cols)).trim(),
    participantType: String(getRowValue(row, 'participant type', cols)).trim(),
    currentStage: String(getRowValue(row, 'current stage', cols)).trim(),
    status: String(getRowValue(row, 'status', cols)).trim(),
    lastContactDate: parseDate(getRowValue(row, 'last contact date', cols)),
    followUpNotes: String(getRowValue(row, 'follow up notes', cols)).trim(),
    meetAndGreetPlanned: parseBoolean(getRowValue(row, 'meet & greet planned', cols)),
    meetAndGreetDateTime: parseDate(
      getRowValue(row, 'meet and greet date & time', cols) || getRowValue(row, 'meet and greet date time', cols)
    ),
    estAnnualValue: parseNumber(getRowValue(row, 'est. annual value ($)', cols) || getRowValue(row, 'est annual value', cols)),
    daysStale: parseNumber(getRowValue(row, 'days stale', cols)),
    lostReason: String(getRowValue(row, 'reason lost/deferred', cols) || getRowValue(row, 'reason', cols)).trim(),
  };
}

export function parseMarketingActivityRow(row) {
  const cols = buildNormalizedColumns(Object.keys(row));
  const activityId = String(
    getRowValue(row, 'activity_id unique', cols) || getRowValue(row, 'activity_id', cols)
  ).trim();
  if (!activityId) return null;

  return {
    activityId,
    date: parseDate(getRowValue(row, 'date', cols)),
    activityType: String(getRowValue(row, 'activity type', cols)).trim(),
    relatedScOrLeadId: String(getRowValue(row, 'related sc_id / lead_id', cols) || getRowValue(row, 'related sc id lead id', cols)).trim(),
    organisationName: String(getRowValue(row, 'organisation/name', cols) || getRowValue(row, 'organisation name', cols)).trim(),
    channel: String(getRowValue(row, 'channel email/visit/event/etc', cols) || getRowValue(row, 'channel', cols)).trim(),
    objective: String(getRowValue(row, 'objective', cols)).trim(),
    outcome: String(getRowValue(row, 'outcome', cols)).trim(),
    followUpRequired: parseBoolean(getRowValue(row, 'follow-up required y/n', cols) || getRowValue(row, 'follow up required', cols)),
    followUpOwner: String(getRowValue(row, 'follow-up owner', cols) || getRowValue(row, 'follow up owner', cols)).trim(),
    nextActionDate: parseDate(getRowValue(row, 'next action date', cols)),
    notes: String(getRowValue(row, 'notes', cols)).trim(),
  };
}

export function parseStaffingRequirementRow(row) {
  const cols = buildNormalizedColumns(Object.keys(row));
  const participant = String(getRowValue(row, 'participant', cols)).trim();
  if (!participant) return null;

  return {
    participant,
    staffRequired: parseNumber(getRowValue(row, 'staff required', cols)),
    supportWorkerAge: String(getRowValue(row, 'support worker age', cols)).trim(),
    sex: String(getRowValue(row, 'sex', cols)).trim(),
    drivingLicenseRequired: String(getRowValue(row, 'driving license required', cols)).trim(),
    vehicleRequired: String(getRowValue(row, 'vehicle required', cols)).trim(),
    location: String(getRowValue(row, 'location', cols)).trim(),
    dueDate: parseDate(getRowValue(row, 'due date', cols)),
    notes: String(getRowValue(row, 'notes', cols)).trim(),
    completed: parseBoolean(getRowValue(row, 'completed', cols)),
  };
}

export const SUPPORT_COORDINATOR_EXPORT_HEADERS = [
  'SC_ID (Unique)',
  'Coordinator Name',
  'Organisation',
  'Phone',
  'Email',
  'Relationship Status',
  'Current Participants',
  'Location',
  'Last Contact Date',
  'Next Follow-up Date',
  'Notes',
  'Specialty (Complex/HI/etc)',
  'Source',
  'Linked Lead ID(s)',
];

export const LEAD_EXPORT_HEADERS = [
  'Lead ID (Unique)',
  'Date Received',
  'Name',
  'Referral Source (Name/Org)',
  'Referral Phone',
  'Referral Email',
  'Requirement Summary',
  'Participant Type',
  'Current Stage',
  'Status',
  'Last Contact Date',
  'Follow up Notes',
  'Meet & Greet Planned',
  'Meet and Greet Date & Time',
  'Est. Annual Value ($)',
  'Days Stale',
  'Reason (Lost/Deferred)',
];

export const MARKETING_ACTIVITY_EXPORT_HEADERS = [
  'Activity_ID (Unique)',
  'Date',
  'Activity Type',
  'Related SC_ID / Lead_ID',
  'Organisation/Name',
  'Channel (Email/Visit/Event/etc)',
  'Objective',
  'Outcome',
  'Follow-up Required (Y/N)',
  'Follow-up Owner',
  'Next Action Date',
  'Notes',
];

export const STAFFING_REQUIREMENT_EXPORT_HEADERS = [
  'Participant',
  'Staff Required',
  'Support Worker Age',
  'Sex',
  'Driving License Required',
  'Vehicle Required',
  'Location',
  'Due Date',
  'Notes',
  'Completed',
];

function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
}

export function supportCoordinatorToExportRow(doc) {
  return [
    doc.scId,
    doc.coordinatorName,
    doc.organisation,
    doc.phone,
    doc.email,
    doc.relationshipStatus,
    doc.currentParticipants,
    doc.location,
    fmtDate(doc.lastContactDate),
    fmtDate(doc.nextFollowUpDate),
    doc.notes,
    doc.specialty,
    doc.source,
    (doc.linkedLeadIds || []).join(', '),
  ];
}

export function leadToExportRow(doc) {
  return [
    doc.leadId,
    fmtDate(doc.dateReceived),
    doc.name,
    doc.referralSource,
    doc.referralPhone,
    doc.referralEmail,
    doc.requirementSummary,
    doc.participantType,
    doc.currentStage,
    doc.status,
    fmtDate(doc.lastContactDate),
    doc.followUpNotes,
    doc.meetAndGreetPlanned ? 'Yes' : 'No',
    fmtDateTime(doc.meetAndGreetDateTime),
    doc.estAnnualValue ?? '',
    doc.daysStale ?? '',
    doc.lostReason,
  ];
}

export function marketingActivityToExportRow(doc) {
  return [
    doc.activityId,
    fmtDate(doc.date),
    doc.activityType,
    doc.relatedScOrLeadId,
    doc.organisationName,
    doc.channel,
    doc.objective,
    doc.outcome,
    doc.followUpRequired ? 'Y' : 'N',
    doc.followUpOwner,
    fmtDate(doc.nextActionDate),
    doc.notes,
  ];
}

export function staffingRequirementToExportRow(doc) {
  return [
    doc.participant,
    doc.staffRequired ?? '',
    doc.supportWorkerAge,
    doc.sex,
    doc.drivingLicenseRequired,
    doc.vehicleRequired,
    doc.location,
    fmtDate(doc.dueDate),
    doc.notes,
    doc.completed ? 'Yes' : 'No',
  ];
}
