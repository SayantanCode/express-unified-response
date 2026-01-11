// src/express/errorMiddleware.ts

import type { NextFunction, Request, Response } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { ResponseConfig } from "../config/types";

export const createErrorMiddleware = (config?: ResponseConfig) => {
  const builder = new ResponseBuilder(config);

  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const { statusCode, body } = builder.error(err);
    res.status(statusCode).json(body);
  };
};
