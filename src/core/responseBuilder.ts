// src/core/ResponseBuilder.ts

import { resolveConfig } from "../config/responseConfig";
import { ResolvedResponseConfig, ResponseConfig } from "../config/types";
import { AppError, createAppError } from "./errors";
import { PaginatedResult } from "./types";
import { TransformFn } from "./paginator";
import { ErrorAdapter } from "./types";
import { filterStackTrace, safeStringify } from "../utils/stackTraceFilter";

/**
 * Central builder for all success, paginated, list and error responses.
 * Keeps uniform response envelope while allowing key mapping and REST defaults.
 */
export class ResponseBuilder {
  public readonly config: ResolvedResponseConfig;

  constructor(config?: ResponseConfig) {
    this.config = resolveConfig(config);
  }

  // ---------- Internal helpers ----------

  /**
   * Applies transformation to data or array of data
   */
  private applyTransform<T, R>(
    data: T | T[],
    transform?: TransformFn<T, R>,
  ): T | R | R[] {
    if (transform) {
      return Array.isArray(data)
        ? (data.map((item) => transform(item)) as any)
        : transform(data);
    }
    return data as T | R | R[];
  }

  private baseSuccess<T>(data: T, message?: string) {
    const { successKey, dataKey, messageKey } = this.config.keys;

    return {
      [successKey]: true,
      ...(data !== undefined ? { [dataKey]: data } : {}),
      ...(message ? { [messageKey]: message } : {}),
    } as Record<string, any>;
  }

  private shouldLog(options?: { silent?: boolean }): boolean {
    // Priority: 1. Method-level flag, 2. Global config flag
    const isSilent = options?.silent ?? this.config.silent ?? false;
    return !isSilent;
  }
  // ---------- Public success APIs ----------

  /**
   * List response designed to work with Paginator.paginateList results.
   * Handles the metadata block and transformation.
   */
  list<T, R = T>(
    result: PaginatedResult<T>,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};

    const { successKey, dataKey, metaKey, messageKey } = this.config.keys;
    const labels = this.config.pagination.labels || {};

    // 1. Transform the data within the result object
    const finalDocs = this.applyTransform(result.docs, transform);

    // 2. Map the metadata using your configured labels
    const meta = {
      [labels.totalDocs ?? "totalDocs"]: result.totalDocs,
      [labels.limit ?? "limit"]: result.limit,
      [labels.page ?? "page"]: result.page,
      [labels.totalPages ?? "totalPages"]: result.totalPages,
      [labels.hasNextPage ?? "hasNextPage"]: result.hasNextPage,
      [labels.hasPrevPage ?? "hasPrevPage"]: result.hasPrevPage,
      [labels.nextPage ?? "nextPage"]: result.nextPage,
      [labels.prevPage ?? "prevPage"]: result.prevPage,
    };

