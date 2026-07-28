import { createShiftCareAxios } from '../forecast-actuals/shiftcareFetch.js';

const MAX_PAGES = 500;
const PER_PAGE = 20;

/**
 * Page through a ShiftCare list endpoint until all rows are fetched.
 * @param {object} credentials
 * @param {string} endpoint - e.g. '/v3/timesheets'
 * @param {Record<string, unknown>} baseParams
 * @param {string} rowsKey - response array key e.g. 'timesheets'
 */
export async function fetchAllShiftCarePages(credentials, endpoint, baseParams = {}, rowsKey) {
  const client = createShiftCareAxios(credentials);
  const all = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const { data } = await client.get(endpoint, {
      params: {
        ...baseParams,
        page,
        per_page: PER_PAGE,
        include_metadata: true,
      },
    });

    const rows = data[rowsKey] || data.data || [];
    const meta = data._metadata || data.metadata || {};
    const totalPages = meta.total_pages != null ? Number(meta.total_pages) : null;

    all.push(...rows);

    if (!rows.length) break;
    if (totalPages != null && page >= totalPages) break;
    if (totalPages == null && rows.length < PER_PAGE) break;
    page += 1;
  }

  return all;
}

export { PER_PAGE, MAX_PAGES };
