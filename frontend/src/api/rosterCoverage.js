import { useSyncExternalStore } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import {
  getRosterPayPeriodSnapshot,
  getRosterTimesheetWindow,
  setRosterTimesheetWindow,
  subscribeRosterPayPeriod,
} from '../utils/rosterCoveragePayPeriod';

const Q = {
  dashboard: ['roster-coverage', 'dashboard'],
  shiftDashboard: ['roster-coverage', 'shift-dashboard'],
  staff: ['roster-coverage', 'staff'],
  participants: ['roster-coverage', 'participants'],
  workedShifts: (params) => ['roster-coverage', 'worked-shifts', params],
  vacant: (status) => ['roster-coverage', 'vacant', status],
  audit: ['roster-coverage', 'audit'],
  profile: (id) => ['roster-coverage', 'profile', id],
};

export function useRosterPayPeriodTag() {
  return useSyncExternalStore(subscribeRosterPayPeriod, getRosterPayPeriodSnapshot, getRosterPayPeriodSnapshot);
}

export function useRosterDashboard() {
  return useQuery({
    queryKey: Q.dashboard,
    queryFn: async () => (await api.get('/api/roster-coverage/dashboard')).data,
  });
}

export function useRosterStaffList() {
  const payTag = useRosterPayPeriodTag();
  return useQuery({
    queryKey: [...Q.staff, payTag],
    queryFn: async () => {
      const w = getRosterTimesheetWindow();
      const params =
        w?.start && w?.end ? { timesheetFrom: w.start, timesheetTo: w.end } : {};
      return (await api.get('/api/roster-coverage/staff', { params })).data;
    },
  });
}

export function useRosterParticipants() {
  return useQuery({
    queryKey: Q.participants,
    queryFn: async () => (await api.get('/api/roster-coverage/participants')).data,
  });
}

export function useRosterWorkedShifts(params = {}) {
  return useQuery({
    queryKey: Q.workedShifts(params),
    queryFn: async () => (await api.get('/api/roster-coverage/worked-shifts', { params })).data,
  });
}

export function useRosterVacantShifts(status = 'open') {
  return useQuery({
    queryKey: Q.vacant(status),
    queryFn: async () =>
      (await api.get('/api/roster-coverage/vacant-shifts', { params: { status } })).data,
  });
}

export function useRosterAudit(limit = 50) {
  return useQuery({
    queryKey: [...Q.audit, limit],
    queryFn: async () =>
      (await api.get('/api/roster-coverage/audit', { params: { limit } })).data,
  });
}

export function useRosterStaffProfile(staffId) {
  const payTag = useRosterPayPeriodTag();
  return useQuery({
    queryKey: [...Q.profile(staffId), payTag],
    queryFn: async () => {
      const w = getRosterTimesheetWindow();
      const params =
        w?.start && w?.end ? { timesheetFrom: w.start, timesheetTo: w.end } : {};
      return (await api.get(`/api/roster-coverage/staff/${staffId}/profile`, { params })).data;
    },
    enabled: !!staffId,
  });
}

export function useCreateRosterStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/roster-coverage/staff', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.staff }),
  });
}

export function usePatchRosterStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => (await api.patch(`/api/roster-coverage/staff/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.staff });
      qc.invalidateQueries({ queryKey: ['roster-coverage', 'profile'] });
    },
  });
}

export function useDeleteRosterStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/api/roster-coverage/staff/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.staff }),
  });
}

export function useCreateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/roster-coverage/participants', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.participants }),
  });
}

export function usePatchParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.patch(`/api/roster-coverage/participants/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.participants }),
  });
}

export function useDeleteParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/api/roster-coverage/participants/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.participants }),
  });
}

export function useCreateWorkedShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/roster-coverage/worked-shifts', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster-coverage', 'worked-shifts'] }),
  });
}

export function useFindCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/roster-coverage/find-cover', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.vacant('open') });
      qc.invalidateQueries({ queryKey: Q.dashboard });
      qc.invalidateQueries({ queryKey: Q.audit });
    },
  });
}

export function useUploadRosterTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file }) => {
      const fd = new FormData();
      fd.append('file', file);
      return (
        await api.post('/api/roster-coverage/timesheet-upload', fd, {
          transformRequest: (data, headers) => {
            delete headers['Content-Type'];
            return data;
          },
        })
      ).data;
    },
    onSuccess: (data) => {
      if (data.timesheetSpan?.start && data.timesheetSpan?.end) {
        setRosterTimesheetWindow({ start: data.timesheetSpan.start, end: data.timesheetSpan.end });
      } else {
        setRosterTimesheetWindow(null);
      }
      qc.invalidateQueries({ queryKey: ['roster-coverage'] });
    },
  });
}

export async function downloadIneligibilityPdf(rows, title) {
  const res = await api.post(
    '/api/roster-coverage/export/ineligibility-pdf',
    { rows, title },
    { responseType: 'blob' }
  );
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ineligibility.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadIneligibilityXlsx(rows) {
  const res = await api.post(
    '/api/roster-coverage/export/ineligibility-xlsx',
    { rows },
    { responseType: 'blob' }
  );
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ineligibility.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export function usePatchContactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vacantId, staffId, ...body }) =>
      (
        await api.patch(
          `/api/roster-coverage/vacant-shifts/${vacantId}/contact/${staffId}`,
          body
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.audit }),
  });
}

export function useShiftDashboard(refetchInterval = 15000) {
  return useQuery({
    queryKey: Q.shiftDashboard,
    queryFn: async () => (await api.get('/api/roster-coverage/shift-dashboard')).data,
    refetchInterval,
  });
}

export function useCreateVacantShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/api/roster-coverage/vacant-shifts', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.shiftDashboard });
      qc.invalidateQueries({ queryKey: Q.dashboard });
    },
  });
}

export function usePatchVacantShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.patch(`/api/roster-coverage/vacant-shifts/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.shiftDashboard });
      qc.invalidateQueries({ queryKey: Q.dashboard });
    },
  });
}

export function useAddVacantShiftUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (await api.post(`/api/roster-coverage/vacant-shifts/${id}/updates`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: Q.shiftDashboard }),
  });
}
