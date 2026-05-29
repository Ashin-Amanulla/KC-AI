/**
 * Canonical staffing ratio: strip leading zeros on each side of ":".
 * e.g. "01:02" / "1:02" -> "1:2", "1:01" -> "1:1"
 * Non-matching strings are returned trimmed unchanged.
 */
export function normalizeRatio(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';

  const m = s.match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return s;

  const left = parseInt(m[1], 10);
  const right = parseInt(m[2], 10);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return s;
  return `${left}:${right}`;
}
