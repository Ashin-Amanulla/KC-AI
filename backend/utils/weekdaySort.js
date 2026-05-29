const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weekdayIndex(day) {
  const i = WEEKDAY_ORDER.findIndex((d) => d.toLowerCase() === String(day || '').trim().toLowerCase());
  return i >= 0 ? i : WEEKDAY_ORDER.length;
}

/** Parse template key: clientId|day|startTime */
export function parseTemplateKeyParts(key) {
  const [clientDirectoryId, day, startTime] = String(key || '').split('|');
  return { clientDirectoryId, day, startTime };
}

export function compareTemplateKeys(a, b) {
  const ka = parseTemplateKeyParts(a);
  const kb = parseTemplateKeyParts(b);
  const dayDiff = weekdayIndex(ka.day) - weekdayIndex(kb.day);
  if (dayDiff !== 0) return dayDiff;
  const timeDiff = String(ka.startTime || '').localeCompare(String(kb.startTime || ''));
  if (timeDiff !== 0) return timeDiff;
  return String(ka.clientDirectoryId || '').localeCompare(String(kb.clientDirectoryId || ''));
}

export function sortTemplateKeys(keys) {
  keys.sort(compareTemplateKeys);
  return keys;
}

/** Sort by calendar day (Mon→Sun), then start time ascending */
export function sortStandardRecords(records) {
  return [...records].sort((a, b) => {
    const dayDiff = weekdayIndex(a.day) - weekdayIndex(b.day);
    if (dayDiff !== 0) return dayDiff;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });
}

function rowStartTime(r) {
  if (r.startTime) return String(r.startTime);
  if (r.startDatetime) {
    const d = new Date(r.startDatetime);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(11, 16);
    }
  }
  return '';
}

/** Variance / template rows with a day label (Standard vs Forecast). */
export function compareWeekdayRows(a, b) {
  const dayDiff = weekdayIndex(a.day) - weekdayIndex(b.day);
  if (dayDiff !== 0) return dayDiff;
  const timeDiff = rowStartTime(a).localeCompare(rowStartTime(b));
  if (timeDiff !== 0) return timeDiff;
  const clientDiff = String(a.clientName || a.clientDirectoryId || '').localeCompare(
    String(b.clientName || b.clientDirectoryId || ''),
    undefined,
    { sensitivity: 'base' }
  );
  if (clientDiff !== 0) return clientDiff;
  const idA = a.templateKey || a.shiftcareId || '';
  const idB = b.templateKey || b.shiftcareId || '';
  if (idA === idB) {
    if (a.source === 'standard' && b.source === 'forecast') return -1;
    if (a.source === 'forecast' && b.source === 'standard') return 1;
    if (a.source === 'forecast' && b.source === 'actuals') return -1;
    if (a.source === 'actuals' && b.source === 'forecast') return 1;
  }
  return String(idA).localeCompare(String(idB));
}

/** Shift-level rows sorted by date then start time (chronological). */
export function compareShiftDateRows(a, b) {
  const da = a.shiftDate ? new Date(a.shiftDate).getTime() : 0;
  const db = b.shiftDate ? new Date(b.shiftDate).getTime() : 0;
  if (da !== db) return da - db;
  const sa = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
  const sb = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
  if (sa !== sb) return sa - sb;
  const pairA = a.variancePairKey || a.shiftcareId || '';
  const pairB = b.variancePairKey || b.shiftcareId || '';
  if (pairA === pairB) {
    if (a.source === 'forecast' && b.source === 'actuals') return -1;
    if (a.source === 'actuals' && b.source === 'forecast') return 1;
  }
  return String(pairA).localeCompare(String(pairB));
}
