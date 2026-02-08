import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export const ANALYSIS_JOB_STATUS_KEY = 'analysis-job-status';
export const ANALYSIS_JOB_KEY = 'analysis-job';
export const ANALYSIS_JOBS_LIST_KEY = 'analysis-jobs';

export const useStartAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/analyze-shift-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [ANALYSIS_JOB_STATUS_KEY, data.jobId] });
      queryClient.invalidateQueries({ queryKey: [ANALYSIS_JOBS_LIST_KEY] });
    },
  });
};

export const useAnalysisJobStatus = (jobId) => {
  return useQuery({
    queryKey: [ANALYSIS_JOB_STATUS_KEY, jobId],
    queryFn: async () => {
      const response = await api.get(`/api/analysis-jobs/${jobId}/status`);
      return response.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      return data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled' ? false : 3000;
    },
    enabled: !!jobId,
  });
};

export const useCancelAnalysisJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId) => {
      const response = await api.post(`/api/analysis-jobs/${jobId}/cancel`);
      return response.data;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: [ANALYSIS_JOB_STATUS_KEY, jobId] });
      queryClient.invalidateQueries({ queryKey: [ANALYSIS_JOBS_LIST_KEY] });
    },
  });
};

export const useAnalysisJob = (jobId, options = {}) => {
  return useQuery({
    queryKey: [ANALYSIS_JOB_KEY, jobId],
    queryFn: async () => {
      const response = await api.get(`/api/analysis-jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId && (options.enabled !== false),
  });
};

export const useAnalysisJobsList = () => {
  return useQuery({
    queryKey: [ANALYSIS_JOBS_LIST_KEY],
    queryFn: async () => {
      const response = await api.get('/api/analysis-jobs');
      return response.data;
    },
  });
};
