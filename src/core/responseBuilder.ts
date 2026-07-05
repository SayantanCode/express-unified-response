// src/core/ResponseBuilder.ts

import { resolveConfig } from "../config/responseConfig";
import { ResolvedResponseConfig, ResponseConfig } from "../config/types";
import { AppError, createAppError } from "./errors";
import { PaginatedResult, CursorPaginatedResult } from "./types";
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

  private unwrapDoc<T>(item: T): T {
    if (item !== null && item !== undefined && typeof item === "object" && "_doc" in (item as any)) {
      return (item as any)._doc;
    }
    return item;
  }

  private applyTransform<T, R>(
    data: T | T[],
    transform?: TransformFn<T, R>,
  ): T | R | R[] {
    // Nothing to process — return as-is so baseSuccess can decide what to do with null/undefined
    if (data === null || data === undefined) return data as any;

    if (Array.isArray(data)) {
      // Unwrap _doc on every item (handles arrays of Mongoose documents)
      const unwrapped = data.map((item) => this.unwrapDoc(item));
      if (!transform) return unwrapped as any;
      try {
        return unwrapped.map((item) => transform(item)) as R[];
      } catch (err) {
        throw new AppError(
          `Transform function threw: ${err instanceof Error ? err.message : String(err)}`,
          500,
          "TRANSFORM_ERROR"
        );
      }
    }

    const unwrapped = this.unwrapDoc(data);
    if (!transform) return unwrapped as any;
    try {
      return transform(unwrapped);
    } catch (err) {
      throw new AppError(
        `Transform function threw: ${err instanceof Error ? err.message : String(err)}`,
        500,
        "TRANSFORM_ERROR"
      );
    }
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
   * Shared by list() and paginated() — both return the identical offset-pagination
   * envelope (docs + meta block), just sourced from different pagination strategies.
   */
  private buildOffsetPaginatedResponse<T, R = T>(
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
   * List response designed to work with Paginator.paginateList results.
   * Handles the metadata block and transformation.
   */
  list<T, R = T>(
    result: PaginatedResult<T>,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    return this.buildOffsetPaginatedResponse(result, message, options);
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
    const finalData = this.applyTransform(data, transform);

    return {
      statusCode: 200,
      body: this.baseSuccess(finalData, message),
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Accepted (202) — async operations queued for processing.
   */
  accepted<T, R = T>(
    data?: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};
    const finalData = this.applyTransform(data as T, transform);

    return {
      statusCode: 202,
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

    const hasData = data !== undefined && data !== null;
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

    // When no data/message: respect updateReturnsBody config
    const returnsBody = this.config.restDefaults.updateReturnsBody;
    if (returnsBody) {
      return {
        statusCode: 200,
        body: this.baseSuccess(undefined, undefined),
        shouldLog: this.shouldLog({ silent }),
      };
    }

    return {
      statusCode: 204,
      body: undefined,
      shouldLog: this.shouldLog({ silent }),
    };
  }

  /**
   * Explicit 204 No Content — for endpoints that are not delete operations
   * but genuinely have no response body (e.g. PATCH, action endpoints, HEAD).
   */
  noContent(
    options?: { silent?: boolean },
  ): { statusCode: number; shouldLog: boolean } {
    return {
      statusCode: 204,
      shouldLog: this.shouldLog(options),
    };
  }

  /**
   * Deleted resource.
   * - If deleteReturnsNoContent = true -> 204 No Content.
   * - Else -> 200 + { success, message? }.
   * - Overrides 204 to 200 if message/data is provided.
   */
  deleted<T, R = T>(
    data?: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body?: Record<string, any>; shouldLog: boolean } {
    const { silent, transform } = options || {};

    const hasData = data !== undefined && data !== null;
    const hasMessage = !!message;

    // Explicit data/message always forces 200 with body
    if (hasMessage || hasData) {
      const finalData = hasData ? this.applyTransform(data!, transform) : undefined;
      return {
        statusCode: 200,
        body: this.baseSuccess(finalData, message),
        shouldLog: this.shouldLog({ silent }),
      };
    }

    // When no data/message: respect deleteReturnsNoContent config
    const noContent = this.config.restDefaults.deleteReturnsNoContent;
    if (noContent) {
      return {
        statusCode: 204,
        body: undefined,
        shouldLog: this.shouldLog({ silent }),
      };
    }

    return {
      statusCode: 200,
      body: this.baseSuccess(undefined, undefined),
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
    return this.buildOffsetPaginatedResponse(result, message, options);
  }

  /**
   * Cursor-paginated response (200) — no total count, uses nextCursor for navigation.
   */
  cursorPaginated<T, R = T>(
    result: CursorPaginatedResult<T>,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean },
  ): { statusCode: number; body: Record<string, any>; shouldLog: boolean } {
    const { transform, silent } = options || {};
    const { successKey, dataKey, metaKey, messageKey } = this.config.keys;

    const finalDocs = this.applyTransform(result.docs, transform);

    const meta = {
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
      limit: result.limit,
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
    const appErr: AppError = createAppError(err, combinedAdapters, this.config.logger?.onWarn);
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
