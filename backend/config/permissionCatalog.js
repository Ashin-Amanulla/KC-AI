/**
 * Single source of truth for RBAC permission keys.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  STAFF_VIEW: 'staff:view',
  CLIENTS_VIEW: 'clients:view',
  TIMESHEETS_VIEW: 'timesheets:view',
  WORKFORCE_VIEW: 'workforce:view',
  WORKFORCE_COST_VIEW: 'workforce:cost:view',
  PAY_HOURS_TESTS_VIEW: 'pay_hours_tests:view',
  RULE_ENGINE_VIEW: 'rule_engine:view',
  RULE_ENGINE_MANAGE: 'rule_engine:manage',
  SHIFT_ANALYSIS_VIEW: 'shift_analysis:view',
  FORECAST_ANALYSIS_VIEW: 'forecast_analysis:view',
  ROSTER_VIEW: 'roster:view',
  ROSTER_SHIFT_LOG_VIEW: 'roster_shift_log:view',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  CRM_VIEW: 'crm:view',
  CRM_MANAGE: 'crm:manage',
  CRM_VIEW_ALL: 'crm:view_all',
  CIR_VIEW: 'cir:view',
  CIR_MANAGE: 'cir:manage',
  ESTIMATES_VIEW: 'estimates:view',
  ESTIMATES_MANAGE: 'estimates:manage',
  CUSTOM_MODULES_VIEW: 'custom_modules:view',
  CUSTOM_MODULES_MANAGE: 'custom_modules:manage',
};

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

export const PERMISSION_CATALOG = [
  {
    key: PERMISSIONS.DASHBOARD_VIEW,
    label: 'Dashboard',
    description: 'See the home dashboard after signing in.',
    category: 'Home & directory',
    accessLevel: 'view',
    path: '/',
  },
  {
    key: PERMISSIONS.STAFF_VIEW,
    label: 'Staff directory',
    description: 'View the list of staff members.',
    category: 'Home & directory',
    accessLevel: 'view',
    path: '/staff',
  },
  {
    key: PERMISSIONS.CLIENTS_VIEW,
    label: 'Clients',
    description: 'View participant and client records.',
    category: 'Home & directory',
    accessLevel: 'view',
    path: '/clients',
  },
  {
    key: PERMISSIONS.TIMESHEETS_VIEW,
    label: 'Timesheets',
    description: 'View and work with timesheet data.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/timesheets',
  },
  {
    key: PERMISSIONS.WORKFORCE_VIEW,
    label: 'Workforce calculator',
    description: 'Access workforce setup, roster import, and the SCHADS pay calculator.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/workforce',
  },
  {
    key: PERMISSIONS.WORKFORCE_COST_VIEW,
    label: 'Billing & cost analysis',
    description: 'View billing rates and cost breakdown (requires Workforce calculator access too).',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/workforce?step=cost',
  },
  {
    key: PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    label: 'Pay hours tests',
    description: 'Run pay-hours test scenarios (mainly for finance/admin testing).',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/pay-hours-tests',
  },
  {
    key: PERMISSIONS.RULE_ENGINE_VIEW,
    label: 'Rule engine',
    description: 'View SCHADS rules reference, award rates, and the pay-engine test monitor.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/rule-engine',
  },
  {
    key: PERMISSIONS.RULE_ENGINE_MANAGE,
    label: 'Manage award rates',
    description: 'Edit effective-dated SCHADS award rate sets and rule verification status.',
    category: 'Payroll & finance',
    accessLevel: 'edit',
    path: '/rule-engine/rates',
  },
  {
    key: PERMISSIONS.SHIFT_ANALYSIS_VIEW,
    label: 'Shift analysis',
    description: 'Analyse shift patterns and hours.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/shift-analysis',
  },
  {
    key: PERMISSIONS.FORECAST_ANALYSIS_VIEW,
    label: 'Forecast analysis',
    description: 'Compare forecasts vs actuals and standard forecasts.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/forecast-analysis',
  },
  {
    key: PERMISSIONS.ROSTER_VIEW,
    label: 'Roster coverage (full)',
    description: 'Full roster coverage tools — participants, team, timesheets, reports, and shift log.',
    category: 'Roster & shifts',
    accessLevel: 'view',
    path: '/roster-coverage',
  },
  {
    key: PERMISSIONS.ROSTER_SHIFT_LOG_VIEW,
    label: 'Shift log only',
    description: 'Limited access — vacant shift log and find-cover only (not the full roster area).',
    category: 'Roster & shifts',
    accessLevel: 'view',
    path: '/roster-coverage/shift-log',
  },
  {
    key: PERMISSIONS.CRM_VIEW,
    label: 'CRM & HR requirements',
    description: 'View the BDM tracker — leads, support coordinators, marketing, and HR staffing requirements.',
    category: 'Sales & CRM',
    accessLevel: 'view',
    path: '/crm',
    areas: ['CRM', 'HR requirements'],
  },
  {
    key: PERMISSIONS.CRM_MANAGE,
    label: 'Edit CRM records',
    description: 'Add, edit, delete, and import CRM / HR requirement rows.',
    category: 'Sales & CRM',
    accessLevel: 'edit',
    path: '/crm',
  },
  {
    key: PERMISSIONS.CRM_VIEW_ALL,
    label: 'See all BDM lists',
    description: 'Admin view — switch between every BDM’s CRM list using the BDM dropdown (not just your own).',
    category: 'Sales & CRM',
    accessLevel: 'admin',
    path: '/crm',
  },
  {
    key: PERMISSIONS.CIR_VIEW,
    label: 'Continuous Improvement Register',
    description: 'View the organisation-wide improvement register.',
    category: 'Quality',
    accessLevel: 'view',
    path: '/continuous-improvement',
  },
  {
    key: PERMISSIONS.CIR_MANAGE,
    label: 'Edit improvement register',
    description: 'Add and update CIR records and post action updates.',
    category: 'Quality',
    accessLevel: 'edit',
    path: '/continuous-improvement',
  },
  {
    key: PERMISSIONS.ESTIMATES_VIEW,
    label: 'SIL estimates',
    description: 'View NDIS SIL cost estimates and roster templates.',
    category: 'Payroll & finance',
    accessLevel: 'view',
    path: '/sil-estimates',
  },
  {
    key: PERMISSIONS.ESTIMATES_MANAGE,
    label: 'Manage SIL estimates',
    description: 'Create, edit, and delete SIL cost estimate workspaces.',
    category: 'Payroll & finance',
    accessLevel: 'edit',
    path: '/sil-estimates',
  },
  {
    key: PERMISSIONS.CUSTOM_MODULES_VIEW,
    label: 'Custom modules',
    description: 'Open custom tools and modules added to the sidebar.',
    category: 'Administration',
    accessLevel: 'view',
    path: '/modules',
  },
  {
    key: PERMISSIONS.CUSTOM_MODULES_MANAGE,
    label: 'Manage custom modules',
    description: 'Upload, publish, and remove custom JSX tool modules.',
    category: 'Administration',
    accessLevel: 'admin',
    path: '/admin/custom-modules',
  },
  {
    key: PERMISSIONS.USERS_MANAGE,
    label: 'Manage users',
    description: 'Create, edit, and deactivate user accounts.',
    category: 'Administration',
    accessLevel: 'admin',
    path: '/admin/access',
  },
  {
    key: PERMISSIONS.ROLES_MANAGE,
    label: 'Manage roles & permissions',
    description: 'Create roles and choose which features each role can access.',
    category: 'Administration',
    accessLevel: 'admin',
    path: '/admin/access',
  },
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
  { prefix: '/rule-engine', permission: PERMISSIONS.RULE_ENGINE_VIEW },
  { prefix: '/workforce', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/shifts', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/pay-hours', permission: PERMISSIONS.WORKFORCE_VIEW },
  { prefix: '/cost-analysis', permission: PERMISSIONS.WORKFORCE_COST_VIEW },
  { prefix: '/timesheets', permission: PERMISSIONS.TIMESHEETS_VIEW },
  { prefix: '/clients', permission: PERMISSIONS.CLIENTS_VIEW },
  { prefix: '/staff', permission: PERMISSIONS.STAFF_VIEW },
  { prefix: '/crm', permission: PERMISSIONS.CRM_VIEW },
  { prefix: '/hr-requirements', permission: PERMISSIONS.CRM_VIEW },
  { prefix: '/continuous-improvement', permission: PERMISSIONS.CIR_VIEW },
  { prefix: '/sil-estimates', permission: PERMISSIONS.ESTIMATES_VIEW },
  { prefix: '/', permission: PERMISSIONS.DASHBOARD_VIEW },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: [...ALL_PERMISSION_KEYS],
  finance: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TIMESHEETS_VIEW,
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    PERMISSIONS.RULE_ENGINE_VIEW,
    PERMISSIONS.RULE_ENGINE_MANAGE,
    PERMISSIONS.SHIFT_ANALYSIS_VIEW,
    PERMISSIONS.FORECAST_ANALYSIS_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.CIR_VIEW,
    PERMISSIONS.CIR_MANAGE,
    PERMISSIONS.ESTIMATES_VIEW,
    PERMISSIONS.ESTIMATES_MANAGE,
    PERMISSIONS.CUSTOM_MODULES_VIEW,
    PERMISSIONS.CUSTOM_MODULES_MANAGE,
  ],
  viewer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.CRM_VIEW,
    PERMISSIONS.CIR_VIEW,
    PERMISSIONS.CIR_MANAGE,
    PERMISSIONS.CUSTOM_MODULES_VIEW,
  ],
  shifts_viewer: [PERMISSIONS.ROSTER_SHIFT_LOG_VIEW, PERMISSIONS.CIR_VIEW, PERMISSIONS.CIR_MANAGE],
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

  if (path === '/cost-analysis') {
    return has(PERMISSIONS.WORKFORCE_VIEW) && has(PERMISSIONS.WORKFORCE_COST_VIEW);
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
