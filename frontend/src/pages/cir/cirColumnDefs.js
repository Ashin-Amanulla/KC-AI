import {
  buildEmptyDraft,
  compareCellValues,
  draftToBody,
  formatCellDisplay,
  parseFieldValue,
  rowToDraft,
  validateDraft,
} from '../crm/crmColumnDefs';
import { SPREADSHEET_ROOMS } from '../../lib/spreadsheetCollaboration';

export {
  buildEmptyDraft,
  compareCellValues,
  draftToBody,
  formatCellDisplay,
  parseFieldValue,
  rowToDraft,
  validateDraft,
};

const ISSUE_SOURCES = [
  'Staff Feedback',
  'Internal Review',
  'Audit',
  'Incident',
  'Complaint',
  'Client Feedback',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical', 'Other'];

const DEPARTMENTS = [
  'HR',
  'Clinical',
  'Service Delivery',
  'Management',
  'Finance',
  'Quality / WHS',
  'Other',
];

const ROOT_CAUSES = [
  'Process improvement',
  'Systems improvement',
  'Training',
  'Communication',
  'Policy gap',
  'Resource constraint',
  'Other',
];

const STATUSES = ['Open', 'In Progress', 'On Hold', 'Closed', 'Deferred', 'Other'];

export const CIR_COLUMNS = [
  { key: 'cirId', label: 'CIR ID', type: 'text', minWidth: 110, isId: true },
  { key: 'dateRaised', label: 'Date Raised', type: 'date', minWidth: 110 },
  { key: 'clientArea', label: 'Client / Area', type: 'text', minWidth: 130 },
  { key: 'issueDescription', label: 'Issue / Task Description', type: 'text', minWidth: 180, multiline: true },
  {
    key: 'issueSource',
    label: 'Issue Source',
    type: 'select',
    options: ISSUE_SOURCES,
    allowOther: true,
    minWidth: 120,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: PRIORITIES,
    allowOther: true,
    minWidth: 100,
  },
  { key: 'enteredByName', label: 'Entered By (Name)', type: 'text', minWidth: 120 },
  { key: 'dateEntered', label: 'Date Entered', type: 'date', minWidth: 110 },
  { key: 'responsibleOfficer', label: 'Responsible Officer', type: 'text', minWidth: 130 },
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: DEPARTMENTS,
    allowOther: true,
    minWidth: 120,
  },
  { key: 'actions', label: 'Actions', type: 'text', minWidth: 160, actionsPanel: true },
  {
    key: 'rootCause',
    label: 'Root Cause',
    type: 'select',
    options: ROOT_CAUSES,
    allowOther: true,
    minWidth: 140,
  },
  { key: 'dueDate', label: 'Due Date', type: 'date', minWidth: 110 },
  { key: 'reviewDate', label: 'Review Date', type: 'date', minWidth: 110 },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: STATUSES,
    allowOther: true,
    minWidth: 110,
  },
  { key: 'outcomeEvidence', label: 'Outcome / Evidence', type: 'text', minWidth: 160, multiline: true },
  { key: 'dateClosed', label: 'Date Closed', type: 'date', minWidth: 110 },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: 140, multiline: true },
];

export const CIR_ENTITY_CONFIG = {
  columns: CIR_COLUMNS,
  idField: 'cirId',
  idLabel: 'CIR ID',
  rowsKey: 'records',
  deleteConfirm: 'Delete this CIR record?',
  autoIdEntity: 'cir',
  collaborationRoom: SPREADSHEET_ROOMS.cirRegister,
  queryKeyPrefix: ['cir'],
};
