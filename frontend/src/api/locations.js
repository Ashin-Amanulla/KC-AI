import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const LOCATIONS_KEY = 'locations';

export const useLocations = () => {
  return useQuery({
    queryKey: [LOCATIONS_KEY],
    queryFn: async () => {
      const response = await api.get('/api/locations');
      return response.data;
    },
    staleTime: 300000, // locations change rarely
  });
};

export const useCreateLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, code, timezone, pricingRegion }) => {
      const response = await api.post('/api/locations', { name, code, timezone, pricingRegion });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATIONS_KEY] });
    },
  });
};

export const useDeleteLocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/locations/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATIONS_KEY] });
    },
  });
};

export const useLoadHolidayFixture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, year }) => {
      const response = await api.post(`/api/locations/${locationId}/load-holidays`, { year });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });
};
