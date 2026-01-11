import { describe, it, expect } from 'vitest';
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
});