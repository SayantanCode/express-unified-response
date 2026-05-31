// src/index.ts
import "./express/types";

export type { 
  ResponseOptions, 
  ListOptions, 
  QueryOptions, 
  AggregateOptions 
} from "./express/types";

export { createResponseMiddleware } from "./express/middleware";
export { createErrorMiddleware } from "./express/errorMiddleware";


export type { ResponseConfig, ResponseKeyMapping } from "./config/types";

export type { ErrorAdapter, PaginatedResult, ErrorDetails } from "./core/types";

export {
  AppError,
  createAppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "./core/errors";

export { asyncHandler } from "./utils/asyncHandler";
export { filterStackTrace, safeStringify } from "./utils/stackTraceFilter";
