// Checking custom configuration overrides for response keys
// (like payload instead of data) provided by the user during initialization.

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createResponseMiddleware } from '../src/index';

describe('Configuration Customization', () => {
  it('should use custom keys for the response body', async () => {
    const app = express();
    app.use(createResponseMiddleware({
      keys: {
        successKey: 'ok',
        dataKey: 'payload',
        messageKey: 'note'
      }
    }));

    app.get('/custom', (req, res) => {
      res.success({ id: 1 }, 'Customized');
    });

    const res = await request(app).get('/custom');
    expect(res.body).toEqual({
      ok: true,
      payload: { id: 1 },
      note: 'Customized'
    });
  });
});