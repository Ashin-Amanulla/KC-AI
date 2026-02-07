import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const CLIENTS_QUERY_KEY = 'clients';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
