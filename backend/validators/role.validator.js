import Joi from 'joi';
import { ALL_PERMISSION_KEYS } from '../config/permissionCatalog.js';

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .message('Invalid role ID format');

const permissionsSchema = Joi.array()
  .items(Joi.string().valid(...ALL_PERMISSION_KEYS))
  .min(1);

export const createRoleSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow(''),
    permissions: permissionsSchema.required(),
  }),
};

export const updateRoleSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
  body: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500).allow(''),
    permissions: permissionsSchema,
  }).min(1),
};

export const deleteRoleSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};

export const getRoleSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};
