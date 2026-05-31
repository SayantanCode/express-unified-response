// src/core/errors.ts

import type mongoose from "mongoose";
import { ErrorDetails } from "./types";
import { ErrorAdapter } from "./types";
import { internalLogger } from '../utils/logger';

/* -------------------------------------------------------------------------- */
/*                                   BASE                                     */
/* -------------------------------------------------------------------------- */

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: ErrorDetails | ErrorDetails[];
  public isOperational: boolean;

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
      value: value !== undefined ? value : null,
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

export function createAppError(err: unknown, customAdapters: ErrorAdapter[] = []): AppError {
  const appError = _createAppError(err, customAdapters);
  if (err instanceof Error && !(err instanceof AppError) && err.stack) {
    appError.stack = err.stack;
  }
  return appError;
}

function _createAppError(err: unknown, customAdapters: ErrorAdapter[] = []): AppError {
  /* -------------------------- CUSTOM ADAPTERS ------------------------- */
  // Give priority to user-defined adapters
  // for (const adapter of customAdapters) {
  //   const result = adapter(err);
  //   if (result instanceof AppError) return result;
  // }
  if (Array.isArray(customAdapters)) {
    for (const [index, adapter] of customAdapters.entries()) {
      try {
        // Skip if adapter isn't a function (safety for JS users)
        if (typeof adapter !== 'function') continue;

        const result = adapter(err);
        
        // Only return if the adapter actually returned an AppError instance
        if (result instanceof AppError) return result;
      } catch (adapterError) {
        /**
         * SAFETY SHIELD: 
         * If a user's custom adapter crashes, we catch it here.
         * We log it so the developer knows their adapter is broken,
         * but we don't let it crash the whole request.
         */
        internalLogger.adapterError(`Adapter at index ${index}`, adapterError);
        // Continue to the next adapter or built-in logic
        continue; 
      }
    }
  }

  /* ------------------------------BUILT-IN LOGIC APP ERRORS ----------------------------- */
  if (err instanceof AppError) return err;

  /* ---------------------------- AUTH / TOKENS ---------------------------- */

  if (typeof err === "object" && err !== null && "name" in err) {
    if ((err as any).name === "TokenExpiredError") {
      return new TokenExpiredError();
    }

    if ((err as any).name === "JsonWebTokenError") {
      return new InvalidTokenError();
    }
  }

  /* ------------------------------ MULTER -------------------------------- */

  if ((err as any)?.code === "LIMIT_FILE_SIZE") {
    return new FileUploadError("File size limit exceeded");
  }

  if ((err as any)?.code === "LIMIT_UNEXPECTED_FILE") {
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
  // This part might need to be more robust based on how mongoose errors are structured. Leave for later
  /* ----------------------------- MONGOOSE -------------------------------- */
  const errName = (err as any)?.name;
  const errCode = (err as any)?.code;

  // 1. Validation Error
  if (
    errName === "ValidationError"
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
    // User explicitly threw an Error, so treat it as operational
    // Only mask if it's a generic framework error with no meaningful message
    return new AppError(
      err.message,
      500,
      "INTERNAL_ERROR",
      undefined,
      true // operational - user threw this intentionally
    );
  }

  // Handle strings or objects thrown directly
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
    true
  );
}
