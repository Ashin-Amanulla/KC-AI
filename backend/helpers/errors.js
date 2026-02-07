/**
 * Custom error classes for consistent error handling across the API.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Standard API error response format
 */
export const formatErrorResponse = (err) => {
  const status = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (err.details) {
    response.error.details = err.details;
  }
  return { status, body: response };
};
