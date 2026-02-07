import Joi from 'joi';

const mongoId = Joi.string().pattern(/^[a-fA-F0-9]{24}$/).message('Invalid user ID format');

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('super_admin', 'finance', 'viewer').required(),
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
    role: Joi.string().valid('super_admin', 'finance', 'viewer'),
  }).min(1),
};

export const deleteUserSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};
