import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { downloadBlobGet } from '../lib/downloadBlob';

const Q = {
  records: (params) => ['cir', params],
};

export function useCirRecords(params = {}) {
  return useQuery({
    queryKey: Q.records(params),
    queryFn: async () => (await api.get('/api/cir', { params })).data,
  });
}

export function useCreateCirRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/cir', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cir'] }),
  });
}

export function useUpdateCirRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => (await api.put(`/api/cir/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cir'] }),
  });
}

export function useDeleteCirRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/api/cir/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cir'] }),
  });
}

export function useAppendCirActionUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text, authorName }) =>
      (
        await api.post(`/api/cir/${id}/action-updates`, {
          text,
          authorName,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cir'] }),
  });
}

export function useCirImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return (
        await api.post('/api/cir/import', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cir'] }),
  });
}

export async function exportCirWorkbook() {
  await downloadBlobGet('/api/cir/export', {}, 'continuous-improvement-register.xlsx');
}

export async function fetchCirNextId() {
  const res = await api.get('/api/cir/next-id');
  return res.data;
}
