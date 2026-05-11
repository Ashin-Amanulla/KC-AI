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
  const parts = n.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return n;
}
