/**
 * Typed application errors.
 * All errors thrown in the application should extend AppError.
 *
 * Error taxonomy:
 * - ValidationError (400) - Invalid input data
 * - UnauthorizedError (401) - Missing or invalid credentials
 * - ForbiddenError (403) - Authenticated but not allowed
 * - NotFoundError (404) - Resource doesn't exist
 * - ConflictError (409) - Resource already exists
 * - RateLimitError (429) - Too many requests
 * - InternalError (500) - Unexpected server error
 *
 * These errors are designed to be consumed by the SDK.
 */

/**
 * Base application error.
 * All custom errors extend this class.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON for API responses.
   */
  toJSON(): { error: string; message: string; statusCode: number } {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/**
 * 400 - Bad Request
 * Invalid input data, malformed request.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * 401 - Unauthorized
 * Missing or invalid authentication credentials.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 - Forbidden
 * Authenticated but not authorized to access resource.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 - Not Found
 * Resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * 409 - Conflict
 * Resource already exists or state conflict.
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * 429 - Too Many Requests
 * Rate limit exceeded.
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * 500 - Internal Server Error
 * Unexpected server error.
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
    this.name = 'InternalError';
  }
}

/**
 * Error code constants for SDK consumption.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
