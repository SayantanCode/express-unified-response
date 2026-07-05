import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { asyncHandler, createErrorMiddleware } from '../src/index';

describe('Async Handler Utility', () => {
  it('should catch async errors without try-catch blocks', async () => {
    const app = express();

    app.get('/async-fail', asyncHandler(async () => {
      await new Promise((_, reject) => reject(new Error('Async Failure')));
    }));

    app.use(createErrorMiddleware());

    const res = await request(app).get('/async-fail');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Async Failure');
  });

  it('should preserve the arity (length) of the original function', () => {
    const handler3 = asyncHandler(async (_req: any, _res: any, _next: any) => {});
    const handler4 = asyncHandler(async (_err: any, _req: any, _res: any, _next: any) => {});
    const handler1 = asyncHandler(async (_next: any) => {});

    expect(handler3.length).toBe(3);
    expect(handler4.length).toBe(4);
    expect(handler1.length).toBe(1);
  });

  it('should safely find and call next() when used as a Mongoose-style hook (1 argument)', async () => {
    const mockNext = vi.fn();
    const error = new Error('Mongoose Hook Error');

    const mongooseHook = asyncHandler(async (_next: (...args: any[]) => any) => {
      throw error;
    });

    // Mongoose only passes the next function as the first argument
    await mongooseHook(mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should safely find and call next() when used as an Express error handler (4 arguments)', async () => {
    const mockNext = vi.fn();
    const error = new Error('Error Handler Error');

    const errorHandler = asyncHandler(async (_err: any, _req: any, _res: any, _next: (...args: any[]) => any) => {
      throw error;
    });

    // Call the handler directly with mock objects to test next() forwarding.
    // Bypasses Express's actual request pipeline intentionally — no type cast needed at runtime.
    await (errorHandler as any)(new Error('Initial Error'), {}, {}, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should preserve "this" context (required for Mongoose hooks)', async () => {
    const mockDoc = { name: 'Test Doc', age: 25 };
    const mockNext = vi.fn();

    const hook = asyncHandler(async function(this: typeof mockDoc, next: (...args: any[]) => any) {
      expect(this.name).toBe('Test Doc');
      expect(this.age).toBe(25);
      next();
    });

    // Simulate Mongoose calling the hook with mockDoc as context
    await hook.apply(mockDoc, [mockNext]);

    expect(mockNext).toHaveBeenCalled();
  });
});