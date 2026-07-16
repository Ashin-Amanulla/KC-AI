/**
 * Navigation config with permission-based visibility.
 * Items are organised into collapsible sidebar groups; visibility rules per
 * item: `permission` (single), `anyOf` (any of several), `hideIfHas` (hidden
 * when the user holds a broader permission).
 */
import { PERMISSIONS } from './permissions';

export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: 'LayoutDashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { path: '/timesheets', label: 'Timesheets', icon: 'Clock', permission: PERMISSIONS.TIMESHEETS_VIEW },
      {
        path: '/roster-coverage',
        label: 'Roster coverage',
        icon: 'CalendarDays',
        permission: PERMISSIONS.ROSTER_VIEW,
      },
      {
        path: '/roster-coverage/shift-log',
        label: 'Shift log',
        icon: 'CalendarDays',
        permission: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW,
        hideIfHas: PERMISSIONS.ROSTER_VIEW,
      },
      {
        path: '/progress-notes',
        label: 'Progress notes',
        icon: 'FileText',
        permission: PERMISSIONS.SHIFT_ANALYSIS_VIEW,
      },
      {
        path: '/client-funds',
        label: 'Client funds',
        icon: 'Wallet',
        permission: PERMISSIONS.CLIENTS_VIEW,
      },
      {
        path: '/compliance',
        label: 'Compliance',
        icon: 'ShieldAlert',
        permission: PERMISSIONS.STAFF_VIEW,
      },
      {
        path: '/shift-analysis',
        label: 'Shift Analysis',
        icon: 'FileBarChart',
        permission: PERMISSIONS.SHIFT_ANALYSIS_VIEW,
      },
    ],
  },
  {
    id: 'workforce-pay',
    label: 'Workforce & Pay',
    items: [
      { path: '/staff', label: 'Staff', icon: 'Users', permission: PERMISSIONS.STAFF_VIEW },
      { path: '/clients', label: 'Clients', icon: 'UserCheck', permission: PERMISSIONS.CLIENTS_VIEW },
      { path: '/workforce', label: 'Workforce', icon: 'Layers', permission: PERMISSIONS.WORKFORCE_VIEW },
    ],
  },
  {
    id: 'rule-engine',
    label: 'Rule Engine',
    items: [
      {
        path: '/rule-engine',
        label: 'Rule Engine',
        icon: 'BookOpen',
        anyOf: [PERMISSIONS.RULE_ENGINE_VIEW, PERMISSIONS.PAY_HOURS_TESTS_VIEW],
      },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        path: '/forecast-analysis',
        label: 'Forecast analysis',
        icon: 'TrendingDown',
        permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW,
      },
      {
        path: '/shiftcare-invoices',
        label: 'Invoices',
        icon: 'Receipt',
        permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW,
      },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    items: [
      { path: '/crm', label: 'CRM', icon: 'Briefcase', permission: PERMISSIONS.CRM_VIEW },
      {
        path: '/hr-requirements',
        label: 'HR requirements',
        icon: 'ClipboardList',
        permission: PERMISSIONS.CRM_VIEW,
      },
      {
        path: '/continuous-improvement',
        label: 'Continuous Improvement',
        icon: 'ListChecks',
        permission: PERMISSIONS.CIR_VIEW,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      {
        path: '/admin/access',
        label: 'Access management',
        icon: 'Shield',
        anyOf: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE],
      },
      {
        path: '/admin/webhooks',
        label: 'Webhooks',
        icon: 'Webhook',
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ],
  },
];

/** Flat list preserved for legacy consumers. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export { getDefaultLanding, canAccessPath, hasPermission, hasAnyPermission } from './permissions';

const itemVisible = (item, permissions) => {
  const has = (key) => permissions.includes(key);
  if (item.hideIfHas && has(item.hideIfHas)) return false;
  if (item.anyOf) return item.anyOf.some(has);
  return has(item.permission);
};

export const getNavGroupsForPermissions = (permissions = []) => {
  if (!permissions?.length) return [];
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemVisible(item, permissions)),
  })).filter((group) => group.items.length > 0);
};

export const getNavItemsForPermissions = (permissions = []) => {
  if (!permissions?.length) return [];
  return NAV_ITEMS.filter((item) => itemVisible(item, permissions));
};

/** @deprecated use getNavItemsForPermissions */
export const getNavItemsForRole = (role, user) => {
  const permissions = user?.permissions ?? [];
  return getNavItemsForPermissions(permissions.length ? permissions : []);
};
