import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const ROLES_QUERY_KEY = 'roles';

export const useRoles = (options = {}) => {
  return useQuery({
    queryKey: [ROLES_QUERY_KEY],
    queryFn: async () => {
      const response = await api.get('/api/roles');
      return response.data;
    },
    ...options,
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await api.post('/api/roles', body);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] }),
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const response = await api.put(`/api/roles/${id}`, body);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] }),
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/roles/${id}`);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] }),
  });
};