    return {
      statusCode: 200,
      body: {
        [successKey]: true,
        [dataKey]: finalDocs,
        [metaKey]: meta,
        ...(message ? { [messageKey]: message } : {}),
      },
      shouldLog: this.shouldLog({ silent }),
    };
  }
  /**
   * Generic success (200) with transformation support.
   */
  success<T, R = T>(
    data: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};
    let processedData = data;
    if (typeof data === "object" && data !== null && "_doc" in (data as any)) {
      processedData = (data as any)._doc;
    }

    const finalData = this.applyTransform(processedData, transform);

    return {
      statusCode: 200,
      body: this.baseSuccess(finalData, message),
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Created (201) with transformation support.
   */
  created<T, R = T>(
    data: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};
    const finalData = this.applyTransform(data, transform);

    return {
      statusCode: 201,
      body: this.baseSuccess(finalData, message),
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Updated resource logic:
   * - If updateReturnsBody = true -> 200 + body.
   * - Else -> 204 No Content
   * - Overrides 204 to 200 if message/data is provided.
   */
  updated<T, R = T>(
    data?: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body?: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};

    const isEmpty = (val: any) =>
      val === undefined ||
      val === null ||
      val === "" ||
      val === false ||
      val === "_";

    // Scenario A: User wants a 200 response (Either they have data OR a message)
    const hasData = !isEmpty(data);
    const hasMessage = !!message;

    if (hasData || hasMessage) {
      const finalData = hasData
        ? this.applyTransform(data!, transform)
        : undefined;

      return {
        statusCode: 200,
        body: this.baseSuccess(finalData, message),
        shouldLog: this.shouldLog({ silent }),
      };
    }

    // Scenario B: No data and No message -> 204 No Content
    return {
      statusCode: 204,
      body: undefined,
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Deleted resource.
   * - If deleteReturnsNoContent = true -> 204 No Content.
   * - Else -> 200 + { success, message? }.
   * - Overrides 204 to 200 if message/data is provided.
   */
  deleted(
    data?: any,
    message?: string,
    options?: { silent?: boolean },
  ): { statusCode: number; body?: Record<string, any>; shouldLog: boolean } {
    const { silent } = options || {};

    const isEmpty = (val: any) =>
      val === undefined ||
      val === null ||
      val === "" ||
      val === false ||
      val === "_";

    const hasData = !isEmpty(data);
    const hasMessage = !!message;

    // If global config says 204 but we have a message, we MUST override to 200
    if (hasMessage || hasData) {
      return {
        statusCode: 200,
        body: this.baseSuccess(hasData ? data : undefined, message),
        shouldLog: this.shouldLog({ silent }),
      };
    }

    // Default to 204 for deletions if no message/data provided
    return {
      statusCode: 204,
      body: undefined,
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Paginated list (200) with meta block and transformation support for docs.
   */
  paginated<T, R = T>(
    result: PaginatedResult<T>,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};

    const { successKey, dataKey, metaKey, messageKey } = this.config.keys;
    const labels = this.config.pagination.labels || {};
    const finalDocs = this.applyTransform(result.docs, transform);

    const meta = {
      [labels.totalDocs ?? "totalDocs"]: result.totalDocs,
      [labels.limit ?? "limit"]: result.limit,
      [labels.page ?? "page"]: result.page,
      [labels.totalPages ?? "totalPages"]: result.totalPages,
      [labels.hasNextPage ?? "hasNextPage"]: result.hasNextPage,
      [labels.hasPrevPage ?? "hasPrevPage"]: result.hasPrevPage,
      [labels.nextPage ?? "nextPage"]: result.nextPage,
      [labels.prevPage ?? "prevPage"]: result.prevPage,
    };

    const body = {
      [successKey]: true,
      [dataKey]: finalDocs,
      [metaKey]: meta,
      ...(message ? { [messageKey]: message } : {}),
    };

    return { statusCode: 200, body, shouldLog: this.shouldLog({ silent }) };
  }

  /**
   * Error response remains the same but returns Record<string, any> for consistency.
   */
  apperror(
    err: unknown,
    options?: { silent?: boolean; adapters?: ErrorAdapter[] },
  ): {
    statusCode: number;
    body: Record<string, any>;
    shouldLog: boolean;
    error: AppError;
  } {
    const { silent, adapters: methodAdapters } = options || {};
    // Merge adapters: Method-level adapters come first, then global config adapters
    const globalAdapters = this.config.adapters || [];
    const combinedAdapters = [...(methodAdapters || []), ...globalAdapters];
    const appErr: AppError = createAppError(err, combinedAdapters);
    const { keys, error } = this.config;
    const { errorKey, messageKey, successKey } = keys;

    // For non-operational errors (programmer bugs), use a generic message
    const message =
      !appErr.isOperational && this.config.error.defaultErrorMessage
        ? this.config.error.defaultErrorMessage
        : appErr.message;

    const body: Record<string, any> = {
      [successKey]: false,
      [messageKey]: message,
      [errorKey]: {
        code: appErr.code,
        ...(appErr.details ? { details: safeStringify(appErr.details) } : {}),
      },
    };

    if (error.exposeErrorName && appErr.name) body[errorKey].name = appErr.name;

    // Filter stack trace to hide node_modules and internal paths
    if (error.exposeStack && appErr.stack) {
      body[errorKey].stack = filterStackTrace(appErr.stack);
    }

    return {
      statusCode: appErr.statusCode,
      body,
      shouldLog: this.shouldLog({ silent }),
      error: appErr,
    };
  }
}
