// src/express/errorMiddleware.ts

import type { NextFunction, Request, Response, RequestHandler, ErrorRequestHandler } from "express";
import { ResponseBuilder } from "../core/responseBuilder";
import { ResponseConfig } from "../config/types";
import { AppError } from "../core/errors";
import { ErrorAdapter } from "../core/types";
import { internalLogger } from "../utils/logger";

/**
 * Centralized error handler middleware. Normalizes any thrown value into a
 * consistent JSON error response. Optionally prepends a 404 catch-all for
 * unmatched routes (`routeNotFound: true` by default).
 *
 * Returns an array — Express flattens it natively, **no spread needed**:
 * ```js
 * app.use(createErrorMiddleware(config)); // ✅ works
 * ```
 *
 * Register **after** all routes, using the **same config object** passed to
 * `createResponseMiddleware` so adapters, keys, and error settings are consistent.
 *
 * @example
 * const config = { adapters: [prismaAdapter] };
 * app.use(createResponseMiddleware(config));
 * app.use(createErrorMiddleware(config));
 */
export const createErrorMiddleware = (
  config?: ResponseConfig & { adapters?: ErrorAdapter[] }
): (RequestHandler | ErrorRequestHandler)[] => {
  const builder = new ResponseBuilder(config);
  const handleNotFound = builder.config.routeNotFound ?? true;
  let hasWarnedMissingResponseMiddleware = false;

  // Dev-only diagnostic: if res.success (attached per-request by createResponseMiddleware)
  // is missing when an error reaches this handler, the most common causes are either
  // createResponseMiddleware() was never registered, or this middleware was registered
  // before it / before the routes (which also means every request hits the 404 catch-all
  // above before createResponseMiddleware ever runs). Fires once per middleware instance —
  // purely advisory, never changes the actual error response. Standalone use of
  // createErrorMiddleware (without createResponseMiddleware) is a supported pattern, so the
  // wording only suggests a likely cause rather than asserting a mistake.
  const warnIfResponseMiddlewareMissing = (res: Response) => {
    if (hasWarnedMissingResponseMiddleware) return;
    if (process.env.NODE_ENV === "production") return;
    if (typeof (res as any).success === "function") return;

    hasWarnedMissingResponseMiddleware = true;
    const warn = builder.config.logger?.onWarn ?? internalLogger.warn;
    warn(
      "res.success()/created()/... were not found on this response — usually because " +
      "createResponseMiddleware() is missing or registered after this route (or after " +
      "createErrorMiddleware()). If you're intentionally using createErrorMiddleware() " +
      "standalone, this is expected and can be ignored."
    );
  };

  const result: (RequestHandler | ErrorRequestHandler)[] = [];

  if (handleNotFound) {
    const notFound: RequestHandler = (req, _res, next) => {
      next(new AppError(`Route ${req.originalUrl} not found`, 404, "ROUTE_NOT_FOUND"));
    };
    result.push(notFound);
  }

  result.push((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    warnIfResponseMiddlewareMissing(res);

    const { statusCode, body, shouldLog, error } = builder.apperror(err);

    if (shouldLog) {
      const logLevel = builder.config.logger?.logLevel ?? "all";
      if (logLevel !== "none") {
        // startTime is set by createResponseMiddleware; fall back to now if used standalone.
        const startTime = (req as any).startTime ?? Date.now();
        res.once("finish", () => {
          builder.config.logger?.onError?.(req, error, statusCode, Date.now() - startTime);
        });
      }
    }
    res.status(statusCode).json(body);
  });

  return result;
};
