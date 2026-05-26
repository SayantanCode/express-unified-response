// src/config/ResponseConfig.ts

import {
  ErrorExposureConfig,
  PaginationDefaults,
  ResolvedResponseConfig,
  ResponseConfig,
  ResponseKeyMapping,
  RestDefaults,
} from "./types";

import chalk from "chalk";

const defaultKeys: Required<ResponseKeyMapping> = {
  successKey: "success",
  dataKey: "data",
  metaKey: "meta",
  messageKey: "message",
  errorKey: "error",
};

const defaultError: Required<ErrorExposureConfig> = {
  exposeStack: false,
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
  adapters: [],
};

const defaultLogger = {
  onSuccess: (req?: any, statusCode?: number, durationMs?: number) => {
    const method = chalk.bold((req?.method || "").padEnd(7)); // Keeps column alignment
    const url = req?.originalUrl || req?.url || "-";
    
    // Status color logic (2xx green, 3xx cyan)
    const sc = statusCode ?? 0;
    const statusColor = sc >= 300 ? chalk.cyan : chalk.green;
    const status = statusColor(sc);
    
    const time = typeof durationMs === "number" ? chalk.gray(`${durationMs.toFixed(3)} ms`) : "";

    console.log(`${method} ${url} ${status} ${time}`);
  },

  onError: (req?: any, error?: any, statusCode?: number, durationMs?: number) => {
    const method = chalk.bold((req?.method || "").padEnd(7));
    const url = req?.originalUrl || "";
    
    // Status color logic (4xx yellow, 5xx red)
    const sc = statusCode ?? 0;
    const statusColor = sc >= 500 ? chalk.red : chalk.yellow;
    const status = statusColor(sc);
    
    const time = typeof durationMs === "number" ? chalk.gray(`${durationMs.toFixed(3)} ms`) : "";
    const errorCode = chalk.red.dim(`- ${error?.code || "ERROR"}`);

    console.error(`${method} ${url} ${status} ${time} ${errorCode}`);
    
    // Safety hint for your internal adapter logic
    if (error?.message?.includes("[express-unified-response]")) {
      console.warn(
        chalk.magenta.italic("    ℹ Hint: A custom error adapter threw an exception.")
      );
    }
  }
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
  // Map the adapters from user config or default to empty array
  adapters: config?.adapters || [],
  logger: config?.logger ?? defaultLogger,
  silent: config?.silent ?? false
};
}
