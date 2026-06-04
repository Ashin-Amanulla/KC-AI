import Joi from 'joi';

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid user ID format');

const roleField = Joi.string().min(1).max(64).lowercase().trim();

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: roleField.default('viewer'),
  }),
};

export const updateUserSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
  body: Joi.object({
    name: Joi.string().min(1).max(200),
    email: Joi.string().email(),
    password: Joi.string().min(6).allow(''),
    role: roleField,
    isActive: Joi.boolean(),
  }).min(1),
};

export const deleteUserSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};
