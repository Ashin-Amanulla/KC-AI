import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { downloadBlobGet } from '../lib/downloadBlob';

const Q = {
  dashboard: (params) => ['crm', 'dashboard', params],
  bdmOwners: ['crm', 'bdm-owners'],
  supportCoordinators: (params) => ['crm', 'support-coordinators', params],
  leads: (params) => ['crm', 'leads', params],
  marketingActivities: (params) => ['crm', 'marketing-activities', params],
};

export function useCrmBdmOwners(enabled = true) {
  return useQuery({
    queryKey: Q.bdmOwners,
    queryFn: async () => (await api.get('/api/crm/bdm-owners')).data,
    enabled,
  });
}

export function useCrmDashboard(params = {}) {
  return useQuery({
    queryKey: Q.dashboard(params),
    queryFn: async () => (await api.get('/api/crm/dashboard', { params })).data,
  });
}

export function useCrmSupportCoordinators(params = {}) {
  return useQuery({
    queryKey: Q.supportCoordinators(params),
    queryFn: async () =>
      (await api.get('/api/crm/support-coordinators', { params })).data,
  });
}

export function useCreateCrmSupportCoordinator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      (await api.post('/api/crm/support-coordinators', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'support-coordinators'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useUpdateCrmSupportCoordinator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.put(`/api/crm/support-coordinators/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'support-coordinators'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useDeleteCrmSupportCoordinator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) =>
      (await api.delete(`/api/crm/support-coordinators/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'support-coordinators'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useCrmLeads(params = {}) {
  return useQuery({
    queryKey: Q.leads(params),
    queryFn: async () => (await api.get('/api/crm/leads', { params })).data,
  });
}

export function useCreateCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/crm/leads', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useUpdateCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.put(`/api/crm/leads/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useDeleteCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/api/crm/leads/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useCrmMarketingActivities(params = {}) {
  return useQuery({
    queryKey: Q.marketingActivities(params),
    queryFn: async () =>
      (await api.get('/api/crm/marketing-activities', { params })).data,
  });
}

export function useCreateCrmMarketingActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      (await api.post('/api/crm/marketing-activities', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'marketing-activities'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useUpdateCrmMarketingActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.put(`/api/crm/marketing-activities/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'marketing-activities'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useDeleteCrmMarketingActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) =>
      (await api.delete(`/api/crm/marketing-activities/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'marketing-activities'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    },
  });
}

export function useCrmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return (
        await api.post('/api/crm/import', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
      qc.invalidateQueries({ queryKey: ['hr-requirements'] });
    },
  });
}

export async function exportCrmWorkbook(params = {}) {
  await downloadBlobGet('/api/crm/export', params, 'bdm-master-tracker.xlsx');
}

export async function fetchCrmNextId(entity) {
  const res = await api.get(`/api/crm/next-id/${entity}`);
  return res.data;
}
