import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const STAFF_QUERY_KEY = 'staff';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** All pages from ShiftCare staff API (for name → id matching on rates import). */
export async function fetchAllStaffForRatesImport() {
  const all = [];
  let page = 1;
  const perPage = 100;
  for (;;) {
    const { data } = await api.get('/api/staff', {
      params: {
        include_metadata: true,
        per_page: perPage,
        page,
        sort_by: 'name',
        sort_type: 'asc',
      },
    });
    const batch = data.staff || [];
    all.push(...batch);
    const meta = data._metadata;
    if (!meta || page >= meta.total_pages || batch.length === 0) break;
    page += 1;
  }
  return all;
}

export const useStaff = (params = {}) => {
    return useQuery({
        queryKey: [STAFF_QUERY_KEY, params],
        queryFn: async () => {
            const response = await api.get('/api/staff', { params });
            return response.data;
        },
        refetchInterval: REFETCH_INTERVAL,
        staleTime: REFETCH_INTERVAL,
    });
};
