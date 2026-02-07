import Joi from 'joi';

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};
