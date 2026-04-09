import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

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

export const getPayHoursExportUrl = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return `/api/pay-hours/export${qs ? `?${qs}` : ''}`;
};
