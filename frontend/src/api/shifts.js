import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const SHIFTS_QUERY_KEY = 'uploaded-shifts';

export const useShifts = (params = {}) => {
  return useQuery({
    queryKey: [SHIFTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await api.get('/api/shifts', { params });
      return response.data;
    },
    staleTime: 30000,
  });
};

export const useShiftDateRange = () => {
  return useQuery({
    queryKey: [SHIFTS_QUERY_KEY, 'date-range'],
    queryFn: async () => {
      const response = await api.get('/api/shifts/date-range');
      return response.data;
    },
    staleTime: 30000,
  });
};

export const useUploadShifts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, locationId }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (locationId) formData.append('locationId', locationId);
      const response = await api.post('/api/shifts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHIFTS_QUERY_KEY] });
    },
  });
};

export const getShiftsExportUrl = () => '/api/shifts/export';
