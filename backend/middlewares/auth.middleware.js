import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Middleware to get ShiftCare API credentials from environment variables
 */
export const getShiftCareCredentials = (req) => {
  // Use environment variables for ShiftCare API credentials
  if (config.shiftcare.accountId && config.shiftcare.apiKey) {
    return {
      accountId: config.shiftcare.accountId,  // Basic Auth username
      apiKey: config.shiftcare.apiKey,        // Basic Auth password
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
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid token.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired token',
      });
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
  // First verify JWT authentication
  authenticateJWT(req, res, () => {
    // Then check ShiftCare credentials
    const credentials = getShiftCareCredentials(req);

    if (!credentials || !credentials.accountId || !credentials.apiKey) {
      return res.status(401).json({
        error: 'ShiftCare API credentials not configured. Please configure environment variables.',
      });
    }

    req.shiftcareCredentials = credentials;
    next();
  });
};

/**
 * RBAC: Allow only specified roles to access the route
 * Must be used after authenticateJWT (or requireAuth for ShiftCare routes)
 * @param {...string} allowedRoles - Roles that can access (e.g. 'super_admin', 'viewer')
 */
export const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions',
      });
    }
    next();
  };
