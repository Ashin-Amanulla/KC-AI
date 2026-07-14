import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Role } from '../modules/role/role.model.js';
import { roleHasAnyPermission } from '../config/permissionCatalog.js';
import { getOrSet } from '../utils/cache.js';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../helpers/errors.js';

const ROLE_CACHE_TTL_SECONDS = 60;

function roleCacheKey(slug) {
  return `role:slug:${slug}`;
}

async function fetchActiveRole(slug) {
  return getOrSet(roleCacheKey(slug), ROLE_CACHE_TTL_SECONDS, async () =>
    Role.findOne({ slug, isActive: true }).lean()
  );
}

/**
 * Middleware to get ShiftCare API credentials from environment variables
 */
export const getShiftCareCredentials = (req) => {
  if (config.shiftcare.accountId && config.shiftcare.apiKey) {
    return {
      accountId: config.shiftcare.accountId,
      apiKey: config.shiftcare.apiKey,
    };
  }

  return null;
};

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Authentication required. Please provide a valid token.'));
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      next();
    } catch {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if ShiftCare API credentials are available
 * This is used for ShiftCare API proxy routes
 */
export const requireAuth = (req, res, next) => {
  authenticateJWT(req, res, (err) => {
    if (err) return next(err);

    const credentials = getShiftCareCredentials(req);

    if (!credentials || !credentials.accountId || !credentials.apiKey) {
      return next(
        new UnauthorizedError(
          'ShiftCare API credentials not configured. Please configure environment variables.'
        )
      );
    }

    req.shiftcareCredentials = credentials;
    next();
  });
};

/**
 * RBAC: Allow only specified roles to access the route (legacy)
 * @deprecated Use authorizePermission
 */
export const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Forbidden: insufficient permissions'));
    }
    next();
  };

/**
 * RBAC: user must have at least one of the required permissions (from Role document).
 * Must be used after authenticateJWT (or requireAuth for ShiftCare routes).
 */
export const authorizePermission =
  (...requiredPermissions) =>
  async (req, res, next) => {
    try {
      if (!req.user?.role) {
        return next(new ForbiddenError('Forbidden: insufficient permissions'));
      }

      const roleDoc = await fetchActiveRole(req.user.role);
      if (!roleHasAnyPermission(roleDoc, requiredPermissions)) {
        return next(new ForbiddenError('Forbidden: insufficient permissions'));
      }

      req.rolePermissions = roleDoc?.permissions ?? [];
      next();
    } catch (error) {
      next(error);
    }
  };

export const loadRolePermissions = async (roleSlug) => {
  const roleDoc = await fetchActiveRole(roleSlug);
  return roleDoc?.permissions ?? [];
};
