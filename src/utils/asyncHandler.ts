import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from "express";

/**
 * Wraps an async Express route handler so unhandled promise rejections are
 * forwarded to `next(err)` automatically — no try/catch needed in routes.
 *
 * Works with Express 4/5 route handlers, Express error handlers (4 args),
 * and Mongoose pre/post hooks. Preserves function arity and `this` binding.
 *
 * @example
 * // Route handler
 * app.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.list(users);
 * }));
 *
 * @example
 * // Mongoose hook
 * schema.pre('save', asyncHandler(async function (next) {
 *   await validate(this);
 *   next();
 * }));
 */
// Overload 1: standard 3-arg Express route handler → returns RequestHandler
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any
): RequestHandler;
// Overload 2: 2-arg handler (no next) — common pattern, still returns RequestHandler
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<any> | any
): RequestHandler;
// Overload 3: 4-arg Express error handler → returns ErrorRequestHandler
export function asyncHandler(
  fn: (err: any, req: Request, res: Response, next: NextFunction) => Promise<any> | any
): ErrorRequestHandler;
// Overload 4: general function (Mongoose hooks, custom middlewares)
export function asyncHandler(fn: (...args: any[]) => any): (...args: any[]) => any;
// Implementation
export function asyncHandler(fn: any): any {
  const handler = function (this: any, ...args: any[]) {
    return Promise.resolve(fn.apply(this, args)).catch(err => {
      // next() is always the last function argument in Express and Mongoose hooks
      let next: ((...a: any[]) => any) | undefined;
      for (let i = args.length - 1; i >= 0; i--) {
        if (typeof args[i] === "function") { next = args[i]; break; }
      }
      if (next) return next(err);
      throw err;
    });
  };

  // Preserve arity so Express can distinguish route handlers from error handlers
  Object.defineProperty(handler, "length", { value: fn.length });

  return handler;
}
