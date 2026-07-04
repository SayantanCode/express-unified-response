// src/core/errors.ts

import type mongoose from "mongoose";
import { ErrorDetails } from "./types";
import { ErrorAdapter } from "./types";
import { internalLogger } from '../utils/logger';

/* -------------------------------------------------------------------------- */
/*                                   BASE                                     */
/* -------------------------------------------------------------------------- */

/**
 * Base error class for all application errors. Throw directly for one-off cases
 * or extend for domain-specific error types.
 *
 * @example
 * throw new AppError("Seat already taken", 409, "SEAT_CONFLICT");
 * throw new AppError("Rate limit", 429, "RATE_LIMIT", { retryAfter: 60 });
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: ErrorDetails | ErrorDetails[];
  public isOperational: boolean;

  /**
   * @param message - Human-readable message shown to API clients (when operational)
   * @param statusCode - HTTP status code (e.g. 400, 404, 500)
   * @param code - Machine-readable error code included in the response (default: "CUSTOM_ERROR")
   * @param details - Optional structured context — single object or array for field-level errors
   * @param isOperational - `true` (default) = show message to client; `false` = show defaultErrorMessage
   */
  constructor(
    message: string,
    statusCode: number,
    code: string = "CUSTOM_ERROR",
    details?: ErrorDetails | ErrorDetails[],
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/* -------------------------------------------------------------------------- */
/*                            GENERIC HTTP ERRORS                              */
/* -------------------------------------------------------------------------- */

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: string) {
    super(
      message,
      404,
      "NOT_FOUND",
      details ? { message: details } : undefined
    );
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    details?: ErrorDetails | ErrorDetails[]
  ) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = "Bad request",
    details?: ErrorDetails | ErrorDetails[]
  ) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: string) {
    super(
      message,
      401,
      "UNAUTHORIZED",
      details ? { message: details } : undefined
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: string) {
    super(
      message,
      403,
      "FORBIDDEN",
      details ? { message: details } : undefined
    );
  }
}

