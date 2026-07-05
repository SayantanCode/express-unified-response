import { AppError } from "../core/errors";
import { ErrorAdapter } from "../core/types";

export interface ResponseKeyMapping {
  successKey?: string;
  dataKey?: string;
  metaKey?: string;
  messageKey?: string;
  errorKey?: string;
}

export interface ErrorExposureConfig {
  exposeStack?: boolean;
  exposeErrorName?: boolean;
  defaultErrorMessage?: string;
}


export interface PaginationLabelMapping {
  totalDocs?: string;
  limit?: string;
  page?: string;
  totalPages?: string;
  hasNextPage?: string;
  hasPrevPage?: string;
  nextPage?: string;
  prevPage?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationDefaults extends PaginationOptions {
  maxLimit?: number;
}

export interface RestDefaults {
  deleteReturnsNoContent?: boolean;
  updateReturnsBody?: boolean;
  nonPaginatedMaxItems?: number;
}

export interface ResponseConfig {
  adapters?: ErrorAdapter[];
  keys?: ResponseKeyMapping;
  error?: ErrorExposureConfig;
  pagination?: {
    labels?: PaginationLabelMapping;
    defaults?: PaginationDefaults;
  };
  restDefaults?: RestDefaults;
  logger?: {
    /**
     * Controls which requests are logged.
     * - "all"   (default) — log every request
     * - "error" — log only 4xx/5xx responses; suppress 2xx/3xx success lines
     * - "none"  — disable all request logging (overrides onSuccess/onError)
     */
    logLevel?: "all" | "error" | "none";
    onSuccess?: (req?: any, statusCode?: number, durationMs?: number) => void;
    onError?: (req?: any, error?: AppError, statusCode?: number, durationMs?: number) => void;
    /**
     * Called for internal package warnings (e.g. useEstimatedCount + filter conflict,
     * adapter crash). Route to your own logger to keep all output in one place.
     * Receives the message and, for adapter crashes, the original error as context.
     */
    onWarn?: (message: string, context?: unknown) => void;
  };
  routeNotFound?: boolean;
  silent?: boolean;
}

export interface ResolvedResponseConfig {
  adapters: ErrorAdapter[];
  keys: Required<ResponseKeyMapping>;
  error: Required<ErrorExposureConfig>;
  pagination: {
    labels?: PaginationLabelMapping;
    defaults: Required<PaginationDefaults>;
  };
  restDefaults: Required<RestDefaults>;
  logger?: {
    logLevel?: "all" | "error" | "none";
    onSuccess?: (req?: any, statusCode?: number, durationMs?: number) => void;
    onError?: (req?: any, error?: AppError, statusCode?: number, durationMs?: number) => void;
    onWarn?: (message: string, context?: unknown) => void;
  };
  routeNotFound?: boolean;
  silent?: boolean;
}
