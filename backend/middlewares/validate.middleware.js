import Joi from 'joi';

/**
 * Validation middleware factory. Validates req body, query, or params against a Joi schema.
 * @param {Object} schema - { body?, query?, params? } - Joi schemas for each
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const keys = ['body', 'query', 'params'];

    keys.forEach((key) => {
      const s = schema[key];
      if (!s) return;
      const { error } = s.validate(req[key], { abortEarly: false });
      if (error) {
        error.details.forEach((d) => {
          errors.push({ field: d.path.join('.'), message: d.message });
        });
      }
    });

    if (errors.length > 0) {
      const message = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: message,
        },
      });
    }
    next();
  };
};
