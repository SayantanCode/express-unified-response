import { AppError } from "../core/errors";

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
  docs?: string; 
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
  keys?: ResponseKeyMapping;
  error?: ErrorExposureConfig;
  pagination?: {
    labels?: PaginationLabelMapping;
    defaults?: PaginationDefaults;
  };
  restDefaults?: RestDefaults;
  logger?: {
    onSuccess?: (req?: any, statusCode?: number, durationMs?: number) => void;
    onError?: (req?: any, error?: AppError, statusCode?: number, durationMs?: number) => void;
  };
  routeNotFound?: boolean;
  silent?: boolean;
}

export interface ResolvedResponseConfig {
  keys: Required<ResponseKeyMapping>;
  error: Required<ErrorExposureConfig>;
  pagination: {
    labels?: PaginationLabelMapping;
    defaults: Required<PaginationDefaults>;
  };
  restDefaults: Required<RestDefaults>;
  logger?: {
    onSuccess?: (req?: any, statusCode?: number, durationMs?: number) => void;
    onError?: (req?: any, error?: AppError, statusCode?: number, durationMs?: number) => void;
  };
  routeNotFound?: boolean;
  silent?: boolean;
}
