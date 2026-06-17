/**
 * Allocate next sequential business ID for CRM entities (PREFIX-0001 style).
 */

export const CRM_ID_CONFIG = {
  'support-coordinators': { field: 'scId', prefix: 'SC', padWidth: 3 },
  leads: { field: 'leadId', prefix: 'L', padWidth: 4 },
  'marketing-activities': { field: 'activityId', prefix: 'ACT', padWidth: 4 },
};

/**
 * Parse numeric suffix from IDs matching PREFIX-NUM (e.g. SC-001, L-0002).
 * @param {string[]} ids
 * @param {string} prefix
 * @returns {number} max suffix found, or 0
 */
export function maxNumericSuffix(ids, prefix) {
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

/**
 * Format next ID from max suffix.
 */
export function formatNextId(prefix, padWidth, maxSuffix) {
  const next = maxSuffix + 1;
  return `${prefix}-${String(next).padStart(padWidth, '0')}`;
}

/**
 * Query model for existing PREFIX-NUM IDs and return the next one.
 * @param {import('mongoose').Model} model
 * @param {string} field
 * @param {string} prefix
 * @param {number} padWidth
 */
export async function allocateNextId(model, field, prefix, padWidth) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}-\\d+$`, 'i');
  const rows = await model.find({ [field]: regex }).select(field).lean();
  const ids = rows.map((r) => r[field]);
  const max = maxNumericSuffix(ids, prefix);
  return formatNextId(prefix, padWidth, max);
}

export function isBlankId(value) {
  return !String(value ?? '').trim();
}
