/**
 * Canonical rate-group label for variance comparisons.
 *
 * ShiftCare exports drift in whitespace/casing between runs ("High Intensity  Pm",
 * trailing spaces, "AM" vs "Am"). These label-level differences do not represent a
 * real billing change, so collapse whitespace runs, trim, and lowercase before
 * comparing. Mirrors normalizeRatio() semantics for ratios.
 */
export function normalizeRateGroups(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when two rate-group labels are equivalent after normalization. */
export function rateGroupsEqual(a, b) {
  return normalizeRateGroups(a) === normalizeRateGroups(b);
}
