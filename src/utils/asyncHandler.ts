import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async express handler to catch errors and pass them to next()
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};