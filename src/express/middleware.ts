// src/express/middleware.ts
import type { NextFunction, Request, Response } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { Paginator } from "../core/paginator";
import { ResponseConfig } from "../config/types";
import { AppError } from "../core/errors";

/**
 * Attaches all response helpers to `res` (`res.success`, `res.created`, `res.paginateQuery`,
 * `res.paginateRaw`, etc.) and starts the request timer used for log duration.
 *
 * Register **before** your routes.
 *
 * @example
 * const config = { adapters: [prismaAdapter] };
 * app.use(createResponseMiddleware(config));
 */
export const createResponseMiddleware = (config?: ResponseConfig) => {
  const builder = new ResponseBuilder(config);
  const paginator = new Paginator({
    ...builder.config.pagination.defaults,
    nonPaginatedMaxItems: builder.config.restDefaults.nonPaginatedMaxItems,
    warn: builder.config.logger?.onWarn,
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    req.startTime = startTime;

    // Fires after the socket write completes, so durationMs includes JSON serialization time.
    // Skipped when logLevel is "error" or "none", or when the caller passed silent: true.
    const logAfterSend = (statusCode: number) => {
      const logLevel = builder.config.logger?.logLevel ?? "all";
      if (logLevel === "none" || logLevel === "error") return;
      res.once("finish", () => {
        builder.config.logger?.onSuccess?.(req, statusCode, Date.now() - startTime);
      });
    };

    res.success = (
      data: any,
      message?: string,
      options: { transform?: any; silent?: boolean } = {}
    ) => {
      try {
        const { statusCode, body, shouldLog } = builder.success(data, message, options);
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) { next(err); }
    };

    res.accepted = (
      data?: any,
      message?: string,
      options: { transform?: any; silent?: boolean } = {}
    ) => {
      try {
        const { statusCode, body, shouldLog } = builder.accepted(data, message, options);
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) { next(err); }
    };

    res.created = (
      data: any,
      message?: string,
      options: { transform?: any; silent?: boolean } = {}
    ) => {
      try {
        const { statusCode, body, shouldLog } = builder.created(data, message, options);
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) { next(err); }
    };

    res.updated = (
      data?: any,
      message?: string,
      options: { transform?: any; silent?: boolean } = {}
    ) => {
      try {
        const { statusCode, body, shouldLog } = builder.updated(data, message, options);
        if (shouldLog) logAfterSend(statusCode);
        if (body) res.status(statusCode).json(body);
        else res.sendStatus(statusCode);
      } catch (err) { next(err); }
    };

    res.deleted = (
      data?: any,
      message?: string,
      options: { transform?: any; silent?: boolean } = {}
    ) => {
      try {
        const { statusCode, body, shouldLog } = builder.deleted(data, message, options);
        if (shouldLog) logAfterSend(statusCode);
        if (body) res.status(statusCode).json(body);
        else res.sendStatus(statusCode);
      } catch (err) { next(err); }
    };

    res.noContent = (options: { silent?: boolean } = {}) => {
      try {
        const { statusCode, shouldLog } = builder.noContent(options);
        if (shouldLog) logAfterSend(statusCode);
        res.sendStatus(statusCode);
      } catch (err) { next(err); }
    };

    res.list = async (data: any[], options: any = {}, message?: string) => {
      try {
        const { transform } = options;
        if (transform && typeof transform !== "function") {
          throw new AppError(
            "Transform must be a function",
            400,
            "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
          );
        }
        const result = await paginator.paginateList(data, options);
        const { statusCode, body, shouldLog } = builder.list(result, message, {
          silent: options.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    res.paginateQuery = async (model: any, options: any, message?: string) => {
      try {
        const transform = options?.transform;
        if (transform && typeof transform !== "function") {
          throw new AppError(
            "Transform must be a function",
            400,
            "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
          );
        }
        const result = await paginator.paginateQuery(model, options);
        const { statusCode, body, shouldLog } = builder.paginated(result, message, {
          silent: options.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    res.paginateAggregate = async (model: any, options: any, message?: string) => {
      try {
        const transform = options?.transform;
        if (transform && typeof transform !== "function") {
          throw new AppError(
            "Transform must be a function",
            400,
            "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
          );
        }
        const result = await paginator.paginateAggregate(model, options);
        const { statusCode, body, shouldLog } = builder.paginated(result, message, {
          silent: options.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    res.paginateRaw = async (docs: any[], totalDocs: number, options: any = {}, message?: string) => {
      try {
        const transform = options?.transform;
        if (transform && typeof transform !== "function") {
          throw new AppError("Transform must be a function", 400, "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION");
        }
        const result = paginator.fromRaw(docs, totalDocs, options);
        const { statusCode, body, shouldLog } = builder.paginated(result, message, {
          silent: options?.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    res.paginateCursorRaw = async (docs: any[], meta: any, options: any = {}, message?: string) => {
      try {
        const transform = options?.transform;
        if (transform && typeof transform !== "function") {
          throw new AppError("Transform must be a function", 400, "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION");
        }
        const result = paginator.fromCursorRaw(docs, meta);
        const { statusCode, body, shouldLog } = builder.cursorPaginated(result, message, {
          silent: options?.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    res.paginateCursor = async (model: any, options: any, message?: string) => {
      try {
        const transform = options?.transform;
        if (transform && typeof transform !== "function") {
          throw new AppError(
            "Transform must be a function",
            400,
            "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
          );
        }
        const result = await paginator.paginateCursor(model, options);
        const { statusCode, body, shouldLog } = builder.cursorPaginated(result, message, {
          silent: options?.silent,
          transform,
        });
        if (shouldLog) logAfterSend(statusCode);
        res.status(statusCode).json(body);
      } catch (err) {
        next(err);
      }
    };

    next();
  };
};
