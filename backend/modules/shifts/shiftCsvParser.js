/**
 * Shift CSV Parser
 *
 * Parses ShiftCare export CSV files and detects broken shifts.
 * Faithfully ports the Python logic from:
 *   kc_studio/app/shifts/services/shift_service.py
 *   kc_studio/app/shifts/domain/operations.py
 */

// Required CSV columns (case-insensitive, after alias normalisation)
const REQUIRED_CSV_COLUMNS = new Set(['staff name', 'start time', 'end time', 'shift type']);

// Column aliases — maps ShiftCare export column names → our internal names
const COLUMN_ALIASES = {
  'staff': 'staff name',
  'staff id': 'staff id',
  'name': 'client name',       // ShiftCare uses "Name" for client
  'start date time': 'start time',
  'end date time': 'end time',
  'shift type': 'shift type',
  'shift status': 'shift status',
  'cancelled reason': 'cancelled reason',
  'clockin date time': 'clockin datetime',
  'clockout date time': 'clockout datetime',
  'url': 'shiftcare url',
  'note': 'notes',
  'mileage': 'mileage',
  'expense': 'expense',
  'hours': 'hours',
  'address': 'address',
  'absent': 'absent',
  'shift id': 'shiftcare id',
  'additional shift types': 'additional shift types',
  'client name': 'client name',
  'staff name': 'staff name',
  'start time': 'start time',
  'end time': 'end time',
  'notes': 'notes',
  'shiftcare url': 'shiftcare url',
  'clockin datetime': 'clockin datetime',
  'clockout datetime': 'clockout datetime',
  'shiftcare id': 'shiftcare id',
  'duration': 'hours',
  'rate groups': 'rate groups',
};

// Shift type mapping (case-insensitive)
const SHIFT_TYPE_MAP = {
  'personal care': 'personal_care',
  'sleepover': 'sleepover',
  'community participation': 'personal_care',
  'transport': 'personal_care',
  'travel': 'personal_care',
  'training': 'personal_care',
  'other': 'personal_care',
  'nursing support': 'nursing_support',
  'support coordination': 'personal_care',
  'personal_care': 'personal_care',
  'personalcare': 'personal_care',
  'pc': 'personal_care',
  'sleep_over': 'sleepover',
  'sleep over': 'sleepover',
  'sleep-over': 'sleepover',
  'so': 'sleepover',
  'nursing_support': 'nursing_support',
  'nursingsupport': 'nursing_support',
  'nursing': 'nursing_support',
  'ns': 'nursing_support',
};

// Broken shift gap thresholds in milliseconds
const BROKEN_SHIFT_GAP_PERSONAL_CARE_MS = 10 * 60 * 60 * 1000; // 10 hours
const BROKEN_SHIFT_GAP_SLEEPOVER_MS = 8 * 60 * 60 * 1000;      // 8 hours
const BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS = 10 * 60 * 60 * 1000; // 10 hours
const DEFAULT_SHIFT_OFFSET = process.env.SHIFT_CSV_DEFAULT_OFFSET || '+10:00';

/**
 * Normalize a CSV column name for case-insensitive matching with alias support.
 */
function normalizeColumnName(name) {
  const normalized = name.trim().toLowerCase();
  return COLUMN_ALIASES[normalized] ?? normalized;
}

/**
 * Parse a datetime string with timezone offset.
 * Supports: "YYYY-MM-DD HH:MM:SS +HHMM" and "YYYY-MM-DD HH:MM:SS +HH:MM"
 * When no offset is provided, interpret clock time as local wall time in DEFAULT_SHIFT_OFFSET
 * (so imported times remain exactly as in the source file).
 * Returns { date: Date (UTC), offsetStr: '+10:00' } or null on failure.
 */
function parseDatetimeWithOffset(dtStr) {
  if (!dtStr || !dtStr.trim()) return null;
  let s = dtStr.trim();

  // Convert +1000 format (no colon) to +10:00
  const offsetNoColon = s.match(/([+-]\d{4})$/);
  if (offsetNoColon) {
    const raw = offsetNoColon[1];
    s = s.slice(0, -5) + raw.slice(0, 3) + ':' + raw.slice(3);
  }

  const offsetMatch = s.match(/([+-]\d{2}:\d{2}|Z)$/i);
  if (!offsetMatch) {
    const naive = parseNaiveLocalDatetime(s, DEFAULT_SHIFT_OFFSET);
    if (naive) return naive;
    const aus = parseAusDayMonthDatetime(s, DEFAULT_SHIFT_OFFSET);
    if (aus) return aus;
  }

  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;

    // Extract the offset string for storage
    const explicitOffsetMatch = s.match(/([+-]\d{2}:\d{2}|Z)$/i);
    const offsetStr = explicitOffsetMatch
      ? (explicitOffsetMatch[1].toUpperCase() === 'Z' ? '+00:00' : explicitOffsetMatch[1])
      : DEFAULT_SHIFT_OFFSET;

    return { date: d, offsetStr };
  } catch {
    return null;
  }
}

