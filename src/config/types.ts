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
    onSuccess?: (statusCode: number) => void;
    onError?: (error: AppError, statusCode: number) => void;
  };
  silent?: boolean;
}

export interface ResolvedResponseConfig {
  //   logger: any;
  keys: Required<ResponseKeyMapping>;
  error: Required<ErrorExposureConfig>;
  pagination: {
    labels?: PaginationLabelMapping;
    defaults: Required<PaginationDefaults>;
  };
  restDefaults: Required<RestDefaults>;
  logger?: {
    onSuccess?: (statusCode: number) => void;
    onError?: (error: AppError, statusCode: number) => void;
  };
  silent?: boolean;
}
