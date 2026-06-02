import { staffTotalHours } from './schadsWageCalc';

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function n(v) {
  return v ?? 0;
}

/**
 * Download Staff Pay Summary table as CSV (matches award calculator columns + total hours & gross).
 */
export function downloadStaffPaySummaryCsv(rows, { getMergedRow, getGrossPay }) {
  const headers = [
    'Employee',
    'Total Hours',
    'Day',
    'Eve',
    'Night',
    'WD OT <=2h',
    'WD OT >2h',
    'Saturday',
    'Sat OT <=2h',
    'Sat OT >2h',
    'Sunday',
    'Sun OT <=2h',
    'Sun OT >2h',
    'Holiday',
    'Hol OT <=2h',
    'Hol OT >2h',
    'Nursing',
    'Broken Shifts',
    'Sleepovers',
    'OT After 76h',
    'Gross Pay',
  ];

  const lines = [headers.join(',')];

  for (const row of rows) {
    const m = getMergedRow(row);
    const gross = getGrossPay(row, m);
    lines.push(
      [
        csvEscape(row.staffName),
        staffTotalHours(m),
        n(m.morningHours),
        n(m.afternoonHours),
        n(m.nightHours),
        n(m.weekdayOtUpto2),
        n(m.weekdayOtAfter2),
        n(m.saturdayHours),
        n(m.saturdayOtUpto2),
        n(m.saturdayOtAfter2),
        n(m.sundayHours),
        n(m.sundayOtUpto2),
        n(m.sundayOtAfter2),
        n(m.holidayHours),
        n(m.holidayOtUpto2),
        n(m.holidayOtAfter2),
        n(m.nursingCareHours),
        n(m.brokenShiftCount),
        n(m.sleepoversCount),
        n(m.otAfter76Hours),
        gross != null ? gross : '',
      ].join(',')
    );
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `employee_hours_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
