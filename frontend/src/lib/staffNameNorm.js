/**
 * Staff name normalization for matching billing, pay hours, payroll, and SCHADS rates.
 * Keep in sync with backend/utils/staffNameNorm.js
 */

export function normStaffNameForMatch(s) {
  if (!s) return '';
  let n = String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .trim();
  n = n.replace(/\s+/g, ' ');
  const parts = n
    .split(/\s+/)
    .map((p) => p.replace(/,/g, ''))
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return parts[0] || '';
}

/** @deprecated use normStaffNameForMatch — same as schadsWageCalc.normName */
export const normName = normStaffNameForMatch;

export function normFromLastCommaFirst(s) {
  const t = String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^([^,]+),\s*(.+)$/.exec(t);
  if (!m) return '';
  const last = m[1].trim().replace(/\s+/g, ' ');
  const rest = m[2].trim().replace(/\s+/g, ' ');
  const first = rest.split(/\s+/)[0];
  if (!first || !last) return '';
  return `${first} ${last}`;
}

export function nameMatchKeys(displayName) {
  const keys = new Set();
  const n = normStaffNameForMatch(displayName);
  if (n) keys.add(n);
  const comma = normFromLastCommaFirst(displayName);
  if (comma) keys.add(comma);
  const weak = String(displayName ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (weak && weak !== n) keys.add(weak);
  return keys;
}
