import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const STAFF_QUERY_KEY = 'staff';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
