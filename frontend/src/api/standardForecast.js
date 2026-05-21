import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const Q = {
  directory: ['standard-forecast', 'directory'],
  standard: (p) => ['standard-forecast', 'standard', p],
  summary: (p) => ['standard-forecast', 'summary', p],
};

function parseFilenameFromDisposition(cd) {
  if (!cd) return 'download';
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return m ? m[1].trim() : 'download';
}

export async function downloadBlobGet(path, params, fallbackName = 'download') {
  const res = await api.get(path, { params, responseType: 'blob' });
  const name = parseFilenameFromDisposition(res.headers['content-disposition']) || fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function useStandardDirectory(enabled = true) {
  return useQuery({
    queryKey: Q.directory,
    queryFn: async () => {
      const res = await api.get('/api/standard-forecast/directory');
      return res.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStandardList(params, enabled) {
  return useQuery({
    queryKey: Q.standard(params),
    queryFn: async () => {
      const res = await api.get('/api/standard-forecast/standard', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useStandardVsForecastSummary(params, enabled) {
  return useQuery({
    queryKey: Q.summary(params),
    queryFn: async () => {
      const res = await api.get('/api/standard-forecast/summary', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useUploadStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, file }) => {
      const fd = new FormData();
      fd.append('locationId', locationId);
      fd.append('file', file);
      const res = await api.post('/api/standard-forecast/standard/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-forecast'] });
    },
  });
}

export function useCreateStandardRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/api/standard-forecast/standard', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-forecast'] });
    },
  });
}

export function useUpdateStandardRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await api.put(`/api/standard-forecast/standard/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-forecast'] });
    },
  });
}

export function useDeleteStandardRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, locationId }) => {
      const res = await api.delete(`/api/standard-forecast/standard/${id}`, { params: { locationId } });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standard-forecast'] });
    },
  });
}

export async function exportStandardCsv(params) {
  await downloadBlobGet('/api/standard-forecast/standard/export', params, 'standard.csv');
}

export async function exportStandardVsForecastCsv(params) {
  await downloadBlobGet('/api/standard-forecast/summary/export.csv', params, 'standard_vs_forecast.csv');
}

export async function exportStandardVsForecastPdf(params) {
  await downloadBlobGet('/api/standard-forecast/summary/export.pdf', params, 'standard_vs_forecast.pdf');
}
