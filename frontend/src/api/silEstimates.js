import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const SIL_ESTIMATES_KEY = 'sil-estimates';

export const useSilEstimates = () =>
  useQuery({
    queryKey: [SIL_ESTIMATES_KEY],
    queryFn: async () => {
      const response = await api.get('/api/sil-estimates');
      return response.data;
    },
    staleTime: 30000,
  });

export const useSilEstimate = (id) =>
  useQuery({
    queryKey: [SIL_ESTIMATES_KEY, id],
    queryFn: async () => {
      const response = await api.get(`/api/sil-estimates/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 0,
  });

export const useCreateSilEstimate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await api.post('/api/sil-estimates', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SIL_ESTIMATES_KEY] });
    },
  });
};

export const useUpdateSilEstimate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) => {
      const response = await api.put(`/api/sil-estimates/${id}`, body);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [SIL_ESTIMATES_KEY] });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: [SIL_ESTIMATES_KEY, variables.id] });
      }
    },
  });
};

export const useDeleteSilEstimate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/sil-estimates/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SIL_ESTIMATES_KEY] });
    },
  });
};

export const useDuplicateSilEstimate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.post(`/api/sil-estimates/${id}/duplicate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SIL_ESTIMATES_KEY] });
    },
  });
};
