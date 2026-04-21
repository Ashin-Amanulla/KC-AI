import { createShiftCareAxios } from './shiftcareFetch.js';

const PER_PAGE = 100;

export function clientDisplayName(c) {
  const dn = (c.display_name || '').trim();
  if (dn) return dn;
  const fn = (c.first_name || '').trim();
  const fam = (c.family_name || '').trim();
  return `${fn} ${fam}`.trim() || String(c.id || '');
}

export function staffDisplayName(s) {
  const n = (s.name || '').trim();
  if (n) return n;
  const fn = (s.first_name || '').trim();
  const fam = (s.family_name || '').trim();
  return `${fn} ${fam}`.trim() || String(s.id || '');
}

/**
 * Fetch all pages from ShiftCare /v3/clients
 * @returns {Promise<Array<{ id: string, displayName: string, key: string }>>}
 */
export async function fetchAllClients(credentials) {
  const client = createShiftCareAxios(credentials);
  const out = [];
  let page = 1;
  const maxPages = 500;

  while (page <= maxPages) {
    const { data } = await client.get('/v3/clients', {
      params: {
        page,
        per_page: PER_PAGE,
        include_metadata: true,
        sort_by: 'name',
        sort_type: 'asc',
      },
    });

    const rows = data.clients || data.data || [];
    const meta = data._metadata || data.metadata || {};
    const totalPages = meta.total_pages != null ? Number(meta.total_pages) : null;

    for (const c of rows) {
      const displayName = clientDisplayName(c);
      const key = displayName.toLowerCase();
      out.push({
        id: String(c.id),
        displayName,
        key,
      });
    }

    if (!rows.length) break;
    if (totalPages != null && page >= totalPages) break;
    if (totalPages == null && rows.length < PER_PAGE) break;
    page += 1;
  }

  return out;
}

/**
 * Fetch all pages from ShiftCare /v3/staff
 * @returns {Promise<Array<{ id: string, displayName: string, key: string }>>}
 */
export async function fetchAllStaff(credentials) {
  const client = createShiftCareAxios(credentials);
  const out = [];
  let page = 1;
  const maxPages = 500;

  while (page <= maxPages) {
    const { data } = await client.get('/v3/staff', {
      params: {
        page,
        per_page: PER_PAGE,
        include_metadata: true,
        sort_by: 'name',
        sort_type: 'asc',
      },
    });

    const rows = data.staff || data.data || [];
    const meta = data._metadata || data.metadata || {};
    const totalPages = meta.total_pages != null ? Number(meta.total_pages) : null;

    for (const s of rows) {
      const displayName = staffDisplayName(s);
      const key = displayName.toLowerCase();
      out.push({
        id: String(s.id),
        displayName,
        key,
      });
    }

    if (!rows.length) break;
    if (totalPages != null && page >= totalPages) break;
    if (totalPages == null && rows.length < PER_PAGE) break;
    page += 1;
  }

  return out;
}

/**
 * Build lookup maps: lowercase name -> { id, displayName }
 * Last duplicate name wins (matches Django dict behaviour).
 */
export function buildLookupMaps(clients, staff) {
  const clientMap = new Map();
  for (const c of clients) {
    clientMap.set(c.key, { id: c.id, displayName: c.displayName });
  }
  const staffMap = new Map();
  for (const s of staff) {
    staffMap.set(s.key, { id: s.id, displayName: s.displayName });
  }
  return { clientMap, staffMap };
}
