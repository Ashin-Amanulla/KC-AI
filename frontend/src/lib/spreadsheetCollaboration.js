import { API_BASE_URL } from '../utils/api';

export function getSpreadsheetWsUrl() {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  const base = API_BASE_URL.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/spreadsheet?token=${encodeURIComponent(token)}`;
}

export const SPREADSHEET_ROOMS = {
  supportCoordinators: 'crm:support-coordinators',
  leads: 'crm:leads',
  marketing: 'crm:marketing',
  hrRequirements: 'hr:requirements',
};
