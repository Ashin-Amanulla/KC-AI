function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Display stored Date using UTC calendar components (matches CSV import/export). */
export function formatUtcDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
}

export function formatUtcDateTime(d) {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return `${formatUtcDate(d)} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

export function formatUtcTime(d) {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

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
