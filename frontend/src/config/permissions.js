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

export const hasPermission = (permissions, key) => {
  if (!permissions?.length || !key) return false;
  return permissions.includes(key);
};

export const hasAnyPermission = (permissions, keys) => {
  if (!permissions?.length || !keys?.length) return false;
  return keys.some((k) => permissions.includes(k));
};

const WORKFORCE_LEGACY_PATHS = ['/shifts', '/pay-hours'];
const FORECAST_LEGACY_PATHS = ['/forecast-actuals', '/standard-forecast', '/standard-vs-forecast'];

export const canAccessPath = (permissions, path) => {
  if (!permissions?.length) return false;

  if (path === '/admin/access' || path === '/users') {
    return hasAnyPermission(permissions, [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE]);
  }

  if (permissions.includes(PERMISSIONS.ROSTER_VIEW)) {
    if (path.startsWith('/roster-coverage')) return true;
  } else if (permissions.includes(PERMISSIONS.ROSTER_SHIFT_LOG_VIEW)) {
    if (path === '/roster-coverage/shift-log' || path === '/roster-coverage/find-cover') return true;
    if (path.startsWith('/roster-coverage')) return false;
  }

  if (path === '/cost-analysis') {
    return (
      hasPermission(permissions, PERMISSIONS.WORKFORCE_VIEW) &&
      hasPermission(permissions, PERMISSIONS.WORKFORCE_COST_VIEW)
    );
  }
  if (path === '/workforce' || WORKFORCE_LEGACY_PATHS.includes(path)) {
    return hasPermission(permissions, PERMISSIONS.WORKFORCE_VIEW);
  }
  if (path === '/forecast-analysis' || FORECAST_LEGACY_PATHS.includes(path)) {
    return hasPermission(permissions, PERMISSIONS.FORECAST_ANALYSIS_VIEW);
  }
  if (path === '/') return hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW);
  if (path === '/staff') return hasPermission(permissions, PERMISSIONS.STAFF_VIEW);
  if (path === '/clients') return hasPermission(permissions, PERMISSIONS.CLIENTS_VIEW);
  if (path === '/timesheets') return hasPermission(permissions, PERMISSIONS.TIMESHEETS_VIEW);
  if (path === '/pay-hours-tests') {
    return hasAnyPermission(permissions, [
      PERMISSIONS.PAY_HOURS_TESTS_VIEW,
      PERMISSIONS.RULE_ENGINE_VIEW,
    ]);
  }
  if (path.startsWith('/rule-engine')) {
    return hasAnyPermission(permissions, [
      PERMISSIONS.RULE_ENGINE_VIEW,
      PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    ]);
  }
  if (path === '/shift-analysis') return hasPermission(permissions, PERMISSIONS.SHIFT_ANALYSIS_VIEW);
  if (path === '/progress-notes') return hasPermission(permissions, PERMISSIONS.SHIFT_ANALYSIS_VIEW);
  if (path === '/client-funds') return hasPermission(permissions, PERMISSIONS.CLIENTS_VIEW);
  if (path === '/compliance') return hasPermission(permissions, PERMISSIONS.STAFF_VIEW);
  if (path === '/shiftcare-invoices') return hasPermission(permissions, PERMISSIONS.FORECAST_ANALYSIS_VIEW);
  if (path === '/admin/webhooks') return hasPermission(permissions, PERMISSIONS.USERS_MANAGE);
  if (path.startsWith('/crm')) return hasPermission(permissions, PERMISSIONS.CRM_VIEW);
  if (path.startsWith('/hr-requirements')) return hasPermission(permissions, PERMISSIONS.CRM_VIEW);
  if (path.startsWith('/continuous-improvement')) return hasPermission(permissions, PERMISSIONS.CIR_VIEW);
  if (path === '/sil-estimates' || path.startsWith('/sil-estimates/')) {
    return hasPermission(permissions, PERMISSIONS.ESTIMATES_VIEW);
  }
  if (path.startsWith('/m/')) return hasPermission(permissions, PERMISSIONS.CUSTOM_MODULES_VIEW);
  if (path === '/admin/custom-modules') {
    return hasPermission(permissions, PERMISSIONS.CUSTOM_MODULES_MANAGE);
  }

  return false;
};

export const getDefaultLanding = (permissions = []) => {
  if (hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW)) return '/';
  if (hasPermission(permissions, PERMISSIONS.TIMESHEETS_VIEW)) return '/timesheets';
  if (hasPermission(permissions, PERMISSIONS.ROSTER_SHIFT_LOG_VIEW)) return '/roster-coverage/shift-log';
  if (hasPermission(permissions, PERMISSIONS.ROSTER_VIEW)) return '/roster-coverage/shift-log';
  if (hasPermission(permissions, PERMISSIONS.WORKFORCE_VIEW)) return '/workforce';
  return '/';
};
