import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const SC = '/api/shiftcare';
const REFETCH = 5 * 60 * 1000;

export function useShiftCareKpis(params = {}) {
  return useQuery({
    queryKey: ['shiftcare-kpis', params],
    queryFn: async () => (await api.get(`${SC}/kpis`, { params })).data,
    enabled: !!(params.from && params.to),
    staleTime: REFETCH,
    refetchInterval: REFETCH,
  });
}

export function useProgressNotes(params = {}) {
  return useQuery({
    queryKey: ['shiftcare-progress-notes', params],
    queryFn: async () => (await api.get(`${SC}/progress-notes`, { params })).data,
    enabled: !!(params.shift_date_from && params.shift_date_to) || !!params.page,
    staleTime: REFETCH,
  });
}

export function useFundsDashboard() {
  return useQuery({
    queryKey: ['shiftcare-funds-dashboard'],
    queryFn: async () => (await api.get(`${SC}/funds-dashboard`)).data,
    staleTime: REFETCH,
  });
}

export function useInvoices(params = {}) {
  return useQuery({
    queryKey: ['shiftcare-invoices', params],
    queryFn: async () => (await api.get(`${SC}/invoices`, { params })).data,
    staleTime: REFETCH,
  });
}

export function useComplianceDashboard(params = {}) {
  return useQuery({
    queryKey: ['shiftcare-compliance', params],
    queryFn: async () => (await api.get(`${SC}/compliance-dashboard`, { params })).data,
    staleTime: REFETCH,
  });
}

export function useWebhookSubscriptions() {
  return useQuery({
    queryKey: ['shiftcare-webhooks'],
    queryFn: async () => (await api.get(`${SC}/webhooks/subscriptions`, { params: { include_metadata: true } })).data,
    staleTime: REFETCH,
  });
}

export function useWebhookEventTypes() {
  return useQuery({
    queryKey: ['shiftcare-webhook-event-types'],
    queryFn: async () => (await api.get(`${SC}/webhooks/event-types`)).data,
    staleTime: 60 * 60 * 1000,
  });
}

export { SC as SHIFTCARE_API_BASE };
