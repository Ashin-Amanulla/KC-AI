/**
 * Role-based access control permissions.
 * Defines which roles can access which routes/features.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  FINANCE: 'finance',
  VIEWER: 'viewer',
};

/**
 * Route permissions: route path pattern -> allowed roles
 */
export const ROUTE_PERMISSIONS = {
  // ShiftCare proxy - read-only shifts, staff, clients
  shifts: [ROLES.SUPER_ADMIN, ROLES.VIEWER],
  staff: [ROLES.SUPER_ADMIN, ROLES.VIEWER],
  clients: [ROLES.SUPER_ADMIN, ROLES.VIEWER],
  // Timesheets and CSV analysis
  timesheets: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  'analyze-shift-report': [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  // User management - super admin only
  users: [ROLES.SUPER_ADMIN],
};

/**
 * Check if a role has access to a given route/resource
 * @param {string} role - User role
 * @param {string} resource - Resource/route key (e.g. 'shifts', 'users')
 * @returns {boolean}
 */
export const canAccess = (role, resource) => {
  const allowed = ROUTE_PERMISSIONS[resource];
  if (!allowed) return false;
  return allowed.includes(role);
};
