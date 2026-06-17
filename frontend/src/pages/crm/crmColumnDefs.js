import {
  toDateInput,
  toDateTimeInput,
  parseDateInput,
  formatBooleanDisplay,
  parseBooleanInput,
  parseLinkedIds,
  formatLinkedIds,
} from './crmFormUtils.jsx';
import { SPREADSHEET_ROOMS } from '../../lib/spreadsheetCollaboration';

const RELATIONSHIP_STATUSES = ['Cold', 'Warm', 'Active', 'Strategic'];
const PARTICIPANT_TYPES = ['SIL Only', 'In Home Care', 'MTA', 'ILO'];
const LEAD_STAGES = ['Active', 'Discharge Pending', 'Inquiry', 'Lost/Deferred'];
const LEAD_STATUSES = ['New', 'Active', 'Converted', 'Hold', 'Lost'];

function trimStr(v) {
  return String(v ?? '').trim();
}

function parseNumberInput(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDateDisplay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function formatDateTimeDisplay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function cellValue(row, key, type) {
  const raw = row[key];
  if (raw == null || raw === '') return '';
  switch (type) {
    case 'date':
      return toDateInput(raw);
    case 'datetime':
      return toDateTimeInput(raw);
    case 'boolean':
      return raw;
    case 'number':
      return raw;
    case 'linkedIds':
      return formatLinkedIds(raw);
    default:
      return raw;
  }
}

function formatDisplay(row, col) {
  const raw = row[col.key];
  if (raw == null || raw === '') return '';
  switch (col.type) {
    case 'date':
      return formatDateDisplay(raw);
    case 'datetime':
      return formatDateTimeDisplay(raw);
    case 'boolean':
      return formatBooleanDisplay(raw, col.booleanStyle);
    case 'linkedIds':
      return formatLinkedIds(raw);
  }
  return String(raw);
}

export function parseFieldValue(value, col) {
  switch (col.type) {
    case 'date':
    case 'datetime':
      return parseDateInput(value);
    case 'boolean':
      return typeof value === 'boolean' ? value : parseBooleanInput(value);
    case 'number':
      return parseNumberInput(value);
    case 'linkedIds':
      return parseLinkedIds(value);
    case 'select':
    case 'text':
    default:
      return trimStr(value);
  }
}

export const SUPPORT_COORDINATOR_COLUMNS = [
  { key: 'scId', label: 'SC_ID (Unique)', type: 'text', minWidth: 120, isId: true },
  { key: 'coordinatorName', label: 'Coordinator Name', type: 'text', minWidth: 140 },
  { key: 'organisation', label: 'Organisation', type: 'text', minWidth: 120 },
  { key: 'phone', label: 'Phone', type: 'text', minWidth: 100 },
  { key: 'email', label: 'Email', type: 'text', minWidth: 140 },
  { key: 'relationshipStatus', label: 'Relationship Status', type: 'select', options: RELATIONSHIP_STATUSES, minWidth: 120 },
  { key: 'currentParticipants', label: 'Current Participants', type: 'text', minWidth: 120 },
  { key: 'location', label: 'Location', type: 'text', minWidth: 100 },
  { key: 'lastContactDate', label: 'Last Contact Date', type: 'date', minWidth: 120 },
  { key: 'nextFollowUpDate', label: 'Next Follow-up Date', type: 'date', minWidth: 120 },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: 160 },
  { key: 'specialty', label: 'Specialty (Complex/HI/etc)', type: 'text', minWidth: 140 },
  { key: 'source', label: 'Source', type: 'text', minWidth: 100 },
  { key: 'linkedLeadIds', label: 'Linked Lead ID(s)', type: 'linkedIds', minWidth: 140 },
];

export const LEAD_COLUMNS = [
  { key: 'leadId', label: 'Lead ID (Unique)', type: 'text', minWidth: 120, isId: true },
  { key: 'dateReceived', label: 'Date Received', type: 'date', minWidth: 110 },
  { key: 'name', label: 'Name', type: 'text', minWidth: 120 },
  { key: 'referralSource', label: 'Referral Source (Name/Org)', type: 'text', minWidth: 140 },
  { key: 'referralPhone', label: 'Referral Phone', type: 'text', minWidth: 110 },
  { key: 'referralEmail', label: 'Referral Email', type: 'text', minWidth: 140 },
  { key: 'requirementSummary', label: 'Requirement Summary', type: 'text', minWidth: 160 },
  { key: 'participantType', label: 'Participant Type', type: 'select', options: PARTICIPANT_TYPES, minWidth: 120 },
  { key: 'currentStage', label: 'Current Stage', type: 'select', options: LEAD_STAGES, minWidth: 120 },
  { key: 'status', label: 'Status', type: 'select', options: LEAD_STATUSES, minWidth: 100 },
  { key: 'lastContactDate', label: 'Last Contact Date', type: 'date', minWidth: 120 },
  { key: 'followUpNotes', label: 'Follow up Notes', type: 'text', minWidth: 140 },
  { key: 'meetAndGreetPlanned', label: 'Meet & Greet Planned', type: 'boolean', booleanStyle: 'yes', minWidth: 120 },
  { key: 'meetAndGreetDateTime', label: 'Meet and Greet Date & Time', type: 'datetime', minWidth: 160 },
  { key: 'estAnnualValue', label: 'Est. Annual Value ($)', type: 'number', minWidth: 120 },
  { key: 'daysStale', label: 'Days Stale', type: 'number', minWidth: 90 },
  { key: 'lostReason', label: 'Reason (Lost/Deferred)', type: 'text', minWidth: 140 },
];

