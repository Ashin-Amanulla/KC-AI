import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const Q = {
  directory: ['forecast-actuals', 'directory'],
  forecast: (p) => ['forecast-actuals', 'forecast', p],
  actuals: (p) => ['forecast-actuals', 'actuals', p],
  summary: (p) => ['forecast-actuals', 'summary', p],
  variance: (p) => ['forecast-actuals', 'variance', p],
  detail: (locationId, sid) => ['forecast-actuals', 'detail', locationId, sid],
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

export function useForecastDirectory(enabled = true) {
  return useQuery({
    queryKey: Q.directory,
    queryFn: async () => {
      const res = await api.get('/api/forecast-actuals/directory');
      return res.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useForecastList(params, enabled) {
  return useQuery({
    queryKey: Q.forecast(params),
    queryFn: async () => {
      const res = await api.get('/api/forecast-actuals/forecast', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useActualsList(params, enabled) {
  return useQuery({
    queryKey: Q.actuals(params),
    queryFn: async () => {
      const res = await api.get('/api/forecast-actuals/actuals', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useForecastSummary(params, enabled) {
  return useQuery({
    queryKey: Q.summary(params),
    queryFn: async () => {
      const res = await api.get('/api/forecast-actuals/summary', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useVarianceList(params, enabled) {
  return useQuery({
    queryKey: Q.variance(params),
    queryFn: async () => {
      const res = await api.get('/api/forecast-actuals/variance', { params });
      return res.data;
    },
    enabled: Boolean(enabled && params?.locationId),
  });
}

export function useVarianceDetail(locationId, shiftcareId, enabled) {
  return useQuery({
    queryKey: Q.detail(locationId, shiftcareId),
    queryFn: async () => {
      const res = await api.get(`/api/forecast-actuals/variance/${encodeURIComponent(shiftcareId)}/detail`, {
        params: { locationId },
      });
      return res.data;
    },
    enabled: Boolean(enabled && locationId && shiftcareId),
  });
}

export function useUploadForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, file }) => {
      const fd = new FormData();
      fd.append('locationId', locationId);
      fd.append('file', file);
      const res = await api.post('/api/forecast-actuals/forecast/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forecast-actuals'] });
    },
  });
}

export function useUploadActuals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, file }) => {
      const fd = new FormData();
      fd.append('locationId', locationId);
      fd.append('file', file);
      const res = await api.post('/api/forecast-actuals/actuals/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forecast-actuals'] });
    },
  });
}

export async function exportForecastCsv(params) {
  await downloadBlobGet('/api/forecast-actuals/forecast/export', params, 'forecast.csv');
}

export async function exportActualsCsv(params) {
  await downloadBlobGet('/api/forecast-actuals/actuals/export', params, 'actuals.csv');
}

export async function exportSummaryCsv(params) {
  await downloadBlobGet('/api/forecast-actuals/summary/export.csv', params, 'summary.csv');
}

export async function exportSummaryPdf(params) {
  await downloadBlobGet('/api/forecast-actuals/summary/export.pdf', params, 'summary.pdf');
}

export async function exportVarianceCsv(params) {
  await downloadBlobGet('/api/forecast-actuals/variance/export.csv', params, 'variance.csv');
}
