// src/index.ts
import "./express/types";

export type {
  ResponseOptions,
  ListOptions,
  QueryOptions,
  AggregateOptions,
  CursorOptions,
  RawPaginationOptions,
  RawCursorMeta,
} from "./express/types";

export { createResponseMiddleware } from "./express/middleware";
export { createErrorMiddleware } from "./express/errorMiddleware";


export type { ResponseConfig, ResponseKeyMapping } from "./config/types";

export type { ErrorAdapter, PaginatedResult, CursorPaginatedResult, ErrorDetails } from "./core/types";

export {
  AppError,
  createAppError,
  NotFoundError,
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  MethodNotAllowedError,
  RateLimitError,
  PayloadTooLargeError,
  TokenExpiredError,
  InvalidTokenError,
  FileUploadError,
  ExternalServiceError,
  DatabaseError,
  MongooseValidationError,
  MongooseCastError,
  MongooseDuplicateKeyError,
  MongooseGeneralError,
} from "./core/errors";

export type { CursorPaginationOptions } from "./core/paginator";
export { asyncHandler } from "./utils/asyncHandler";
export { filterStackTrace, safeStringify } from "./utils/stackTraceFilter";
