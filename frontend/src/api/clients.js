import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const CLIENTS_QUERY_KEY = 'clients';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FETCH_ALL_PER_PAGE = 100;

async function fetchAllClientPages() {
  const all = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get('/api/clients', {
      params: {
        include_metadata: true,
        per_page: FETCH_ALL_PER_PAGE,
        page,
        sort_by: 'name',
        sort_type: 'asc',
      },
    });
    const batch = data.clients || [];
    all.push(...batch);
    const meta = data._metadata;
    if (!meta || page >= meta.total_pages || batch.length === 0) break;
    page += 1;
  }
  return all;
}

export const useAllClients = () => {
  return useQuery({
    queryKey: [CLIENTS_QUERY_KEY, 'all'],
    queryFn: fetchAllClientPages,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
  });
};

export const useClients = (params = {}) => {
  return useQuery({
    queryKey: [CLIENTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await api.get('/api/clients', { params });
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
  });
};
