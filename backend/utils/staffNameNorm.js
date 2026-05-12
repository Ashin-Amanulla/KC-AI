/**
 * Normalise a display name for fuzzy matching (ShiftCare / roster / SCHADS staff lists).
 * Aligns with staff-rates normName: lowercase, strip parentheticals, collapse spaces,
 * then use first + last token only (drops middle names/initials).
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

/**
 * "Bloggs, Joe" / "Bloggs,Joe" → "joe bloggs" (first token + last name) for cross-matching roster "Joe Bloggs".
 */
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

/** Keys to match ShiftCare export names ↔ roster fullName (handles Last, First vs First Last). */
export function nameMatchKeys(displayName) {
  const keys = new Set();
  const n = normStaffNameForMatch(displayName);
  if (n) keys.add(n);
  const comma = normFromLastCommaFirst(displayName);
  if (comma) keys.add(comma);
  return keys;
}
