import jwt from 'jsonwebtoken';
import { User } from '../user/user.model.js';
import { config } from '../../config/index.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    // Find user by email (exclude only explicitly deactivated users)
    const user = await User.findOne({
      email: email.toLowerCase(),
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Generate JWT token (include role for RBAC)
    const role = user.role || 'viewer';
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
        role: user.role || 'viewer',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    // JWT is stateless, so logout is handled client-side
    // This endpoint is kept for consistency
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
    res.json({
      authenticated: true,
      user: {
        id: req.user.userId,
        email: userDoc?.email ?? req.user.email,
        name: userDoc?.name,
        role: userDoc?.role ?? req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
