import { parseTabularBuffer } from '../../utils/tabularFile.js';
import { parseAusDayMonthDatetime } from '../shifts/shiftCsvParser.js';

const DEFAULT_OFFSET = process.env.SHIFT_CSV_DEFAULT_OFFSET || '+10:00';

const COLUMN_ALIASES = {
  shiftId: ['shift id', 'shiftid', 'id'],
  startAt: ['start at', 'start time', 'start datetime', 'start'],
  endAt: ['end at', 'end time', 'end datetime', 'end'],
  client: ['client', 'client name', 'participant', 'participant name'],
  priceBook: ['price book', 'pricebook'],
  shiftType: ['shift type', 'type'],
  team: ['team'],
  facility: ['facility'],
  address: ['address'],
  durationHrs: ['duration (hrs)', 'duration hrs', 'duration', 'hours'],
  createdAt: ['created at', 'created'],
};

function normalizeColumnName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildNormalizedColumns(row) {
  const map = new Map();
  for (const key of Object.keys(row || {})) {
    const norm = normalizeColumnName(key);
    if (norm && !map.has(norm)) map.set(norm, key);
  }
  return map;
}

function getRowValue(row, colMap, aliases) {
  for (const alias of aliases) {
    const orig = colMap.get(alias);
    if (orig != null && row[orig] != null && String(row[orig]).trim() !== '') {
      return String(row[orig]).trim();
    }
  }
  return '';
}

export function normalizeClientName(raw) {
  const first = String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  return first ?? '';
}

export function isSleepoverShiftType(shiftType) {
  return String(shiftType ?? '').trim().toLowerCase() === 'sleepover';
}

function buildImportNotes({ address, team, priceBook, durationHrs, facility }) {
  const parts = [];
  if (address) parts.push(`Address: ${address}`);
  if (team) parts.push(`Team: ${team}`);
  if (priceBook) parts.push(`Price book: ${priceBook}`);
  if (facility) parts.push(`Facility: ${facility}`);
  if (durationHrs) parts.push(`Duration: ${durationHrs} hrs`);
  return parts.join('\n');
}

function parseDatetime(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const parsed = parseAusDayMonthDatetime(s, DEFAULT_OFFSET);
  return parsed?.date ?? null;
}

export function parseVacantShiftRow(row, colMap, rowIndex) {
  const shiftcareShiftId = getRowValue(row, colMap, COLUMN_ALIASES.shiftId);
  const startRaw = getRowValue(row, colMap, COLUMN_ALIASES.startAt);
  const endRaw = getRowValue(row, colMap, COLUMN_ALIASES.endAt);
  const clientRaw = getRowValue(row, colMap, COLUMN_ALIASES.client);

  if (!shiftcareShiftId) {
    return { error: `Row ${rowIndex}: missing Shift ID` };
  }
  if (!startRaw || !endRaw) {
    return { error: `Row ${rowIndex}: missing Start At or End At (shift ${shiftcareShiftId})` };
  }
  if (!clientRaw) {
    return { error: `Row ${rowIndex}: missing Client (shift ${shiftcareShiftId})` };
  }

  const startDatetime = parseDatetime(startRaw);
  const endDatetime = parseDatetime(endRaw);
  if (!startDatetime) {
    return { error: `Row ${rowIndex}: invalid Start At "${startRaw}" (shift ${shiftcareShiftId})` };
  }
  if (!endDatetime) {
    return { error: `Row ${rowIndex}: invalid End At "${endRaw}" (shift ${shiftcareShiftId})` };
  }

  const shiftType = getRowValue(row, colMap, COLUMN_ALIASES.shiftType);
  const clientName = normalizeClientName(clientRaw);
  const notes = buildImportNotes({
    address: getRowValue(row, colMap, COLUMN_ALIASES.address),
    team: getRowValue(row, colMap, COLUMN_ALIASES.team),
    priceBook: getRowValue(row, colMap, COLUMN_ALIASES.priceBook),
    facility: getRowValue(row, colMap, COLUMN_ALIASES.facility),
    durationHrs: getRowValue(row, colMap, COLUMN_ALIASES.durationHrs),
  });

  return {
    row: {
      shiftcareShiftId,
      clientName,
      startDatetime,
      endDatetime,
      sleepover: isSleepoverShiftType(shiftType),
      notes,
      reason: 'vacancy',
      priority: 'medium',
      status: 'open',
    },
  };
}

export function validateVacantShiftHeaders(colMap) {
  const required = [
    ['Shift ID', COLUMN_ALIASES.shiftId],
    ['Start At', COLUMN_ALIASES.startAt],
    ['End At', COLUMN_ALIASES.endAt],
    ['Client', COLUMN_ALIASES.client],
  ];
  const missing = [];
  for (const [label, aliases] of required) {
    if (!aliases.some((a) => colMap.has(a))) missing.push(label);
  }
  return missing;
}

export function parseVacantShiftBuffer(buffer, filename = '') {
  const rawRows = parseTabularBuffer(buffer, filename);
  if (!rawRows.length) {
    return { rows: [], errors: ['File is empty or has no data rows'], rowsProcessed: 0 };
  }

  const colMap = buildNormalizedColumns(rawRows[0]);
  const headerErrors = validateVacantShiftHeaders(colMap);
  if (headerErrors.length) {
    return {
      rows: [],
      errors: [`Missing required columns: ${headerErrors.join(', ')}`],
      rowsProcessed: 0,
    };
  }

  const rows = [];
  const errors = [];
  let rowIndex = 2;

  for (const raw of rawRows) {
    const result = parseVacantShiftRow(raw, colMap, rowIndex);
    if (result.error) errors.push(result.error);
    else rows.push(result.row);
    rowIndex += 1;
  }

  return { rows, errors, rowsProcessed: rawRows.length };
}
