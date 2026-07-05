// Tests for logger configuration:
//   - logLevel: "error"  → onSuccess suppressed, onError still fires
//   - logLevel: "none"   → both suppressed
//   - logLevel: "all"    → both fire (default behaviour)
//   - onWarn callback    → receives adapter crash notification
//   - onWarn callback    → receives package warning (useEstimatedCount + filter conflict)
//   - partial logger override → shallow-merge keeps unset callbacks as defaults

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  NotFoundError,
  AppError,
} from "../src/index";
import { Paginator } from "../src/core/paginator";

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildApp(config: any = {}) {
  const app = express();
  app.use(createResponseMiddleware(config));

  app.get("/ok", (_req, res) => { res.success({ ok: true }); });
  app.get("/err", (_req, _res) => { throw new NotFoundError("not found"); });

  app.use(createErrorMiddleware(config as any));
  return app;
}

// ─── logLevel ────────────────────────────────────────────────────────────────

describe('logger.logLevel', () => {
  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSuccess = vi.fn();
    onError = vi.fn();
  });

  it('"all" (default) fires onSuccess and onError', async () => {
    const app = buildApp({ logger: { logLevel: "all", onSuccess, onError } });

    await request(app).get("/ok");
    await request(app).get("/err");

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('"error" suppresses onSuccess but still fires onError', async () => {
    const app = buildApp({ logger: { logLevel: "error", onSuccess, onError } });

    await request(app).get("/ok");
    await request(app).get("/err");

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('"none" suppresses both onSuccess and onError', async () => {
    const app = buildApp({ logger: { logLevel: "none", onSuccess, onError } });

    await request(app).get("/ok");
    await request(app).get("/err");

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('onError receives req, AppError, statusCode, and durationMs', async () => {
    const app = buildApp({ logger: { onError } });

    await request(app).get("/err");

    expect(onError).toHaveBeenCalledOnce();
    const [req, error, statusCode, durationMs] = onError.mock.calls[0]!;
    expect(req.method).toBe("GET");
    expect(error).toBeInstanceOf(AppError);
    expect(statusCode).toBe(404);
    expect(typeof durationMs).toBe("number");
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it('onSuccess receives req, statusCode, and durationMs', async () => {
    const app = buildApp({ logger: { onSuccess } });

    await request(app).get("/ok");

    expect(onSuccess).toHaveBeenCalledOnce();
    const [req, statusCode, durationMs] = onSuccess.mock.calls[0]!;
    expect(req.method).toBe("GET");
    expect(statusCode).toBe(200);
    expect(typeof durationMs).toBe("number");
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── onWarn — adapter crash ───────────────────────────────────────────────────

describe('logger.onWarn — adapter crash', () => {
  it('routes adapter crash through onWarn instead of internalLogger', async () => {
    const onWarn = vi.fn();

    const crashingAdapter = () => { throw new Error("boom from adapter"); };
    const config = { adapters: [crashingAdapter], logger: { onWarn } };

    const app = express();
    app.use(createResponseMiddleware(config));
    app.get("/trigger", (_req, _res) => { throw new Error("route error"); });
    app.use(createErrorMiddleware(config));

    await request(app).get("/trigger");

    expect(onWarn).toHaveBeenCalledOnce();
    const [message, context] = onWarn.mock.calls[0]!;
    expect(typeof message).toBe("string");
    expect(message).toMatch(/adapter/i);
    // context should be the thrown error from the adapter
    expect(context).toBeInstanceOf(Error);
    expect((context as Error).message).toBe("boom from adapter");
  });

  it('falls back to internalLogger when onWarn is not configured', async () => {
    // adapter crash with no onWarn — should not throw
    const crashingAdapter = () => { throw new Error("crash"); };
    const config = { adapters: [crashingAdapter] };

    const app = express();
    app.use(createResponseMiddleware(config));
    app.get("/trigger", (_req, _res) => { throw new Error("route error"); });
    app.use(createErrorMiddleware(config));

    const res = await request(app).get("/trigger");
    // request completes successfully despite adapter crash
    expect(res.status).toBe(500);
  });
});

// ─── onWarn — useEstimatedCount + filter conflict ────────────────────────────

describe('logger.onWarn — useEstimatedCount + filter conflict', () => {
  it('routes the warning through onWarn when both are set', async () => {
    const onWarn = vi.fn();

    const mockModel: any = {
      find: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }),
      countDocuments: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(0),
      }),
      estimatedDocumentCount: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(999),
      }),
    };

    const paginator = new Paginator({
      page: 1, limit: 10, maxLimit: 100,
      warn: onWarn,
    } as any);

    await paginator.paginateQuery(mockModel, {
      useEstimatedCount: true,
      filter: { active: true },
    });

    expect(onWarn).toHaveBeenCalledOnce();
    const [message] = onWarn.mock.calls[0]!;
    expect(message).toMatch(/useEstimatedCount/i);
    expect(message).toMatch(/filter/i);
  });
});

// ─── shallow logger merge ─────────────────────────────────────────────────────

describe('logger shallow merge', () => {
  it('partial override keeps default callbacks for unset keys', async () => {
    const customSuccess = vi.fn();
    // Only override onSuccess — onError should still fire (from defaults, but
    // we verify onSuccess is ours and a subsequent error response still works)
    const app = buildApp({ logger: { onSuccess: customSuccess } });

    await request(app).get("/ok");
    expect(customSuccess).toHaveBeenCalledOnce();

    // Error route should still return a proper response (default onError wired)
    const errRes = await request(app).get("/err");
    expect(errRes.status).toBe(404);
  });
});

// ─── dev diagnostic — missing createResponseMiddleware ───────────────────────

describe('createErrorMiddleware — missing createResponseMiddleware diagnostic', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('warns via onWarn when createErrorMiddleware is used without createResponseMiddleware', async () => {
    process.env.NODE_ENV = 'development';
    const onWarn = vi.fn();

    const app = express();
    // No createResponseMiddleware() registered at all
    app.get('/err', (_req, _res) => { throw new Error('boom'); });
    app.use(createErrorMiddleware({ logger: { onWarn } }));

    const res = await request(app).get('/err');

    expect(res.status).toBe(500); // error handling itself still works correctly
    expect(onWarn).toHaveBeenCalledOnce();
    const [message] = onWarn.mock.calls[0]!;
    expect(message).toMatch(/res\.success/i);
    expect(message).toMatch(/createResponseMiddleware/);
  });

  it('warns when createErrorMiddleware is registered before createResponseMiddleware', async () => {
    process.env.NODE_ENV = 'development';
    const onWarn = vi.fn();

    const app = express();
    // Wrong order: error middleware registered first
    app.use(createErrorMiddleware({ logger: { onWarn } }));
    app.use(createResponseMiddleware());
    app.get('/ok', (_req, res) => { res.success({ ok: true }); });

    await request(app).get('/ok');

    // Every request hits the error middleware's own 404 catch-all before
    // createResponseMiddleware ever runs, so the diagnostic should fire.
    expect(onWarn).toHaveBeenCalledOnce();
  });

  it('does NOT warn when set up correctly', async () => {
    process.env.NODE_ENV = 'development';
    const onWarn = vi.fn();
    const app = buildApp({ logger: { onWarn } });

    await request(app).get('/ok');
    await request(app).get('/err');

    expect(onWarn).not.toHaveBeenCalled();
  });

  it('does NOT warn in production, even when misconfigured', async () => {
    process.env.NODE_ENV = 'production';
    const onWarn = vi.fn();

    const app = express();
    app.get('/err', (_req, _res) => { throw new Error('boom'); });
    app.use(createErrorMiddleware({ logger: { onWarn } }));

    await request(app).get('/err');

    expect(onWarn).not.toHaveBeenCalled();
  });

  it('only warns once per middleware instance, not once per request', async () => {
    process.env.NODE_ENV = 'development';
    const onWarn = vi.fn();

    const app = express();
    app.get('/err', (_req, _res) => { throw new Error('boom'); });
    app.use(createErrorMiddleware({ logger: { onWarn } }));

    await request(app).get('/err');
    await request(app).get('/err');
    await request(app).get('/err');

    expect(onWarn).toHaveBeenCalledOnce();
  });

  it('falls back to console.warn (internalLogger) when onWarn is not configured', async () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const app = express();
    app.get('/err', (_req, _res) => { throw new Error('boom'); });
    app.use(createErrorMiddleware());

    const res = await request(app).get('/err');

    expect(res.status).toBe(500);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
