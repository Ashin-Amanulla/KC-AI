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
};

// Shift type mapping (case-insensitive)
const SHIFT_TYPE_MAP = {
  'personal_care': 'personal_care',
  'personal care': 'personal_care',
  'personalcare': 'personal_care',
  'pc': 'personal_care',
  'sleepover': 'sleepover',
  'sleep_over': 'sleepover',
  'sleep over': 'sleepover',
  'sleep-over': 'sleepover',
  'so': 'sleepover',
  'nursing_support': 'nursing_support',
  'nursing support': 'nursing_support',
  'nursingsupport': 'nursing_support',
  'nursing': 'nursing_support',
  'ns': 'nursing_support',
};

// Broken shift gap thresholds in milliseconds
const BROKEN_SHIFT_GAP_PERSONAL_CARE_MS = 10 * 60 * 60 * 1000; // 10 hours
const BROKEN_SHIFT_GAP_SLEEPOVER_MS = 8 * 60 * 60 * 1000;      // 8 hours
const BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS = 10 * 60 * 60 * 1000; // 10 hours

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

  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;

    // Extract the offset string for storage
    const offsetMatch = s.match(/([+-]\d{2}:\d{2})$/);
    const offsetStr = offsetMatch ? offsetMatch[1] : '+00:00';

    return { date: d, offsetStr };
  } catch {
    return null;
  }
}

/**
 * Parse a decimal value from a string; returns null for empty/invalid.
 */
function parseDecimal(value) {
  if (!value || !value.trim()) return null;
  const n = parseFloat(value.trim());
  return isNaN(n) ? null : Math.round(n * 100) / 100;
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
    result.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
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

  return result;
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
  const shiftStatus = get('shift status') || null;
  const absentStr = get('absent');

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

  // Compute hours
  let hours;
  if (hoursStr) {
    hours = parseDecimal(hoursStr);
    if (hours === null) {
      hours = Math.round(((endParsed.date - startParsed.date) / 3600000) * 100) / 100;
    }
  } else {
    hours = Math.round(((endParsed.date - startParsed.date) / 3600000) * 100) / 100;
  }

  // Parse shift type
  const shiftType = SHIFT_TYPE_MAP[shiftTypeStr.toLowerCase()];
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
function calculateIsBrokenShift(currentShift, previousShift) {
  if (!previousShift) return false;

  const gap = currentShift.startDatetime - previousShift.endDatetime;
  if (gap <= 0) return false;

  switch (previousShift.shiftType) {
    case 'personal_care':
      return gap < BROKEN_SHIFT_GAP_PERSONAL_CARE_MS;
    case 'sleepover':
      return gap < BROKEN_SHIFT_GAP_SLEEPOVER_MS;
    case 'nursing_support':
      return gap < BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS;
    default:
      return false;
  }
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
