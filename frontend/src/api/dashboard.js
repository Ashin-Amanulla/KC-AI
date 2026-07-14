import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

export const useDashboardSummary = (locationId) => {
  return useQuery({
    queryKey: ['dashboard-summary', locationId ?? 'all'],
    queryFn: async () => {
      const params = {};
      if (locationId) params.locationId = locationId;
      const response = await api.get('/api/dashboard/summary', { params });
      return response.data;
    },
    staleTime: 30000,
  });
};
