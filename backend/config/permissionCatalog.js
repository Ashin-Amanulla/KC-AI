/**
 * Single source of truth for RBAC permission keys.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  STAFF_VIEW: 'staff:view',
  CLIENTS_VIEW: 'clients:view',
  TIMESHEETS_VIEW: 'timesheets:view',
  WORKFORCE_VIEW: 'workforce:view',
  PAY_HOURS_TESTS_VIEW: 'pay_hours_tests:view',
  SHIFT_ANALYSIS_VIEW: 'shift_analysis:view',
  FORECAST_ANALYSIS_VIEW: 'forecast_analysis:view',
  ROSTER_VIEW: 'roster:view',
  ROSTER_SHIFT_LOG_VIEW: 'roster_shift_log:view',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  CRM_VIEW: 'crm:view',
  CRM_MANAGE: 'crm:manage',
};

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

export const PERMISSION_CATALOG = [
  { key: PERMISSIONS.DASHBOARD_VIEW, label: 'Dashboard', category: 'General', path: '/' },
  { key: PERMISSIONS.STAFF_VIEW, label: 'Staff', category: 'General', path: '/staff' },
  { key: PERMISSIONS.CLIENTS_VIEW, label: 'Clients', category: 'General', path: '/clients' },
  { key: PERMISSIONS.TIMESHEETS_VIEW, label: 'Timesheets', category: 'Finance', path: '/timesheets' },
  { key: PERMISSIONS.WORKFORCE_VIEW, label: 'Workforce', category: 'Finance', path: '/workforce' },
  {
    key: PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    label: 'Pay Hours Tests',
    category: 'Finance',
    path: '/pay-hours-tests',
  },
  {
    key: PERMISSIONS.SHIFT_ANALYSIS_VIEW,
    label: 'Shift Analysis',
    category: 'Finance',
    path: '/shift-analysis',
  },
  {
    key: PERMISSIONS.FORECAST_ANALYSIS_VIEW,
    label: 'Forecast Analysis',
    category: 'Finance',
    path: '/forecast-analysis',
  },
  { key: PERMISSIONS.ROSTER_VIEW, label: 'Roster Coverage (full)', category: 'Roster', path: '/roster-coverage' },
  {
    key: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW,
    label: 'Roster Shift Log (limited)',
    category: 'Roster',
    path: '/roster-coverage/shift-log',
  },
  { key: PERMISSIONS.USERS_MANAGE, label: 'Manage Users', category: 'Admin', path: '/admin/access' },
  { key: PERMISSIONS.ROLES_MANAGE, label: 'Manage Roles', category: 'Admin', path: '/admin/access' },
  { key: PERMISSIONS.CRM_VIEW, label: 'CRM', category: 'CRM', path: '/crm' },
  { key: PERMISSIONS.CRM_MANAGE, label: 'Manage CRM', category: 'CRM', path: '/crm' },
];

/** Path -> permission required (first match wins for specialized paths) */
export const PATH_PERMISSION_MAP = [
  { prefix: '/admin/access', permission: null, anyOf: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE] },
  { prefix: '/roster-coverage/shift-log', permission: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW },
  { prefix: '/roster-coverage/find-cover', permission: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW },
  { prefix: '/roster-coverage', permission: PERMISSIONS.ROSTER_VIEW },
  { prefix: '/forecast-analysis', permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW },
  { prefix: '/forecast-actuals', permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW },
  { prefix: '/standard-forecast', permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW },
  { prefix: '/standard-vs-forecast', permission: PERMISSIONS.FORECAST_ANALYSIS_VIEW },
  { prefix: '/shift-analysis', permission: PERMISSIONS.SHIFT_ANALYSIS_VIEW },
  { prefix: '/pay-hours-tests', permission: PERMISSIONS.PAY_HOURS_TESTS_VIEW },
  { prefix: '/workforce', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/shifts', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/pay-hours', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/cost-analysis', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/timesheets', permission: PERMISSIONS.TIMESHEETS_VIEW },
  { prefix: '/clients', permission: PERMISSIONS.CLIENTS_VIEW },
  { prefix: '/staff', permission: PERMISSIONS.STAFF_VIEW },
  { prefix: '/crm', permission: PERMISSIONS.CRM_VIEW },
  { prefix: '/', permission: PERMISSIONS.DASHBOARD_VIEW },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: [...ALL_PERMISSION_KEYS],
  finance: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TIMESHEETS_VIEW,
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    PERMISSIONS.SHIFT_ANALYSIS_VIEW,
    PERMISSIONS.FORECAST_ANALYSIS_VIEW,
    PERMISSIONS.ROSTER_VIEW,
  ],
  viewer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.CRM_VIEW,
  ],
  shifts_viewer: [PERMISSIONS.ROSTER_SHIFT_LOG_VIEW],
};

export const DEFAULT_ROLES = [
  {
    slug: 'super_admin',
    name: 'Super Admin',
    description: 'Full system access including user and role management',
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
  },
  {
    slug: 'finance',
    name: 'Finance',
    description: 'Timesheets, workforce, forecasting, and roster management',
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.finance,
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to staff, clients, and roster',
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.viewer,
  },
  {
    slug: 'shifts_viewer',
    name: 'Shifts Viewer',
    description: 'Limited roster shift log and find-cover access',
    isSystem: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.shifts_viewer,
  },
];

export const ADMIN_PERMISSIONS = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE];

export const roleHasPermission = (roleDoc, permissionKey) => {
  if (!roleDoc?.permissions) return false;
  return roleDoc.permissions.includes(permissionKey);
};

export const roleHasAnyPermission = (roleDoc, permissionKeys) => {
  if (!roleDoc?.permissions) return false;
  return permissionKeys.some((k) => roleDoc.permissions.includes(k));
};

export const getPermissionsForRoleSlug = async (slug, RoleModel) => {
  const role = await RoleModel.findOne({ slug, isActive: true }).lean();
  return role?.permissions ?? [];
};

export const getDefaultLanding = (permissions = []) => {
  if (permissions.includes(PERMISSIONS.DASHBOARD_VIEW)) return '/';
  if (permissions.includes(PERMISSIONS.TIMESHEETS_VIEW)) return '/timesheets';
  if (permissions.includes(PERMISSIONS.ROSTER_SHIFT_LOG_VIEW)) return '/roster-coverage/shift-log';
  if (permissions.includes(PERMISSIONS.ROSTER_VIEW)) return '/roster-coverage';
  if (permissions.includes(PERMISSIONS.WORKFORCE_VIEW)) return '/workforce';
  return '/';
};

export const canAccessPathWithPermissions = (permissions, path) => {
  if (!permissions?.length) return false;

  const has = (key) => permissions.includes(key);
  const hasAny = (keys) => keys.some((k) => permissions.includes(k));

  if (path === '/admin/access' || path === '/users') {
    return hasAny([PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE]);
  }

  if (permissions.includes(PERMISSIONS.ROSTER_VIEW)) {
    if (path.startsWith('/roster-coverage')) return true;
  } else if (permissions.includes(PERMISSIONS.ROSTER_SHIFT_LOG_VIEW)) {
    if (path === '/roster-coverage/shift-log' || path === '/roster-coverage/find-cover') return true;
    if (path.startsWith('/roster-coverage')) return false;
  }

  for (const entry of PATH_PERMISSION_MAP) {
    if (entry.anyOf) continue;
    if (entry.prefix === '/' && path === '/') {
      return has(entry.permission);
    }
    if (entry.prefix !== '/' && path.startsWith(entry.prefix)) {
      return has(entry.permission);
    }
  }

  return false;
};
