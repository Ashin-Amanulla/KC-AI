import { useMemo } from 'react';
import { useAuthStore } from '../store/auth';
import {
  hasPermission as checkPermission,
  hasAnyPermission,
  canAccessPath as checkPath,
  getDefaultLanding,
  PERMISSIONS,
} from '../config/permissions';

export const usePermissions = () => {
  const user = useAuthStore((s) => s.user);
  const permissions = user?.permissions ?? [];

  return useMemo(
    () => ({
      permissions,
      hasPermission: (key) => checkPermission(permissions, key),
      hasAnyPermission: (keys) => hasAnyPermission(permissions, keys),
      canAccessPath: (path) => checkPath(permissions, path),
      defaultLanding: getDefaultLanding(permissions),
      canManageUsers: checkPermission(permissions, PERMISSIONS.USERS_MANAGE),
      canManageRoles: checkPermission(permissions, PERMISSIONS.ROLES_MANAGE),
    }),
    [permissions]
  );
};
