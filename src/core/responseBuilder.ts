// src/core/ResponseBuilder.ts

import { resolveConfig } from "../config/responseConfig";
import { ResolvedResponseConfig, ResponseConfig } from "../config/types";
import { AppError, createAppError } from "./errors";
import { PaginatedResult } from "./types";
import { TransformFn } from "./paginator";

/**
 * Central builder for all success, paginated, list and error responses.
 * Keeps uniform response envelope while allowing key mapping and REST defaults.
 */
// export class ResponseBuilder {
//   public readonly config: ResolvedResponseConfig;

//   constructor(config?: ResponseConfig) {
//     this.config = resolveConfig(config);
//   }

//   // ---------- Internal helpers ----------

//   private baseSuccess<T>(data: T, message?: string) {
//     const { successKey, dataKey, messageKey } = this.config.keys;
//     return {
//       [successKey]: true,
//       [dataKey]: data,
//       ...(message ? { [messageKey]: message } : {}),
//     };
//   }

//   private basePaginated<T>(result: PaginatedResult<T>, message?: string) {
//     const { successKey, dataKey, metaKey, messageKey } = this.config.keys;
//     const labels = this.config.pagination.labels || {};

//     // const docsKey = labels.docs ?? 'docs';
//     const totalDocsKey = labels.totalDocs ?? "totalDocs";
//     const limitKey = labels.limit ?? "limit";
//     const pageKey = labels.page ?? "page";
//     const totalPagesKey = labels.totalPages ?? "totalPages";
//     const hasNextPageKey = labels.hasNextPage ?? "hasNextPage";
//     const hasPrevPageKey = labels.hasPrevPage ?? "hasPrevPage";
//     const nextPageKey = labels.nextPage ?? "nextPage";
//     const prevPageKey = labels.prevPage ?? "prevPage";

//     const meta = {
//       [totalDocsKey]: result.totalDocs,
//       [limitKey]: result.limit,
//       [pageKey]: result.page,
//       [totalPagesKey]: result.totalPages,
//       [hasNextPageKey]: result.hasNextPage,
//       [hasPrevPageKey]: result.hasPrevPage,
//       [nextPageKey]: result.nextPage,
//       [prevPageKey]: result.prevPage,
//     };

//     return {
//       [successKey]: true,
//       [dataKey]: result.docs,
//       [metaKey]: meta,
//       ...(message ? { [messageKey]: message } : {}),
//     };
//   }

//   // ---------- Public success APIs ----------

//   /**
//    * Non‑paginated list response (no meta block).
//    */
//   list<T>(items: T[], message?: string): any {
//     const { successKey, dataKey, messageKey } = this.config.keys;
//     return {
//       [successKey]: true,
//       [dataKey]: items,
//       ...(message ? { [messageKey]: message } : {}),
//     };
//   }

//   /**
//    * Generic success (200) with body.
//    */
//   success<T>(data: T, message?: string): { statusCode: number; body: any } {
//     if (this.config.logger?.onSuccess) {
//       this.config.logger.onSuccess(200);
//     }
//     return { statusCode: 200, body: this.baseSuccess(data, message) };
//   }

//   /**
//    * Created (201) with body.
//    */
//   created<T>(data: T, message?: string): { statusCode: number; body: any } {
//     if (this.config.logger?.onSuccess) {
//       this.config.logger.onSuccess(201);
//     }
//     return { statusCode: 201, body: this.baseSuccess(data, message) };
//   }

//   /**
//    * Updated resource.
//    * - If updateReturnsBody = true → 200 + body.
//    * - Else → 204 No Content.
//    */
//   updated<T>(data?: T, message?: string): { statusCode: number; body?: any } {
//     if (this.config.restDefaults.updateReturnsBody && data !== undefined) {
//       if (this.config.logger?.onSuccess) {
//         this.config.logger.onSuccess(200);
//       }
//       return { statusCode: 200, body: this.baseSuccess(data, message) };
//     }
//     if (this.config.logger?.onSuccess) {
//       this.config.logger.onSuccess(204);
//     }
//     return { statusCode: 204 };
//   }

//   /**
//    * Deleted resource.
//    * - If deleteReturnsNoContent = true → 204 No Content.
//    * - Else → 200 + { success, message? }.
//    */
//   deleted(message?: string): { statusCode: number; body?: any } {
//     if (this.config.restDefaults.deleteReturnsNoContent) {
//       if (this.config.logger?.onSuccess) {
//         this.config.logger.onSuccess(204);
//       }
//       return { statusCode: 204 };
//     }

//     const { successKey, messageKey } = this.config.keys;
//     const body: any = { [successKey]: true };
//     if (message) body[messageKey] = message;
//     if (this.config.logger?.onSuccess) {
//       this.config.logger.onSuccess(200);
//     }
//     return { statusCode: 200, body };
//   }

//   /**
//    * Paginated list (200) with meta block.
//    */
//   paginated<T>(
//     result: PaginatedResult<T>,
//     message?: string
//   ): { statusCode: number; body: any } {
//     if (this.config.logger?.onSuccess) {
//       this.config.logger.onSuccess(200);
//     }
//     return { statusCode: 200, body: this.basePaginated(result, message) };
//   }

//   // ---------- Error handling ----------

//   /**
//    * Uniform error response builder.
//    * Converts any error into AppError, then into { statusCode, body }.
//    */
//   error(err: unknown): { statusCode: number; body: any } {
//     const appErr: AppError = createAppError(err);
//     const { keys, error } = this.config;
//     const { errorKey, messageKey, successKey } = keys;

