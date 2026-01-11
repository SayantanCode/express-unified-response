// src/express/middleware.ts
import type { NextFunction, Request, Response } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { Paginator } from "../core/paginator";
import { ResponseConfig } from "../config/types";
// import { AppError, createAppError } from "../core/errors";

export const createResponseMiddleware = (config?: ResponseConfig) => {
  const builder = new ResponseBuilder(config);
  const paginator = new Paginator(builder.config.pagination.defaults);

  return (req: Request, res: Response, next: NextFunction) => {
    // No type casting needed - As I am doing declaration merging for express Response
    res.success = (data: any, message?: string, transform?: any) => {
      const { statusCode, body } = builder.success(data, message, transform);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      res.status(statusCode).json(body);
    };

    res.created = (data: any, message?: string, transform?: any) => {
      const { statusCode, body } = builder.created(data, message, transform);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      res.status(statusCode).json(body);
    };

    res.updated = (data?: any, message?: string, transform?: any) => {
      const { statusCode, body } = builder.updated(data, message, transform);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (body) res.status(statusCode).json(body);
      else res.sendStatus(statusCode);
    };

    res.deleted = (message?: string) => {
      const { statusCode, body } = builder.deleted(message);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      if (body) res.status(statusCode).json(body);
      else res.sendStatus(statusCode);
    };

    res.list = (items: any[], message?: string, transform?: any) => {
      const body = builder.list(items, message, transform);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(200);
      // }
      res.status(200).json(body);
    };

    res.paginated = (result: any, message?: string, transform?: any) => {
      const { statusCode, body } = builder.paginated(result, message, transform);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      res.status(statusCode).json(body);
    };

    res.error = (err: unknown) => {
      const { statusCode, body } = builder.error(err);
      // if (builder.config.logger?.onError) {
      //   builder.config.logger?.onError(createAppError(err), statusCode);
      // }
      res.status(statusCode).json(body);
    };

    res.paginateQuery = async (model: any, options: any, message?: string) => {
      const result = await paginator.paginateQuery(model, options);
      const { statusCode, body } = builder.paginated(result, message);
      // if (builder.config.logger?.onSuccess) {
      //   builder.config.logger.onSuccess(statusCode);
      // }
      res.status(statusCode).json(body);
    };

    res.paginateAggregate = async (
      aggregate: any,
      options: any,
      message?: string
    ) => {
      const result = await paginator.paginateAggregate(aggregate, options);
      const { statusCode, body } = builder.paginated(result, message);
      if (builder.config.logger?.onSuccess) {
        builder.config.logger.onSuccess(statusCode);
      }
      res.status(statusCode).json(body);
    };

    next();
  };
};