function parseNaiveLocalDatetime(raw, offsetStr) {
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = parseInt(m[6] || '0', 10);
  if (
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
  ) {
    return null;
  }
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const oh = parseInt(clean.slice(0, 2), 10);
  const om = parseInt(clean.slice(2, 4), 10);
  const offsetMinutes = sign * (oh * 60 + om);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60000;
  return { date: new Date(utcMs), offsetStr };
}

/** DD/MM/YYYY HH:MM am/pm — Cost Breakdown Raw and some ShiftCare billing exports. */
function parseAusDayMonthDatetime(raw, offsetStr) {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const pm = m[6].toLowerCase() === 'pm';
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const oh = parseInt(clean.slice(0, 2), 10);
  const om = parseInt(clean.slice(2, 4), 10);
  const offsetMinutes = sign * (oh * 60 + om);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60000;
  return { date: new Date(utcMs), offsetStr };
}

/**
 * Parse a decimal value from a string; returns null for empty/invalid.
 */
function parseDecimal(value) {
  if (!value || !value.trim()) return null;
  const n = parseFloat(value.trim());
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** Parse hour fields like "8.0", "8.0 hrs", "8h". */
function parseHoursField(value) {
  if (!value || !String(value).trim()) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/**
 * Detect common ShiftCare exports that are not per-shift roster CSVs.
 * Returns a user-facing error string or null if format looks OK to try.
 */
function detectUnsupportedCsvFormat(headers) {
  const normalized = new Set(headers.map((h) => normalizeColumnName(h)));
  const rawLower = new Set(headers.map((h) => h.trim().toLowerCase()));

  const isAllHoursSummary =
    rawLower.has('total') &&
    rawLower.has('name') &&
    rawLower.has('id') &&
    [...rawLower].some((h) => h.startsWith('weekday')) &&
    !normalized.has('start time') &&
    !normalized.has('end time');

  if (isAllHoursSummary) {
    return (
      'This file is a Timesheet "all hours" summary (Name, Total, WeekDay columns), not a shift roster. ' +
      'In ShiftCare, export the Scheduler timesheet CSV with Staff, Start Date Time, End Date Time, and Shift Type ' +
      '(filename like Scheduler_Timesheet_Export_*.csv).'
    );
  }

  const isCostSummary =
    rawLower.has('booked') && rawLower.has('pending') && rawLower.has('cancelled');
  if (isCostSummary) {
    return (
      'This file is a Cost Breakdown summary (client totals), not a shift roster. ' +
      'Use Scheduler_Timesheet_Export_*.csv for pay hours, or Cost_Breakdown_Raw_Export_*.csv for billing analysis.'
    );
  }

  return null;
}

/**
 * Get a value from a row using the normalized column name map.
 * normalizedColumns: Map<normalizedName, originalHeader>
 */
function getRowValue(row, normalizedColumns, colName) {
  const originalCol = normalizedColumns.get(colName);
  if (!originalCol) return '';
  return (row[originalCol] ?? '').trim();
}

/**
 * Parse a CSV buffer (Buffer or string) into raw shift objects.
 * Returns { shifts, errors, rowsProcessed, rowsSkipped }
 *
 * Shifts are plain objects (not yet Mongoose documents).
 * Broken shift detection is done separately via detectBrokenShifts().
 */
export function parseShiftCsvBuffer(buffer, uploadedBy = null) {
  const content = Buffer.isBuffer(buffer) ? buffer.toString('utf-8').replace(/^\uFEFF/, '') : buffer;
  const lines = content.split(/\r?\n/);

  const result = {
    shifts: [],
    errors: [],
    rowsProcessed: 0,
    rowsSkipped: 0,
  };

  if (lines.length === 0) {
    result.errors.push('CSV file is empty');
    return result;
  }

  // Parse header row
  const headerLine = lines[0];
  if (!headerLine.trim()) {
    result.errors.push('CSV file is empty or has no header row');
    return result;
  }

  const headers = parseCsvLine(headerLine);

  const unsupported = detectUnsupportedCsvFormat(headers);
  if (unsupported) {
    result.errors.push(unsupported);
    return result;
  }

  // Build normalised column map: normalizedName → originalHeader
  const normalizedColumns = new Map();
  for (const h of headers) {
    const normalized = normalizeColumnName(h);
    normalizedColumns.set(normalized, h);
  }

  // Check required columns
  const missingColumns = [];
  for (const required of REQUIRED_CSV_COLUMNS) {
    if (!normalizedColumns.has(required)) {
      missingColumns.push(required);
    }
  }
  if (missingColumns.length > 0) {
    result.errors.push(
      `Missing required columns: ${missingColumns.join(', ')}. ` +
        'Expected a ShiftCare Scheduler export with Staff (or Staff Name), Start Date Time, End Date Time, and Shift Type.'
    );
    return result;
  }

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // skip blank lines

    result.rowsProcessed++;
    const rowNum = i + 1;

    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });

    const { shift, error } = processCsvRow(row, rowNum, normalizedColumns, uploadedBy);
    if (error) {
      result.errors.push(error);
      result.rowsSkipped++;
    } else if (shift) {
      result.shifts.push(shift);
    }
  }

  result.shifts = collapseDuplicateShifts(result.shifts);
  return result;
}

