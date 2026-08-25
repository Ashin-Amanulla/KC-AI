import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const KEY = 'custom-modules';

export const useCustomModules = () =>
  useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const res = await api.get('/api/custom-modules');
      return res.data?.modules || [];
    },
    staleTime: 30_000,
  });

export const useCustomModule = (slug) =>
  useQuery({
    queryKey: [KEY, slug],
    queryFn: async () => {
      const res = await api.get(`/api/custom-modules/slug/${encodeURIComponent(slug)}`);
      return res.data?.module;
    },
    enabled: Boolean(slug),
  });

function invalidate(queryClient) {
  queryClient.invalidateQueries({ queryKey: [KEY] });
}

export const useCreateCustomModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/custom-modules', body)).data?.module,
    onSuccess: () => invalidate(qc),
  });
};

export const useUpdateCustomModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      (await api.put(`/api/custom-modules/${id}`, body)).data?.module,
    onSuccess: () => invalidate(qc),
  });
};

export const useDeleteCustomModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/custom-modules/${id}`);
      return id;
    },
    onSuccess: () => invalidate(qc),
  });
};
