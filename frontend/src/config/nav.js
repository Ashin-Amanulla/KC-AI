/**
 * Navigation config with permission-based visibility.
 */
import { PERMISSIONS } from './permissions';

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  { path: '/staff', label: 'Staff', icon: 'Users', permission: PERMISSIONS.STAFF_VIEW },
  { path: '/clients', label: 'Clients', icon: 'UserCheck', permission: PERMISSIONS.CLIENTS_VIEW },
  { path: '/timesheets', label: 'Timesheets', icon: 'Clock', permission: PERMISSIONS.TIMESHEETS_VIEW },
  { path: '/workforce', label: 'Workforce', icon: 'Layers', permission: PERMISSIONS.WORKFORCE_VIEW },
  {
    path: '/pay-hours-tests',
    label: 'Pay Hours Tests',
    icon: 'Calculator',
    permission: PERMISSIONS.PAY_HOURS_TESTS_VIEW,
  },
  {
    path: '/shift-analysis',
    label: 'Shift Analysis',
    icon: 'FileBarChart',
    permission: PERMISSIONS.SHIFT_ANALYSIS_VIEW,
  },
  {
    path: '/forecast-analysis',
    label: 'Forecast analysis',
    icon: 'TrendingDown',
    permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW,
  },
  {
    path: '/roster-coverage',
    label: 'Roster coverage',
    icon: 'CalendarDays',
    permission: PERMISSIONS.ROSTER_VIEW,
  },
  {
    path: '/crm',
    label: 'CRM',
    icon: 'Briefcase',
    permission: PERMISSIONS.CRM_VIEW,
  },
  {
    path: '/hr-requirements',
    label: 'HR requirements',
    icon: 'ClipboardList',
    permission: PERMISSIONS.CRM_VIEW,
  },
  {
    path: '/roster-coverage/shift-log',
    label: 'Shift log',
    icon: 'CalendarDays',
    permission: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW,
    hideIfHas: PERMISSIONS.ROSTER_VIEW,
  },
  {
    path: '/admin/access',
    label: 'Access management',
    icon: 'Shield',
    anyOf: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE],
  },
];

export { getDefaultLanding, canAccessPath, hasPermission, hasAnyPermission } from './permissions';

export const getNavItemsForPermissions = (permissions = []) => {
  if (!permissions?.length) return [];

  const has = (key) => permissions.includes(key);
  const hasAny = (keys) => keys.some((k) => permissions.includes(k));

  return NAV_ITEMS.filter((item) => {
    if (item.hideIfHas && has(item.hideIfHas)) return false;
    if (item.anyOf) return hasAny(item.anyOf);
    return has(item.permission);
  });
};

/** @deprecated use getNavItemsForPermissions */
export const getNavItemsForRole = (role, user) => {
  const permissions = user?.permissions ?? [];
  return getNavItemsForPermissions(permissions.length ? permissions : []);
};
