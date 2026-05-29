/** Match backend utils/normalizeRatio.js — strip leading zeros per side of ":" */
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
