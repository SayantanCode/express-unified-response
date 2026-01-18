// src/config/ResponseConfig.ts

import {
  ErrorExposureConfig,
  PaginationDefaults,
  ResolvedResponseConfig,
  ResponseConfig,
  ResponseKeyMapping,
  RestDefaults,
} from "./types";

const defaultKeys: Required<ResponseKeyMapping> = {
  successKey: "success",
  dataKey: "data",
  metaKey: "meta",
  messageKey: "message",
  errorKey: "error",
};

const defaultError: Required<ErrorExposureConfig> = {
  exposeStack: true,
  exposeErrorName: false,
  defaultErrorMessage: "Internal server error",
};

const defaultPaginationDefaults: Required<PaginationDefaults> = {
  page: 1,
  limit: 10,
  maxLimit: 100,
};

const defaultRestDefaults: Required<RestDefaults> = {
  deleteReturnsNoContent: true,
  updateReturnsBody: true,
  nonPaginatedMaxItems: 1000,
};

export const defaultConfig: ResolvedResponseConfig = {
  keys: defaultKeys,
  error: defaultError,
  pagination: {
    labels: undefined,
    defaults: defaultPaginationDefaults,
  },
  restDefaults: defaultRestDefaults,
};

export function resolveConfig(config?: ResponseConfig): ResolvedResponseConfig {
  return {
    keys: { ...defaultKeys, ...(config?.keys || {}) },
    error: { ...defaultError, ...(config?.error || {}) },
    pagination: {
      labels: {
        ...(config?.pagination?.labels || {}),
      },
      defaults: {
        ...defaultPaginationDefaults,
        ...(config?.pagination?.defaults || {}),
      },
    },
    restDefaults: {
      ...defaultRestDefaults,
      ...(config?.restDefaults || {}),
    },
    logger: config?.logger
      ? {
          onSuccess: (req?: any, statusCode?: number, durationMs?: number) =>
            config.logger?.onSuccess?.(req, statusCode as number, durationMs),
          onError: (req?: any, error?: any, statusCode?: number, durationMs?: number) =>
            config.logger?.onError?.(req, error, statusCode as number, durationMs),
        }
      : undefined,
  };
}
