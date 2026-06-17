import { SPREADSHEET_ROOMS } from '../../lib/spreadsheetCollaboration';

export const HR_REQUIREMENTS_COLUMNS = [
  { key: 'participant', label: 'Participant', type: 'text', minWidth: 120, isId: true },
  { key: 'staffRequired', label: 'Staff Required', type: 'number', minWidth: 100 },
  { key: 'supportWorkerAge', label: 'Support Worker Age', type: 'text', minWidth: 120 },
  { key: 'sex', label: 'Sex', type: 'text', minWidth: 80 },
  { key: 'drivingLicenseRequired', label: 'Driving License Required', type: 'text', minWidth: 140 },
  { key: 'vehicleRequired', label: 'Vehicle Required', type: 'text', minWidth: 120 },
  { key: 'location', label: 'Location', type: 'text', minWidth: 100 },
  { key: 'startDate', label: 'Start Date', type: 'date', minWidth: 110 },
  { key: 'endDate', label: 'End Date', type: 'date', minWidth: 110 },
  { key: 'dueDate', label: 'Due Date', type: 'date', minWidth: 110 },
  { key: 'notes', label: 'Notes', type: 'text', minWidth: 160 },
  { key: 'completed', label: 'Completed', type: 'boolean', booleanStyle: 'yes', minWidth: 90 },
];

export const HR_REQUIREMENTS_CONFIG = {
  columns: HR_REQUIREMENTS_COLUMNS,
  idField: 'participant',
  idLabel: 'Participant',
  rowsKey: 'staffingRequirements',
  deleteConfirm: 'Delete this HR requirement?',
  collaborationRoom: SPREADSHEET_ROOMS.hrRequirements,
  queryKeyPrefix: ['hr-requirements'],
};