export class MethodNotAllowedError extends AppError {
  constructor() {
    super("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: string) {
    super(
      message,
      429,
      "TOO_MANY_REQUESTS",
      details ? { message: details } : undefined
    );
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super("Payload too large", 413, "PAYLOAD_TOO_LARGE");
  }
}

/* -------------------------------------------------------------------------- */
/*                             AUTH / SECURITY                                 */
/* -------------------------------------------------------------------------- */

export class TokenExpiredError extends UnauthorizedError {
  constructor() {
    super("Token expired");
  }
}

export class InvalidTokenError extends UnauthorizedError {
  constructor() {
    super("Invalid authentication token");
  }
}

/* -------------------------------------------------------------------------- */
/*                               FILE UPLOAD                                   */
/* -------------------------------------------------------------------------- */

export class FileUploadError extends BadRequestError {
  constructor(message = "File upload failed", details?: ErrorDetails) {
    super(message, details);
  }
}

/* -------------------------------------------------------------------------- */
/*                         EXTERNAL / INFRA ERRORS                              */
/* -------------------------------------------------------------------------- */

export class ExternalServiceError extends AppError {
  constructor(message = "External service error", details?: ErrorDetails) {
    super(message, 502, "EXTERNAL_SERVICE_ERROR", details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database error") {
    super(message, 503, "DATABASE_ERROR");
  }
}

/* -------------------------------------------------------------------------- */
/*                            MONGOOSE ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class MongooseValidationError extends ValidationError {
  constructor(err: mongoose.Error.ValidationError) {
    const details: ErrorDetails[] = Object.entries(err.errors).map(
      ([field, error]: [string, any]) => ({
        field,
        message: error.message,
        value: error.value,
        code: error.kind,
      })
    );
    super("Mongoose validation failed", details);
  }
}

export class MongooseCastError extends BadRequestError {
  constructor(err: mongoose.Error.CastError) {
    super("Invalid ID format", {
      message: err.message,
      field: err.path,
      value: err.value,
    });
  }
}

export class MongooseDuplicateKeyError extends BadRequestError {
  constructor(
    err: mongoose.mongo.MongoServerError & { code: number; keyValue?: any }
  ) {
    // 1. Extract the field name safely
    let field: string | undefined;
    let value: any = undefined;

    try {
      if (err.keyValue && typeof err.keyValue === 'object') {
        const fieldKey = Object.keys(err.keyValue)[0];
        if (fieldKey) {
          field = fieldKey;
          value = err.keyValue[fieldKey];
          
          // If the value is still an object, it means MongoDB returned a nested structure
          // We take the first value found inside that nested object
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const nestedValue = Object.values(value)[0];
            value = nestedValue !== undefined ? nestedValue : value;
          }
        }
      }
    } catch {
      // Silently handle any errors in parsing keyValue
      // Fall through to use safe defaults
    }

    const safeMessage = field 
      ? `Duplicate value found for field: ${field}`
      : 'Duplicate key error';

    super("Duplicate key error", {
      message: safeMessage,
      field: field || 'unknown',
      code: String(err.code || 11000),
    });
  }
}

export class MongooseGeneralError extends AppError {
  constructor(err: mongoose.Error) {
    super("Mongoose Error Occurred", 500, "MONGOOSE_ERROR", {
      message: err.message,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                               ERROR FACTORY                                 */
/* -------------------------------------------------------------------------- */

export function createAppError(
  err: unknown,
  customAdapters: ErrorAdapter[] = [],
  onWarn?: (message: string, context?: unknown) => void
): AppError {
  const appError = _createAppError(err, customAdapters, onWarn);
  if (err instanceof Error && !(err instanceof AppError) && err.stack) {
    appError.stack = err.stack;
  }
  return appError;
}

function _createAppError(
  err: unknown,
  customAdapters: ErrorAdapter[] = [],
  onWarn?: (message: string, context?: unknown) => void
): AppError {
  /* -------------------------- CUSTOM ADAPTERS ------------------------- */
  if (Array.isArray(customAdapters)) {
    for (const [index, adapter] of customAdapters.entries()) {
      try {
        if (typeof adapter !== 'function') continue;
        const result = adapter(err);
        if (result instanceof AppError) return result;
      } catch (adapterError) {
        // Adapter crashed — log it but don't let it kill the request.
        // Routes through the user's onWarn if configured, otherwise falls back to internalLogger.
        if (onWarn) {
          onWarn(`Adapter at index ${index} threw an exception`, adapterError);
        } else {
          internalLogger.adapterError(`Adapter at index ${index}`, adapterError);
        }
        continue;
      }
    }
  }

  /* ------------------------------BUILT-IN LOGIC APP ERRORS ----------------------------- */
  if (err instanceof AppError) return err;

  // Hoist name/code so all checks below can share them
  const errName = (err as any)?.name;
  const errCode = (err as any)?.code;

  /* ---------------------------- AUTH / TOKENS ---------------------------- */

  if (errName === "TokenExpiredError") return new TokenExpiredError();
  if (errName === "JsonWebTokenError") return new InvalidTokenError();

  /* -------------------------------- ZOD --------------------------------- */

  if (errName === "ZodError" && Array.isArray((err as any).issues)) {
    const details: ErrorDetails[] = (err as any).issues.map((issue: any) => ({
      field: Array.isArray(issue.path) && issue.path.length > 0
        ? issue.path.join(".")
        : "unknown",
      message: issue.message,
      code: issue.code,
    }));
    return new ValidationError("Validation failed", details);
  }

  /* ------------------------------ MULTER -------------------------------- */

  if (errCode === "LIMIT_FILE_SIZE") {
    return new FileUploadError("File size limit exceeded");
  }

  if (errCode === "LIMIT_UNEXPECTED_FILE") {
    return new FileUploadError("Unexpected file field");
  }

  /* -------------------------- BODY PARSER -------------------------------- */

  if ((err as any)?.type === "entity.too.large") {
    return new PayloadTooLargeError();
  }

  if ((err as any)?.type === "entity.parse.failed") {
    return new BadRequestError("Invalid JSON body");
  }

  /* ------------------------------ AXIOS ---------------------------------- */

  if ((err as any)?.isAxiosError) {
    return new ExternalServiceError("External API error", {
      message: (err as any).message,
      code: (err as any).code,
    });
  }

  /* ----------------------------- MONGOOSE -------------------------------- */

  // 1. Validation Error — guard with Mongoose-specific structure to avoid collisions
  // with Joi, class-validator, Zod, etc. that also use the name "ValidationError"
  if (
    errName === "ValidationError" &&
    typeof (err as any).errors === "object" &&
    (err as any).errors !== null &&
    // Mongoose ValidationError has a _message string and per-field error objects
    typeof (err as any)._message === "string"
  ) {
    return new MongooseValidationError(err as mongoose.Error.ValidationError);
  }

  // 2. Cast Error (Invalid ID)
  if (errName === "CastError") {
    return new MongooseCastError(err as mongoose.Error.CastError);
  }

  // 3. Duplicate Key Error (MongoServerError)
  // We check .code specifically because the name can vary, but 11000 is constant
  if (
    errCode === 11000 ||
    (errName === "MongoServerError" && errCode === 11000)
  ) {
    return new MongooseDuplicateKeyError(
      err as any
    );
  }

  if (
    errName === "MongooseServerSelectionError"
  ) {
    return new DatabaseError();
  }
 
  // Generic Mongoose Error (fallback)
  if (errName?.startsWith("Mongoose") || (err as any)?._isMongooseError) {
    return new MongooseGeneralError(err as any);
  }

  /* -------------------------- UNKNOWN ERROR ------------------------------- */

  if (err instanceof Error) {
    // Distinguish intentional throws from runtime programmer bugs.
    // `new Error("msg")` has name === "Error" — treat as operational (show message).
    // `TypeError`, `RangeError`, `ReferenceError`, etc. have specific names — mask them.
    const isIntentional = err.name === "Error";
    return new AppError(
      err.message,
      500,
      "INTERNAL_ERROR",
      undefined,
      isIntentional
    );
  }

  // Handle strings or objects thrown directly — these are intentional throws
  if (typeof err === "string") {
    return new AppError(err, 500, "INTERNAL_ERROR", undefined, true);
  }

  if (typeof err === "object" && err !== null && (err as any).message) {
    return new AppError((err as any).message, 500, "INTERNAL_ERROR", undefined, true);
  }

  return new AppError(
    "Internal server error",
    500,
    "INTERNAL_ERROR",
    undefined,
    false
  );
}
