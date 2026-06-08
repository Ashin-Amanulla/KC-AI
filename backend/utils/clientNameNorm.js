/**
 * Normalise client display names for CSV upload matching against ShiftCare directory.
 */
export function normClientNameForMatch(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Resolve a CSV client name against the directory lookup map. */
export function resolveClientEntry(rawName, clientMap) {
  const key = normClientNameForMatch(rawName);
  if (!key) return null;
  return clientMap.get(key) || null;
}