/**
 * ShiftCare cost/billing exports often emit one row per ratio slice for the same shift.
 * Payroll and broken-shift logic need one record per (staff, shift id, start, end).
 */
export function collapseDuplicateShifts(shifts) {
  const byKey = new Map();
  for (const shift of shifts) {
    const startMs = shift.startDatetime?.getTime?.() ?? shift.startDatetime;
    const endMs = shift.endDatetime?.getTime?.() ?? shift.endDatetime;
    const key = [
      String(shift.staffName || '').trim().toLowerCase(),
      String(shift.shiftcareId || ''),
      startMs,
      endMs,
    ].join('|');
    if (!byKey.has(key)) {
      byKey.set(key, shift);
      continue;
    }
    const existing = byKey.get(key);
    if ((shift.mileage || 0) > (existing.mileage || 0)) existing.mileage = shift.mileage;
    if ((shift.expense || 0) > (existing.expense || 0)) existing.expense = shift.expense;
    if (!existing.clientName && shift.clientName) existing.clientName = shift.clientName;
  }
  return [...byKey.values()];
}

/**
 * Process a single CSV row into a shift object.
 * Returns { shift, error }.
 */
function processCsvRow(row, rowNum, normalizedColumns, uploadedBy) {
  const get = (col) => getRowValue(row, normalizedColumns, col);

  const staffName = get('staff name');
  const clientName = get('client name');
  const startTimeStr = get('start time');
  const endTimeStr = get('end time');
  const shiftTypeStr = get('shift type');

  const hoursStr = get('hours');
  const mileageStr = get('mileage');
  const expenseStr = get('expense');
  const notes = get('notes');
  const address = get('address');
  const shiftcareUrl = get('shiftcare url');
  const clockinStr = get('clockin datetime');
  const clockoutStr = get('clockout datetime');
  const shiftcareId = get('shiftcare id') || null;
  const shiftcareStaffIdRaw = get('staff id');
  const shiftStatus = get('shift status') || null;
  const absentStr = get('absent');
  const rateGroupRaw = get('rate groups');

  // Staff name is required
  if (!staffName) {
    return { shift: null, error: `Row ${rowNum}: Staff name is required` };
  }

  // Parse start datetime
  const startParsed = parseDatetimeWithOffset(startTimeStr);
  if (!startParsed) {
    return { shift: null, error: `Row ${rowNum}: Invalid start time format '${startTimeStr}'` };
  }

  // Parse end datetime
  const endParsed = parseDatetimeWithOffset(endTimeStr);
  if (!endParsed) {
    return { shift: null, error: `Row ${rowNum}: Invalid end time format '${endTimeStr}'` };
  }

  if (endParsed.date <= startParsed.date) {
    return { shift: null, error: `Row ${rowNum}: End time must be after start time` };
  }

  // Compute hours from timestamps; only trust CSV hours when it closely matches.
  // This avoids phantom-hour inflation from malformed/mis-mapped Hours columns.
  const derivedHours = Math.round(((endParsed.date - startParsed.date) / 3600000) * 100) / 100;
  const parsedHours = hoursStr ? parseHoursField(hoursStr) : null;
  let hours = derivedHours;
  if (parsedHours != null && parsedHours > 0) {
    if (Math.abs(parsedHours - derivedHours) <= 0.05 || derivedHours <= 0) {
      hours = parsedHours;
    }
  }

  // Parse shift type (billing raw often marks sleepovers via rate group)
  const rateGroupLower = (rateGroupRaw || '').toLowerCase();
  let shiftType = SHIFT_TYPE_MAP[shiftTypeStr.toLowerCase()];
  if (rateGroupLower.includes('sleepover')) {
    shiftType = 'sleepover';
  }
  if (!shiftType) {
    return { shift: null, error: `Row ${rowNum}: Invalid shift type '${shiftTypeStr}'` };
  }

  // Compute day of week (0=Mon…6=Sun) in local time
  // Use UTC weekday adjusted by offset
  const localStart = applyOffset(startParsed.date, startParsed.offsetStr);
  const dayOfWeek = (localStart.getUTCDay() + 6) % 7; // JS: 0=Sun → Monday=0

  const clockin = clockinStr ? (parseDatetimeWithOffset(clockinStr)?.date ?? null) : null;
  const clockout = clockoutStr ? (parseDatetimeWithOffset(clockoutStr)?.date ?? null) : null;

  const shift = {
    staffName: staffName.trim(),
    clientName: clientName ? clientName.trim() : null,
    startDatetime: startParsed.date,
    endDatetime: endParsed.date,
    hours,
    shiftType,
    isBrokenShift: false, // set by detectBrokenShifts()
    dayOfWeek,
    timezoneOffset: startParsed.offsetStr,
    shiftStatus,
    absent: absentStr?.toLowerCase() === 'yes' || absentStr === '1' || absentStr?.toLowerCase() === 'true',
    mileage: parseDecimal(mileageStr),
    expense: parseDecimal(expenseStr),
    notes: notes || '',
    address: address || '',
    shiftcareUrl: shiftcareUrl || '',
    shiftcareId,
    shiftcareStaffId:
      shiftcareStaffIdRaw != null && String(shiftcareStaffIdRaw).trim() !== ''
        ? String(shiftcareStaffIdRaw).trim()
        : null,
    clockinDatetime: clockin,
    clockoutDatetime: clockout,
    uploadedBy,
  };

  return { shift, error: null };
}

