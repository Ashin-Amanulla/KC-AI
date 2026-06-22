/**
 * Allocate CIR IDs in format CIR-YYYY-NNN (e.g. CIR-2026-001).
 */

export function cirIdPrefixForYear(year = new Date().getFullYear()) {
  return `CIR-${year}`;
}

export function maxCirSuffix(ids, year = new Date().getFullYear()) {
  const prefix = cirIdPrefixForYear(year);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}-(\\d+)$`, 'i');
  let max = 0;
  for (const id of ids) {
    const m = String(id || '').trim().match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

export function formatCirId(year, suffix) {
  return `${cirIdPrefixForYear(year)}-${String(suffix).padStart(3, '0')}`;
}

/**
 * @param {import('mongoose').Model} model
 * @param {number} [year]
 */
export async function allocateNextCirId(model, year = new Date().getFullYear()) {
  const prefix = cirIdPrefixForYear(year);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}-\\d+$`, 'i');
  const rows = await model.find({ cirId: regex }).select('cirId').lean();
  const ids = rows.map((r) => r.cirId);
  const next = maxCirSuffix(ids, year) + 1;
  return formatCirId(year, next);
}

export function isBlankCirId(value) {
  return !String(value ?? '').trim();
}