//     const body: any = {
//       [successKey]: false,
//       [messageKey]: appErr.message,
//       [errorKey]: {
//         code: appErr.code,
//         ...(appErr.details ? { details: appErr.details } : {}),
//       },
//     };

//     if (error.exposeErrorName && appErr.name) {
//       body[errorKey].name = appErr.name;
//     }

//     if (error.exposeStack && appErr.stack) {
//       body[errorKey].stack = appErr.stack;
//     }

//     if (this.config.logger?.onError) {
//       this.config.logger.onError(appErr, appErr.statusCode);
//     }

//     return { statusCode: appErr.statusCode, body };
//   }
// }

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
    transform?: TransformFn<T, R>
  ): T | R | R[] {
    if (transform) {
      return Array.isArray(data)
        ? (data.map((item) => transform(item)) as any)
        : transform(data);
    }
    return data as T | R | R[];
  }

  private baseSuccess<T, R>(
    data: T,
    message?: string,
    transform?: TransformFn<T, R>
  ) {
    const { successKey, dataKey, messageKey } = this.config.keys;
    const finalData = this.applyTransform(data, transform);

    return {
      [successKey]: true,
      [dataKey]: finalData,
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
   * Non‑paginated list response with transformation support.
   */
  list<T, R = T>(
    items: T[],
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean }
  ): Record<string, any> {
    const { transform, silent } = options || {};
    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(200);
    }
    const { successKey, dataKey, messageKey } = this.config.keys;
    const finalData = this.applyTransform(items, transform);

    return {
      [successKey]: true,
      [dataKey]: finalData,
      ...(message ? { [messageKey]: message } : {}),
    };
  }

  /**
   * Generic success (200) with transformation support.
   */
  success<T, R = T>(
    data: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean }
  ): { statusCode: number; body: Record<string, any> } {
    const { transform, silent } = options || {};
    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(200);
    }
    return {
      statusCode: 200,
      body: this.baseSuccess(data, message, transform),
    };
  }

  /**
   * Created (201) with transformation support.
   */
  created<T, R = T>(
    data: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean }
  ): { statusCode: number; body: Record<string, any> } {
    const { transform, silent } = options || {};
    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(201);
    }
    return {
      statusCode: 201,
      body: this.baseSuccess(data, message, transform),
    };
  }

  /**
   * Updated resource logic:
   * - If a message is provided, return 200 + body (204 cannot have a body).
   * - If updateReturnsBody = true -> 200 + body.
   * - Else -> 204 No Content (body is strictly undefined).
   */
  updated<T, R = T>(
    data?: T,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean }
  ): { statusCode: number; body?: Record<string, any> } {
    // Force 200 if there is a message, as 204 cannot carry a message body
    const { transform, silent } = options || {};

    const shouldReturnBody =
      (this.config.restDefaults.updateReturnsBody || !!message) &&
      data !== undefined && data !== null && data !== '' && data !== false && data !== "_";

    if (shouldReturnBody) {
      if (this.shouldLog({ silent })) {
        this.config.logger?.onSuccess?.(200);
      }
      return {
        statusCode: 200,
        body: this.baseSuccess(data, message, transform),
      };
    }

    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(204);
    }
    return { statusCode: 204, body: undefined };
  }

  /**
   * Deleted resource.
   * - If deleteReturnsNoContent = true -> 204 No Content.
   * - Else -> 200 + { success, message? }.
   */
  deleted(message?: string, options?: { silent?: boolean }): {
    statusCode: number;
    body?: Record<string, any>;
  } {
    const { silent } = options || {};
    if (this.config.restDefaults.deleteReturnsNoContent && !message) {
      if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(204);
    }
      return { statusCode: 204, body: undefined };
    }

    const { successKey, messageKey } = this.config.keys;
    const body = {
      [successKey]: true,
      ...(message ? { [messageKey]: message } : {}),
    };

    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(200);
    }
    return { statusCode: 200, body };
  }

  /**
   * Paginated list (200) with meta block and transformation support for docs.
   */
  paginated<T, R = T>(
    result: PaginatedResult<T>,
    message?: string,
    options?: { transform?: TransformFn<T, R>; silent?: boolean }
  ): { statusCode: number; body: Record<string, any> } {
    const { transform, silent } = options || {};
    if (this.shouldLog({ silent })) {
      this.config.logger?.onSuccess?.(200);
    }

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

    return { statusCode: 200, body };
  }

  /**
   * Error response remains the same but returns Record<string, any> for consistency.
   */
  error(err: unknown, options?: { silent?: boolean }): { statusCode: number; body: Record<string, any> } {
    const { silent } = options || {};
    const appErr: AppError = createAppError(err);
    const { keys, error } = this.config;
    const { errorKey, messageKey, successKey } = keys;

    const body: Record<string, any> = {
      [successKey]: false,
      [messageKey]: appErr.message,
      [errorKey]: {
        code: appErr.code,
        ...(appErr.details ? { details: appErr.details } : {}),
      },
    };

    if (error.exposeErrorName && appErr.name) body[errorKey].name = appErr.name;
    if (error.exposeStack && appErr.stack) body[errorKey].stack = appErr.stack;

    if (this.shouldLog({ silent })) {
      this.config.logger?.onError?.(appErr, appErr.statusCode);
    }

    return { statusCode: appErr.statusCode, body };
  }
}
