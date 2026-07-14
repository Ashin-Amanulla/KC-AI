import jwt from 'jsonwebtoken';
import { User } from '../user/user.model.js';
import { config } from '../../config/index.js';
import { loadRolePermissions } from '../../middlewares/auth.middleware.js';
import {
  UnauthorizedError,
  ValidationError,
} from '../../helpers/errors.js';

const buildUserPayload = async (userDoc) => {
  const role = userDoc.role || 'viewer';
  const permissions = await loadRolePermissions(role);
  return {
    id: userDoc._id,
    email: userDoc.email,
    name: userDoc.name || userDoc.email,
    role,
    permissions,
  };
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const role = user.role || 'viewer';
    const permissions = await loadRolePermissions(role);
    const token = jwt.sign(
      { userId: user._id, email: user.email, role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email,
        role,
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAuthStatus = async (req, res, next) => {
  try {
    const userDoc = await User.findById(req.user.userId)
      .select('email name role')
      .lean();

    if (!userDoc) {
      throw new UnauthorizedError('User not found');
    }

    const user = await buildUserPayload(userDoc);
    res.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};
