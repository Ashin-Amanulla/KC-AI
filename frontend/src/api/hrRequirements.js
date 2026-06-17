import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const Q = {
  requirements: (params) => ['hr-requirements', params],
};

export function useHrRequirements(params = {}) {
  return useQuery({
    queryKey: Q.requirements(params),
    queryFn: async () =>
      (await api.get('/api/crm/staffing-requirements', { params })).data,
  });
}

export function useCreateHrRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      (await api.post('/api/crm/staffing-requirements', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-requirements'] });
    },
  });
}

export function useUpdateHrRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.put(`/api/crm/staffing-requirements/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-requirements'] });
    },
  });
}

export function useDeleteHrRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) =>
      (await api.delete(`/api/crm/staffing-requirements/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-requirements'] });
    },
  });
}
