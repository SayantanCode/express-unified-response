// src/express/errorMiddleware.ts

import type { NextFunction, Request, Response, RequestHandler } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { ResponseConfig } from "../config/types";
import { AppError } from "../core/errors";
import { ErrorAdapter } from "../core/types";

export const createErrorMiddleware = (config?: ResponseConfig & { adapters?: ErrorAdapter[] }) => {
  const builder = new ResponseBuilder(config);
  const adapters = config?.adapters || [];
  const handleNotFound = config?.routeNotFound !== false;

  const notFoundHandler: RequestHandler = (req, _res, next) => {
    if (handleNotFound) {
      return next(
        new AppError(
          `Route ${req.originalUrl} not found`,
          404,
          "ROUTE_NOT_FOUND"
        )
      );
    }
    next();
  };

  const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (res.headersSent) return next(err);

    const { statusCode, body, shouldLog, error } = builder.apperror(err, { adapters });

    if (shouldLog && builder.config.logger?.onError) {
      const startTime = (req as any).startTime ?? Date.now();
      const durationMs = Date.now() - startTime;

      builder.config.logger.onError(req, error, statusCode, durationMs);
    }
    res.status(statusCode).json(body);
  };
  return [notFoundHandler, errorHandler]
};
