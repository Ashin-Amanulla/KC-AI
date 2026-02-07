import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const TIMESHEETS_QUERY_KEY = 'timesheets';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useTimesheets = (params = {}) => {
    return useQuery({
        queryKey: [TIMESHEETS_QUERY_KEY, params],
        queryFn: async () => {
            const response = await api.get('/api/timesheets', { params });
            return response.data;
        },
        refetchInterval: REFETCH_INTERVAL,
        staleTime: REFETCH_INTERVAL,
        // Only fetch when from and to are provided
        enabled: !!(params.from && params.to),
    });
};