export const MARKETING_ACTIVITY_COLUMNS = [
  { key: 'activityId', label: 'Activity_ID (Unique)', type: 'text', minWidth: 120, isId: true },
  { key: 'date', label: 'Date', type: 'date', minWidth: 110 },
  { key: 'activityType', label: 'Activity Type', type: 'text', minWidth: 120 },
  { key: 'relatedScOrLeadId', label: 'Related SC_ID / Lead_ID', type: 'text', minWidth: 140 },
  { key: 'organisationName', label: 'Organisation/Name', type: 'text', minWidth: 140 },
  { key: 'channel', label: 'Channel (Email/Visit/Event/etc)', type: 'text', minWidth: 140 },
  { key: 'objective', label: 'Objective', type: 'text', minWidth: 140 },
  { key: 'outcome', label: 'Outcome', type: 'text', minWidth: 140 },
  { key: 'followUpRequired', label: 'Follow-up Required (Y/N)', type: 'boolean', booleanStyle: 'yn', minWidth: 120 },
  { key: 'followUpOwner', label: 'Follow-up Owner', type: 'text', minWidth: 120 },
  { key: 'nextActionDate', label: 'Next Action Date', type: 'date', minWidth: 120 },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: 160 },
];

export function buildEmptyDraft(columns) {
  const draft = {};
  for (const col of columns) {
    if (col.type === 'boolean') draft[col.key] = false;
    else if (col.type === 'number') draft[col.key] = '';
    else if (col.type === 'linkedIds') draft[col.key] = '';
    else draft[col.key] = '';
  }
  return draft;
}

export function rowToDraft(row, columns) {
  const draft = {};
  for (const col of columns) {
    draft[col.key] = cellValue(row, col.key, col.type);
  }
  return draft;
}

export function formatCellDisplay(row, col) {
  return formatDisplay(row, col);
}

export function draftToBody(draft, columns) {
  const body = {};
  for (const col of columns) {
    body[col.key] = parseFieldValue(draft[col.key], col);
  }
  return body;
}

export function validateDraft(draft, idField, idLabel) {
  const id = trimStr(draft[idField]);
  if (!id) return `${idLabel} required`;
  return null;
}

function sortableValue(row, col) {
  const raw = row[col.key];
  switch (col.type) {
    case 'number': {
      const n = parseNumberInput(raw);
      return n == null ? null : n;
    }
    case 'date':
    case 'datetime': {
      if (!raw) return null;
      const t = new Date(raw).getTime();
      return Number.isNaN(t) ? null : t;
    }
    case 'boolean':
      return raw ? 1 : 0;
    default:
      return formatDisplay(row, col).toLowerCase();
  }
}

/** Comparator for client-side column sort (asc). Multiply by -1 for desc. */
export function compareCellValues(a, b, col) {
  const av = sortableValue(a, col);
  const bv = sortableValue(b, col);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
}

export const CRM_ENTITY_CONFIG = {
  supportCoordinators: {
    columns: SUPPORT_COORDINATOR_COLUMNS,
    idField: 'scId',
    idLabel: 'SC ID',
    rowsKey: 'supportCoordinators',
    deleteConfirm: 'Delete this support coordinator?',
    autoIdEntity: 'support-coordinators',
    collaborationRoom: SPREADSHEET_ROOMS.supportCoordinators,
    queryKeyPrefix: ['crm', 'support-coordinators'],
  },
  leads: {
    columns: LEAD_COLUMNS,
    idField: 'leadId',
    idLabel: 'Lead ID',
    rowsKey: 'leads',
    deleteConfirm: 'Delete this lead?',
    autoIdEntity: 'leads',
    collaborationRoom: SPREADSHEET_ROOMS.leads,
    queryKeyPrefix: ['crm', 'leads'],
  },
  marketingActivities: {
    columns: MARKETING_ACTIVITY_COLUMNS,
    idField: 'activityId',
    idLabel: 'Activity ID',
    rowsKey: 'marketingActivities',
    deleteConfirm: 'Delete this marketing activity?',
    autoIdEntity: 'marketing-activities',
    collaborationRoom: SPREADSHEET_ROOMS.marketing,
    queryKeyPrefix: ['crm', 'marketing-activities'],
  },
};
