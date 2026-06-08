import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { downloadBlobGet } from '../lib/downloadBlob';

const PAY_HOURS_QUERY_KEY = 'pay-hours';
const PAY_HOURS_JOB_QUERY_KEY = 'pay-hours-job';

export const usePayHours = (params = {}) => {
  return useQuery({
    queryKey: [PAY_HOURS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await api.get('/api/pay-hours', { params });
      return response.data;
    },
    staleTime: 15000,
  });
};

export const useShiftPayHours = (payHoursId, enabled = false) => {
  return useQuery({
    queryKey: [PAY_HOURS_QUERY_KEY, 'shifts', payHoursId],
    queryFn: async () => {
      const response = await api.get(`/api/pay-hours/${payHoursId}/shifts`);
      return response.data;
    },
    enabled: !!payHoursId && enabled,
    staleTime: 60000,
  });
};

export const useComputePayHours = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId } = {}) => {
      const response = await api.post('/api/pay-hours/compute', { locationId: locationId ?? null });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAY_HOURS_JOB_QUERY_KEY] });
    },
  });
};

export const usePayHoursJobStatus = (jobId) => {
  return useQuery({
    queryKey: [PAY_HOURS_JOB_QUERY_KEY, jobId],
    queryFn: async () => {
      const response = await api.get(`/api/pay-hours/jobs/${jobId}/status`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state?.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 3000;
    },
  });
};

export const useRunPayHoursTests = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/pay-hours/tests/run');
      return response.data;
    },
  });
};

export async function exportPayHoursCsv(params = {}) {
  await downloadBlobGet('/api/pay-hours/export', params, 'pay_hours.csv');
}

export async function patchPayHoursManual(payHoursId, payload) {
  const response = await api.patch(`/api/pay-hours/${payHoursId}`, payload);
  return response.data;
}

export async function clearPayHoursManual(payHoursId) {
  const response = await api.delete(`/api/pay-hours/${payHoursId}/manual`);
  return response.data;
}

export async function patchShiftPayHoursManual(payHoursId, shiftPayHoursId, fields) {
  const response = await api.patch(`/api/pay-hours/${payHoursId}/shifts/${shiftPayHoursId}`, {
    fields,
  });
  return response.data;
}

export async function clearShiftPayHoursManual(payHoursId, shiftPayHoursId) {
  const response = await api.delete(
    `/api/pay-hours/${payHoursId}/shifts/${shiftPayHoursId}/manual`
  );
  return response.data;
}

export const usePatchPayHoursManual = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payHoursId, fields, unset }) =>
      patchPayHoursManual(payHoursId, { fields, unset }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAY_HOURS_QUERY_KEY] });
    },
  });
};

export const useClearPayHoursManual = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payHoursId) => clearPayHoursManual(payHoursId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAY_HOURS_QUERY_KEY] });
    },
  });
};

export const usePatchShiftPayHoursManual = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payHoursId, shiftPayHoursId, fields }) =>
      patchShiftPayHoursManual(payHoursId, shiftPayHoursId, fields),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [PAY_HOURS_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [PAY_HOURS_QUERY_KEY, 'shifts', vars.payHoursId],
      });
    },
  });
};
