/**
 * Navigation config with role-based visibility.
 * Matches backend permissions: super_admin, finance, viewer
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  FINANCE: 'finance',
  VIEWER: 'viewer',
  SHIFTS_VIEWER: 'shifts_viewer',
};

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard', roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.VIEWER] },
  { path: '/staff', label: 'Staff', icon: 'Users', roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] },
  { path: '/clients', label: 'Clients', icon: 'UserCheck', roles: [ROLES.SUPER_ADMIN, ROLES.VIEWER] },
  { path: '/timesheets', label: 'Timesheets', icon: 'Clock', roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE] },
  { path: '/workforce', label: 'Workforce', icon: 'Layers', roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.SHIFTS_VIEWER] },
  { path: '/shift-analysis', label: 'Shift Analysis', icon: 'FileBarChart', roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE] },
  {
    path: '/forecast-actuals',
    label: 'Forecast vs actuals',
    icon: 'TrendingDown',
    roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  },
  { path: '/users', label: 'User Management', icon: 'Shield', roles: [ROLES.SUPER_ADMIN] },
];

export const getNavItemsForRole = (role) => {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
};

const WORKFORCE_LEGACY_PATHS = ['/shifts', '/pay-hours', '/cost-analysis'];

export const canAccessPath = (role, path) => {
  if (path === '/workforce' || WORKFORCE_LEGACY_PATHS.includes(path)) {
    const wf = NAV_ITEMS.find((i) => i.path === '/workforce');
    return wf ? wf.roles.includes(role) : false;
  }
  const item = NAV_ITEMS.find((i) => i.path === path);
  return item ? item.roles.includes(role) : false;
};
