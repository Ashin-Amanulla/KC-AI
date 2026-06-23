/** UX helpers for the admin permission catalog (labels, grouping, summaries). */

export const CATEGORY_ORDER = [
  'Home & directory',
  'Payroll & finance',
  'Roster & shifts',
  'Sales & CRM',
  'Quality',
  'Administration',
];

export const ACCESS_LEVEL_LABELS = {
  view: { label: 'View only', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  edit: { label: 'Can edit', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  admin: { label: 'Admin', className: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200' },
};

/** Dedupe catalog entries by permission key (API may send one row per nav path). */
export function normalizeCatalog(catalog = []) {
  const byKey = new Map();
  for (const item of catalog) {
    const existing = byKey.get(item.key);
    if (!existing) {
      byKey.set(item.key, { ...item, areas: item.areas ? [...item.areas] : [] });
      continue;
    }
    if (item.label && !existing.areas?.includes(item.label)) {
      existing.areas = [...(existing.areas || []), item.label];
    }
  }
  return [...byKey.values()];
}

export function groupCatalogByCategory(catalog = []) {
  const normalized = normalizeCatalog(catalog);
  const groups = {};
  for (const item of normalized) {
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }
  const ordered = {};
  for (const cat of CATEGORY_ORDER) {
    if (groups[cat]?.length) ordered[cat] = groups[cat];
  }
  for (const cat of Object.keys(groups)) {
    if (!ordered[cat]) ordered[cat] = groups[cat];
  }
  return ordered;
}

export function summarizePermissions(permissionKeys = [], catalog = []) {
  const normalized = normalizeCatalog(catalog);
  const keySet = new Set(permissionKeys);
  const labels = normalized.filter((item) => keySet.has(item.key)).map((item) => item.label);
  return labels;
}

export function permissionsByCategory(permissionKeys = [], catalog = []) {
  const normalized = normalizeCatalog(catalog);
  const keySet = new Set(permissionKeys);
  const groups = {};
  for (const item of normalized) {
    if (!keySet.has(item.key)) continue;
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item.label);
  }
  return groups;
}

export function filterCatalogGroups(groups, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return groups;
  const filtered = {};
  for (const [category, items] of Object.entries(groups)) {
    const match = items.filter(
      (item) =>
        item.label?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        (item.areas || []).some((a) => a.toLowerCase().includes(q))
    );
    if (match.length) filtered[category] = match;
  }
  return filtered;
}
