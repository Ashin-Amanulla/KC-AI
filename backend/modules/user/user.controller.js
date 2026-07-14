import { User } from './user.model.js';
import { getActiveRoleBySlug } from '../role/role.service.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../helpers/errors.js';

const toUserResponse = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  const { password, ...rest } = obj;
  return rest;
};

const validateRoleSlug = async (slug) => {
  const role = await getActiveRoleBySlug(slug);
  if (!role) {
    throw new ValidationError(`Invalid or inactive role: ${slug}`);
  }
  return role;
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      throw new ValidationError('Email, password, and name are required');
    }

    const userRole = role || 'viewer';
    await validateRoleSlug(userRole);

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name: name.trim(),
      role: userRole,
    });
    await user.save();

    res.status(201).json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (name !== undefined) user.name = name.trim();
    if (role !== undefined) {
      await validateRoleSlug(role);
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    if (password !== undefined && password.length > 0) user.password = password;

    await user.save();
    res.json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.isActive = false;
    await user.save();
    res.json({ message: 'User deactivated successfully', user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
};
