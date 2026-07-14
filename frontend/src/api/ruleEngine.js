import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const RULES_KEY = 'rule-engine-rules';
const RUNS_KEY = 'rule-engine-test-runs';
const AWARD_RATES_KEY = 'award-rate-sets';
const COVERAGE_KEY = 'rule-engine-coverage';

/** Rules catalog joined with the latest test run (per-rule pass/fail/untested). */
export const useRuleCatalog = () => {
  return useQuery({
    queryKey: [RULES_KEY],
    queryFn: async () => {
      const response = await api.get('/api/rule-engine/rules');
      return response.data;
    },
    staleTime: 30000,
  });
};

export const useTestRuns = (limit = 20) => {
  return useQuery({
    queryKey: [RUNS_KEY, limit],
    queryFn: async () => {
      const response = await api.get('/api/rule-engine/test-runs', { params: { limit } });
      return response.data;
    },
    staleTime: 15000,
  });
};

export const useTestRun = (runId) => {
  return useQuery({
    queryKey: [RUNS_KEY, 'detail', runId],
    queryFn: async () => {
      const response = await api.get(`/api/rule-engine/test-runs/${runId}`);
      return response.data;
    },
    enabled: !!runId,
  });
};

export const useExecuteTestRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/rule-engine/test-runs');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RUNS_KEY] });
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
};

export const useAwardRateSets = () => {
  return useQuery({
    queryKey: [AWARD_RATES_KEY],
    queryFn: async () => {
      const response = await api.get('/api/award-rates');
      return response.data;
    },
    staleTime: 60000,
  });
};

export const useUpdateAwardRateSet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }) => {
      const response = await api.patch(`/api/award-rates/${id}`, update);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AWARD_RATES_KEY] }),
  });
};

export const useRateCardCoverage = (locationId) => {
  return useQuery({
    queryKey: [COVERAGE_KEY, locationId ?? 'all'],
    queryFn: async () => {
      const params = {};
      if (locationId) params.locationId = locationId;
      const response = await api.get('/api/rule-engine/coverage', { params });
      return response.data;
    },
    staleTime: 30000,
  });
};

export const useAnomalies = (locationId) => {
  return useQuery({
    queryKey: ['rule-engine-anomalies', locationId ?? 'all'],
    queryFn: async () => {
      const params = {};
      if (locationId) params.locationId = locationId;
      const response = await api.get('/api/rule-engine/anomalies', { params });
      return response.data;
    },
    staleTime: 30000,
  });
};

export const useGoldenDiff = () => {
  return useMutation({
    mutationFn: async ({ expected, locationId }) => {
      const response = await api.post('/api/rule-engine/golden-diff', { expected, locationId });
      return response.data;
    },
  });
};
