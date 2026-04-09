import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const HOLIDAYS_QUERY_KEY = 'holidays';

export const useHolidays = (params = {}) => {
  return useQuery({
    queryKey: [HOLIDAYS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await api.get('/api/holidays', { params });
      return response.data;
    },
    staleTime: 60000,
  });
};

export const useCreateHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, name, locationId }) => {
      const response = await api.post('/api/holidays', { date, name, locationId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOLIDAYS_QUERY_KEY] });
    },
  });
};

export const useDeleteHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/holidays/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOLIDAYS_QUERY_KEY] });
    },
  });
};
