// import express from "express";
// import request from "supertest";
// import { createResponseMiddleware } from "../src/index";
// import { describe, it, expect, vi } from "vitest";

// describe("Silent Console Logging", () => {
//   it("should respect the silent flag in individual res.success calls", async () => {
//     const onSuccess = vi.fn();
//     const app = express();

//     // Setup middleware with a logger
//     app.use(createResponseMiddleware({ logger: { onSuccess } }));

//     app.get("/silent-check", (req, res) => {
//       res.success({ ok: true }, "Silent message", { silent: true });
//     });

//     await request(app).get("/silent-check");

//     // The global logger should not have been triggered
//     expect(onSuccess).not.toHaveBeenCalled();
//   });
// });

import express from "express";
import request from "supertest";
import { createResponseMiddleware, createErrorMiddleware } from "../src/index";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Global Silent Configuration", () => {
  let onSuccess: any;
  let onError: any;

  beforeEach(() => {
    onSuccess = vi.fn();
    onError = vi.fn();
  });

  it("should NOT log success or error when global silent flag is true", async () => {
    const app = express();

    // Setup global config with silent: true
    const config = {
      silent: true,
      logger: { onSuccess, onError }
    };

    app.use(createResponseMiddleware(config));
    
    app.get("/test-success", (req, res) => {
      res.success({ data: "test" });
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.get("/test-error", (req, res) => {
      // Simulate a random error
      throw new Error("Trigger Error");
    });

    // Attach error middleware last
    app.use(createErrorMiddleware(config));

    // 1. Test Success
    await request(app).get("/test-success");
    expect(onSuccess).not.toHaveBeenCalled();

    // 2. Test Error
    await request(app).get("/test-error");
    expect(onError).not.toHaveBeenCalled();
  });

  it("should allow individual calls to override the global silent: false setting", async () => {
    const app = express();

    // Global logging is ENABLED
    const config = {
      silent: false,
      logger: { onSuccess }
    };

    app.use(createResponseMiddleware(config));

    app.get("/override-to-silent", (req, res) => {
      // Specifically silencing this one call
      res.success({ ok: true }, "I am quiet", { silent: true });
    });

    await request(app).get("/override-to-silent");

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("should log by default if no silent flag is provided", async () => {
    const app = express();
    const config = { logger: { onSuccess } };

    app.use(createResponseMiddleware(config));

    app.get("/default-log", (req, res) => {
      res.success({ ok: true });
    });

    await request(app).get("/default-log");

    expect(onSuccess).toHaveBeenCalled();
  });
});