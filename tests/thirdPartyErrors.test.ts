// Tests for third-party error auto-normalisation in createErrorMiddleware.
// No actual Zod/Multer/Axios packages needed — we simulate their error shapes
// the same way jsonwebtoken errors are simulated in realWorldErrors.test.ts.

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
} from "../src/index";

// ─── shared helper ────────────────────────────────────────────────────────────

function buildApp(throwFn: () => never) {
  const app = express();
  app.use(createResponseMiddleware());
  app.get("/trigger", asyncHandler(async () => { throwFn(); }));
  app.use(createErrorMiddleware());
  return app;
}

// ─── ZOD ─────────────────────────────────────────────────────────────────────

describe("Zod ZodError normalisation", () => {
  it("maps ZodError to 400 VALIDATION_ERROR with per-field details", async () => {
    const zodError: any = new Error("Validation failed");
    zodError.name = "ZodError";
    zodError.issues = [
      { path: ["email"], message: "Invalid email", code: "invalid_string" },
      { path: ["age"],   message: "Expected number", code: "invalid_type" },
    ];

    const app = buildApp(() => { throw zodError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details).toHaveLength(2);
    expect(res.body.error.details[0].field).toBe("email");
    expect(res.body.error.details[0].message).toBe("Invalid email");
    expect(res.body.error.details[0].code).toBe("invalid_string");
    expect(res.body.error.details[1].field).toBe("age");
  });

  it("maps ZodError with nested path (e.g. address.city) to dot-notation field", async () => {
    const zodError: any = new Error("Validation failed");
    zodError.name = "ZodError";
    zodError.issues = [
      { path: ["address", "city"], message: "Required", code: "invalid_type" },
    ];

    const app = buildApp(() => { throw zodError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("address.city");
  });

  it("maps ZodError with empty path to field 'unknown'", async () => {
    const zodError: any = new Error("Validation failed");
    zodError.name = "ZodError";
    zodError.issues = [
      { path: [], message: "Top-level error", code: "custom" },
    ];

    const app = buildApp(() => { throw zodError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("unknown");
  });
});

// ─── MULTER ──────────────────────────────────────────────────────────────────

describe("Multer error normalisation", () => {
  it("maps LIMIT_FILE_SIZE to 400 with 'File size limit exceeded'", async () => {
    const multerError: any = new Error("File too large");
    multerError.code = "LIMIT_FILE_SIZE";

    const app = buildApp(() => { throw multerError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("File size limit exceeded");
  });

  it("maps LIMIT_UNEXPECTED_FILE to 400 with 'Unexpected file field'", async () => {
    const multerError: any = new Error("Unexpected field");
    multerError.code = "LIMIT_UNEXPECTED_FILE";

    const app = buildApp(() => { throw multerError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Unexpected file field");
  });
});

// ─── BODY PARSER ─────────────────────────────────────────────────────────────

describe("body-parser error normalisation", () => {
  it("maps entity.too.large to 413 PAYLOAD_TOO_LARGE", async () => {
    const bpError: any = new Error("request entity too large");
    bpError.type = "entity.too.large";

    const app = buildApp(() => { throw bpError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("maps entity.parse.failed to 400 BAD_REQUEST with 'Invalid JSON body'", async () => {
    const bpError: any = new SyntaxError("Unexpected token");
    bpError.type = "entity.parse.failed";

    const app = buildApp(() => { throw bpError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.message).toBe("Invalid JSON body");
  });
});

// ─── AXIOS ───────────────────────────────────────────────────────────────────

describe("Axios error normalisation", () => {
  it("maps isAxiosError=true to 502 EXTERNAL_SERVICE_ERROR", async () => {
    const axiosError: any = new Error("Request failed with status code 503");
    axiosError.isAxiosError = true;
    axiosError.code = "ECONNREFUSED";

    const app = buildApp(() => { throw axiosError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(res.body.message).toBe("External API error");
  });

  it("includes axios error message and code in details", async () => {
    const axiosError: any = new Error("connect ETIMEDOUT");
    axiosError.isAxiosError = true;
    axiosError.code = "ETIMEDOUT";

    const app = buildApp(() => { throw axiosError; });
    const res = await request(app).get("/trigger");

    expect(res.status).toBe(502);
    expect(res.body.error.details.message).toBe("connect ETIMEDOUT");
    expect(res.body.error.details.code).toBe("ETIMEDOUT");
  });
});