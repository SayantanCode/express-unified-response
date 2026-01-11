import express from "express";
import request from "supertest";
import { createResponseMiddleware } from "../src/index";
import { describe, it, expect, vi } from "vitest";

describe("Silent Console Logging", () => {
  it("should respect the silent flag in individual res.success calls", async () => {
    const onSuccess = vi.fn();
    const app = express();

    // Setup middleware with a logger
    app.use(createResponseMiddleware({ logger: { onSuccess } }));

    app.get("/silent-check", (req, res) => {
      res.success({ ok: true }, "Silent message", { silent: true });
    });

    await request(app).get("/silent-check");

    // The global logger should not have been triggered
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
