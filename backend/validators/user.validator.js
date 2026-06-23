import Joi from 'joi';

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid user ID format');

const roleField = Joi.string()
  .trim()
  .lowercase()
  .empty('')
  .default('viewer')
  .pattern(/^[a-z0-9_]+$/)
  .max(64)
  .messages({
    'string.pattern.base': 'Please choose a valid role from the list',
  });

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required().messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required',
    }),
    email: Joi.string().trim().lowercase().email().required().messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),
    role: roleField,
  }),
};

export const updateUserSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).messages({
      'string.empty': 'Name cannot be empty',
    }),
    email: Joi.string().trim().lowercase().email().messages({
      'string.email': 'Please enter a valid email address',
    }),
    password: Joi.string().min(6).max(128).allow(''),
    role: roleField,
    isActive: Joi.boolean(),
  }).min(1),
};

export const deleteUserSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};
