// src/express/middleware.ts
import type { NextFunction, Request, Response } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { Paginator } from "../core/paginator";
import { ResponseConfig } from "../config/types";
import { AppError } from "../core/errors";
// import { RequestWithStartTime } from "./types";
// import { AppError, createAppError } from "../core/errors";

export const createResponseMiddleware = (config?: ResponseConfig) => {
  const builder = new ResponseBuilder(config);
  const paginator = new Paginator(builder.config.pagination.defaults);

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    req.startTime = startTime;
    //helper functions
    const logSuccess = (statusCode: number) => {
      const durationMs = Date.now() - startTime;
      builder.config.logger?.onSuccess?.(req, statusCode, durationMs);
    };
    // const logError = (err: unknown, statusCode: number) => {
    //   const durationMs = Date.now() - startTime;
    //   const appErr = createAppError(err);
    //   builder.config.logger?.onError?.(req, appErr, statusCode, durationMs);
    // };
    // No type casting needed - As I am doing declaration merging for express Response
    res.success = (data: any, message?: string, options: { transform?: any, shouldLog?: boolean } = {}) => {
      const { statusCode, body, shouldLog } = builder.success(data, message, options);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      const finalLogControl = options.shouldLog !== undefined ? options.shouldLog : shouldLog;
      if (finalLogControl) logSuccess(statusCode);
      res.status(statusCode).json(body);
    };

    res.created = (data: any, message?: string, options: { transform?: any, silent?: boolean } = {}) => {
      const { statusCode, body, shouldLog } = builder.created(
        data,
        message,
        options
        // transform
      );
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (shouldLog) logSuccess(statusCode);
      res.status(statusCode).json(body);
    };

    res.updated = (data?: any, message?: string, options: { transform?: any, silent?: boolean } = {}) => {
      const { statusCode, body, shouldLog } = builder.updated(
        data,
        message,
        options
        // transform
      );
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (shouldLog) logSuccess(statusCode);
      if (body) res.status(statusCode).json(body);
      else res.sendStatus(statusCode);
    };

    res.deleted = (data?: any, message?: string, options:{ silent?: boolean } = {}) => {
      const { statusCode, body, shouldLog } = builder.deleted(data, message, options);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (shouldLog) logSuccess(statusCode);
      if (body) res.status(statusCode).json(body);
      else res.sendStatus(statusCode);
    };

    // res.list = (items: any[], message?: string, transform?: any) => {
    //   const { statusCode, body, shouldLog } = builder.list(items, message, transform);
    //   // if (builder.config.logger?.onSuccess) {
    //   //   builder.config.logger.onSuccess(200);
    //   // }
    //   if (shouldLog) logSuccess(statusCode);
    //   res.status(statusCode).json(body);
    // };

    res.list = async (data: any[], options: any = {}, message?: string) => {
      const { transform } = options;
      if (transform && typeof transform !== "function") {
        throw new AppError(
          "Transform must be a function",
          400,
          "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
        );
      }
      const result = await paginator.paginateList(data, options);
      const { statusCode, body, shouldLog } = builder.list(result, message);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (shouldLog) logSuccess(statusCode);
      res.status(statusCode).json(body);
    };
    // res.paginated = (result: any, message?: string, transform?: any) => {
    //   const { statusCode, body, shouldLog } = builder.paginated(
    //     result,
    //     message,
    //     transform
    //   );
    //   // if (builder.config.logger?.onSuccess) {
    //   //   builder.config.logger.onSuccess(statusCode);
    //   // }
    //   if (shouldLog) logSuccess(statusCode);
    //   res.status(statusCode).json(body);
    // };

    // res.error = (err: unknown) => {
    //   const { statusCode, body, shouldLog } = builder.apperror(err);
    //   // if (builder.config.logger?.onError) {
    //   //   builder.config.logger?.onError(createAppError(err), statusCode);
    //   // }
    //   if (shouldLog) logError(err, statusCode);
    //   res.status(statusCode).json(body);
    // };

    res.paginateQuery = async (model: any, options: any, message?: string) => {
      //check options.transform must be a function
      const transform = options?.transform;
      if (transform && typeof transform !== "function") {
        throw new AppError(
          "Transform must be a function",
          400,
          "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
        );
      }
      const result = await paginator.paginateQuery(model, options);
      const { statusCode, body, shouldLog } = builder.paginated(
        result,
        message
      );
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (shouldLog) logSuccess(statusCode);
      res.status(statusCode).json(body);
    };

    res.paginateAggregate = async (
      model: any,
      options: any,
      message?: string
    ) => {
      const transform = options?.transform;
      if (transform && typeof transform !== "function") {
        throw new AppError(
          "Transform must be a function",
          400,
          "EX_UNI_RESP:TRANSFORM_MUST_BE_FUNCTION"
        );
      }
      const result = await paginator.paginateAggregate(model, options);
      const { statusCode, body, shouldLog } = builder.paginated(
        result,
        message
      );
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(req);
      // }
      if (shouldLog) logSuccess(statusCode);
      res.status(statusCode).json(body);
    };

    next();
  };
};
