// src/express/errorMiddleware.ts

import type { NextFunction, Request, Response } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { ResponseConfig } from "../config/types";
import { AppError, createAppError } from "../core/errors";

export const createErrorMiddleware = (config?: ResponseConfig) => {
  const builder = new ResponseBuilder(config);
  const handleNotFound = config?.routeNotFound !== false;
  const notFoundHandler = (req: any, res: any, next: any) => {
    if (handleNotFound) {
      // We pass a specific 404 error to trigger the next middleware in the array.
      return next(new AppError(`Route ${req.originalUrl} not found`, 404, "ROUTE_NOT_FOUND"));
    }
    next();
  };
  const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err); 
    
    const { statusCode, body, shouldLog } = builder.apperror(err);
    if (shouldLog && builder.config.logger?.onError) {
      const appErr = createAppError(err);
      const durationMs = Date.now() - (req.startTime || Date.now());
      builder.config.logger.onError(req, appErr, statusCode, durationMs);
    }
    res.status(statusCode).json(body);
  };
  return [notFoundHandler, errorHandler]
};
