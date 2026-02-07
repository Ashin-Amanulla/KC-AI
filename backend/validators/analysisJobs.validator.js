import Joi from 'joi';

const mongoId = Joi.string().pattern(/^[a-fA-F0-9]{24}$/).message('Invalid job ID format');

export const getJobByIdSchema = {
  params: Joi.object({
    id: mongoId.required(),
  }),
};
