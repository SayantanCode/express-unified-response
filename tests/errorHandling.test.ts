// Checking Test Case for Global Error Handling Middleware
// (Manual, Mongoose-style, and unexpected ones)

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createResponseMiddleware, createErrorMiddleware } from "../src/index";
import mongoose from "mongoose";

describe("Global Error Handling", () => {
  const app = express();
  app.use(createResponseMiddleware());

  // Route that throws a generic error
  app.get("/err-generic", () => {
    throw new Error("Something went wrong");
  });

  // Route that throws a simulated Mongoose Validation Error
  app.get("/err-validation", () => {
    // Creating a real Mongoose ValidationError
    const validationError = new mongoose.Error.ValidationError();
    validationError.addError(
      "email",
      new mongoose.Error.ValidatorError({
        message: "Invalid email",
        path: "email",
      })
    );
    throw validationError;
  });

  // Route that throws a cast error
  app.get("/err-cast", () => {
    const error: any = new Error("Cast to ObjectId failed");
    error.name = "CastError";
    error.path = "_id";
    error.value = "123-invalid";
    throw error;
  });

  // Route that throws a duplicate key error
  app.get("/err-duplicate", () => {
    const error: any = new Error("E11000 duplicate key error collection");
    error.name = "MongoServerError";
    error.code = 11000;
    error.keyValue = { email: "test@example.com" };
    throw error;
  });

  app.use(createErrorMiddleware());

  it("should catch generic errors and return 500", async () => {
    const res = await request(app).get("/err-generic");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Something went wrong");
  });
  it("should format Mongoose validation errors correctly", async () => {
    const res = await request(app).get("/err-validation");
    expect(res.status).toBe(400);
  });
  it("should format Mongoose cast errors correctly", async () => {
    const res = await request(app).get("/err-cast");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.message).toContain("Invalid ID format");
  });
  it("should handle MongoDB duplicate key errors (11000)", async () => {
    const res = await request(app).get("/err-duplicate");
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe("email");
  });
});