/**
 * Detect broken shifts by mutating the isBrokenShift field on shift objects.
 * Business rules (BR-BS-001/002/003):
 *   - Broken if previous shift is Personal Care AND 0 < gap < 10 hours
 *   - Broken if previous shift is Sleepover AND 0 < gap < 8 hours
 *   - Broken if previous shift is Nursing Support AND 0 < gap < 10 hours
 *
 * Processes each staff member's shifts in chronological order.
 */
export function detectBrokenShifts(shifts) {
  // Group by staffName
  const byStaff = new Map();
  for (const shift of shifts) {
    const key = shift.staffName.toLowerCase();
    if (!byStaff.has(key)) byStaff.set(key, []);
    byStaff.get(key).push(shift);
  }

  for (const staffShifts of byStaff.values()) {
    // Sort chronologically
    staffShifts.sort((a, b) => a.startDatetime - b.startDatetime);

    let previousShift = null;
    for (const shift of staffShifts) {
      shift.isBrokenShift = calculateIsBrokenShift(shift, previousShift);
      previousShift = shift;
    }
  }

  return shifts;
}

/**
 * Determine if a shift is broken based on gap from previous shift.
 */
function brokenShiftGapThresholdMs(previousShiftType) {
  switch (previousShiftType) {
    case 'personal_care':
      return BROKEN_SHIFT_GAP_PERSONAL_CARE_MS;
    case 'sleepover':
      return BROKEN_SHIFT_GAP_SLEEPOVER_MS;
    case 'nursing_support':
      return BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS;
    default:
      return null;
  }
}

function calculateIsBrokenShift(currentShift, previousShift) {
  if (!previousShift) return false;

  const offsetStr = currentShift.timezoneOffset || previousShift.timezoneOffset || '+10:00';
  const gap = currentShift.startDatetime - previousShift.endDatetime;
  if (gap <= 0) return false;

  const thresholdMs = brokenShiftGapThresholdMs(previousShift.shiftType);
  if (thresholdMs == null || gap > thresholdMs) return false;

  const sameStartDay = isSameLocalDate(
    currentShift.startDatetime,
    previousShift.startDatetime,
    offsetStr
  );
  const spansOntoCurrentDay = isSameLocalDate(
    previousShift.endDatetime,
    currentShift.startDatetime,
    offsetStr
  );

  return sameStartDay || spansOntoCurrentDay;
}

function isSameLocalDate(aUtc, bUtc, offsetStr) {
  const aLocal = applyOffset(aUtc, offsetStr);
  const bLocal = applyOffset(bUtc, offsetStr);
  return (
    aLocal.getUTCFullYear() === bLocal.getUTCFullYear() &&
    aLocal.getUTCMonth() === bLocal.getUTCMonth() &&
    aLocal.getUTCDate() === bLocal.getUTCDate()
  );
}

/**
 * Apply a timezone offset string to a UTC date to get the "local" time as a Date.
 * offsetStr: e.g. '+10:00' or '-05:00'
 * Returns a new Date whose UTC values represent the local time.
 */
function applyOffset(utcDate, offsetStr) {
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  const offsetMs = sign * (h * 60 + m) * 60000;
  return new Date(utcDate.getTime() + offsetMs);
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
