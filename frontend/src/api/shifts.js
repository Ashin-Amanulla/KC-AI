import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const SHIFTS_QUERY_KEY = 'shifts';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useShifts = (params = {}) => {
    return useQuery({
        queryKey: [SHIFTS_QUERY_KEY, params],
        queryFn: async () => {
            const response = await api.get('/api/shifts', { params });
            return response.data;
        },
        refetchInterval: REFETCH_INTERVAL,
        staleTime: REFETCH_INTERVAL,
    });
};
