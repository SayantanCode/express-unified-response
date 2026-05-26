
/**
 * Wraps an async express handler to catch errors and pass them to next().
 * Preserves the original function's arity and 'this' context so it can be 
 * safely used with Express error handlers (4 args) or Mongoose hooks (1-2 args).
 */
export const asyncHandler = (fn: any): any => {
  const handler = function(this: any, ...args: any[]) {
    // We return a Promise to ensure we can catch both sync and async errors
    return Promise.resolve(fn.apply(this, args)).catch(err => {
      // Find the next function (usually the last function argument)
      const next = args.find(arg => typeof arg === 'function');
      if (next) {
        return next(err);
      }
      throw err;
    });
  };

  // Preserve the arity (length) of the original function so Express and Mongoose can inspect it
  Object.defineProperty(handler, 'length', { value: fn.length });
  
  return handler;
};