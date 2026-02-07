import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const USERS_QUERY_KEY = 'users';

export const useUsers = () => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data;
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await api.post('/api/users', body);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const response = await api.put(`/api/users/${id}`, body);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/api/users/${id}`);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
  });
};
