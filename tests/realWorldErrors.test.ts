import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  createResponseMiddleware,
  createErrorMiddleware,
  asyncHandler,
  ValidationError,
} from "../src/index";

/**
 * Real-world error scenarios:
 * 1. Mongoose pre-hook validation
 * 2. Joi validation
 * 3. JWT errors
 * 4. Reference errors in business logic
 * 5. Type errors in data processing
 */

describe("Real-World Error Scenarios with Stack Traces", () => {
  describe("1. Mongoose Pre-Hook Validation Failure", () => {
    it("should capture stack trace from mongoose pre-hook with line numbers", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.post(
        "/user",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulating a Mongoose pre-hook validation failure
          // This would normally come from a schema.pre('validate', ...) hook
          const error = new Error("Mongoose pre-hook validation failed");
          error.stack = `ValidationError: Pre-hook validation failed
            at validateUserData (/app/src/schemas/user.schema.ts:45:12)
            at Object.<anonymous> (/app/node_modules/mongoose/lib/schematype.js:890:15)
            at checkEmail (/app/src/validators/email.ts:23:8)
            at /app/node_modules/mongoose/lib/document.js:145:3`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).post("/user").send({});

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      // ✅ Stack trace should be filtered
      expect(res.body.error.stack).toBeDefined();
      // ✅ User code should be visible
      expect(res.body.error.stack).toContain("validateUserData");
      expect(res.body.error.stack).toContain(
        "/app/src/schemas/user.schema.ts:45:12",
      );
      expect(res.body.error.stack).toContain("checkEmail");
      expect(res.body.error.stack).toContain(
        "/app/src/validators/email.ts:23:8",
      );
      // ✅ Framework noise should be hidden
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("2. Joi Validation Error", () => {
    it("should capture joi validation error with line numbers", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.post(
        "/validate",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulating Joi validation error
          const error = new Error("Validation failed");
          error.stack = `ValidationError: Email must be valid
    at validateRequest (/app/src/middleware/validators.ts:34:15)
    at joiValidate (/app/src/validators/joi.ts:12:20)
    at /app/node_modules/joi/dist/index.js:156:45
    at processRequest (/app/src/middleware/auth.ts:8:10)
    at /app/node_modules/express/lib/router.js:123:45`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).post("/validate").send({});

      expect(res.status).toBe(500);
      expect(res.body.error.stack).toContain("validateRequest");
      expect(res.body.error.stack).toContain(
        "/app/src/middleware/validators.ts:34:15",
      );
      expect(res.body.error.stack).toContain("joiValidate");
      expect(res.body.error.stack).toContain(
        "/app/src/validators/joi.ts:12:20",
      );
      // ✅ Joi library frames filtered
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("3. JWT Token Validation Error", () => {
    it("should handle JWT TokenExpiredError with stack trace", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.get(
        "/protected",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulate JWT token expiration
          const error = new Error("jwt expired");
          (error as any).name = "TokenExpiredError";
          error.stack = `TokenExpiredError: jwt expired
    at verifyToken (/app/src/middleware/auth.ts:42:18)
    at jwtVerify (/app/src/utils/jwt.ts:15:5)
    at /app/node_modules/jsonwebtoken/verify.js:123:15
    at authenticateUser (/app/src/middleware/authenticateUser.ts:8:10)
    at /app/node_modules/express/lib/router.js:456:32`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).get("/protected");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // ✅ JWT error mapped to 401
      expect(res.body.error.code).toBe("UNAUTHORIZED");

      // ✅ Stack trace still shows user code with line numbers
      expect(res.body.error.stack).toContain("verifyToken");
      expect(res.body.error.stack).toContain(
        "/app/src/middleware/auth.ts:42:18",
      );
      expect(res.body.error.stack).toContain("jwtVerify");
      expect(res.body.error.stack).toContain("/app/src/utils/jwt.ts:15:5");
      expect(res.body.error.stack).not.toContain("node_modules");
    });

    it("should handle JWT JsonWebTokenError with stack trace", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.get(
        "/protected",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulate JWT invalid token
          const error = new Error("invalid signature");
          (error as any).name = "JsonWebTokenError";
          error.stack = `JsonWebTokenError: invalid signature
    at verifyToken (/app/src/middleware/auth.ts:42:18)
    at validateJWT (/app/src/services/auth.ts:67:10)
    at /app/node_modules/jsonwebtoken/verify.js:89:12`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).get("/protected");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.stack).toContain("verifyToken");
      expect(res.body.error.stack).toContain(
        "/app/src/middleware/auth.ts:42:18",
      );
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("4. ReferenceError in Business Logic", () => {
    it("should capture ReferenceError (undefined variable) with exact line", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.get(
        "/users/:id",
        asyncHandler(async (req: Request, res: Response) => {
          // This would be a real ReferenceError thrown by user code
          const error = new Error("user is not defined");
          error.stack = `ReferenceError: user is not defined
    at getUserById (/app/src/routes/users.ts:42:10)
    at getUserWithProfile (/app/src/services/user.ts:156:24)
    at /app/node_modules/express/lib/router.js:456:32
    at Layer.handle_request (/app/node_modules/express/lib/router/layer.js:95:5)`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).get("/users/123");

      expect(res.status).toBe(500);
      // ✅ User functions visible with exact line:column
      expect(res.body.error.stack).toContain("getUserById");
      expect(res.body.error.stack).toContain("/app/src/routes/users.ts:42:10");
      expect(res.body.error.stack).toContain("getUserWithProfile");
      expect(res.body.error.stack).toContain(
        "/app/src/services/user.ts:156:24",
      );
      // ✅ Framework hidden
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("5. TypeError in Data Processing", () => {
    it("should capture TypeError with line numbers", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.post(
        "/process",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulating TypeError: Cannot read property 'name' of undefined
          const error = new Error("Cannot read property 'name' of undefined");
          error.stack = `TypeError: Cannot read property 'name' of undefined
    at processUserData (/app/src/services/user.ts:89:15)
    at transformResponse (/app/src/middleware/transform.ts:23:8)
    at /app/node_modules/express/lib/response.js:890:3
    at Object.<anonymous> (/app/node_modules/lodash/index.js:45:2)`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).post("/process").send({});

      expect(res.status).toBe(500);
      // ✅ User code with line:column visible
      expect(res.body.error.stack).toContain("processUserData");
      expect(res.body.error.stack).toContain("/app/src/services/user.ts:89:15");
      expect(res.body.error.stack).toContain("transformResponse");
      expect(res.body.error.stack).toContain(
        "/app/src/middleware/transform.ts:23:8",
      );
      // ✅ Framework hidden
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("6. Custom Validation Error with Stack Trace", () => {
    it("should preserve custom ValidationError stack traces", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.post(
        "/custom-validate",
        asyncHandler(async (req: Request, res: Response) => {
          // Custom validation error thrown from user code
          const details = [
            { field: "email", message: "Invalid email format" },
            { field: "age", message: "Must be 18 or older" },
          ];

          const error = new ValidationError("Validation failed", details);
          error.stack = `ValidationError: Validation failed
    at validateUserInput (/app/src/validators/userValidator.ts:45:20)
    at validateRequest (/app/src/middleware/validate.ts:12:15)
    at /app/node_modules/express/lib/router.js:123:45`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).post("/custom-validate").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      // ✅ Details preserved
      expect(res.body.error.details).toHaveLength(2);
      expect(res.body.error.details[0].field).toBe("email");
      // ✅ Stack trace clean
      expect(res.body.error.stack).toContain("validateUserInput");
      expect(res.body.error.stack).toContain(
        "/app/src/validators/userValidator.ts:45:20",
      );
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("7. Async Mongoose Operation Failure", () => {
    it("should capture stack from async mongoose operations", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.get(
        "/users",
        asyncHandler(async (req: Request, res: Response) => {
          // Simulate async mongoose error
          const error = new Error("connect ECONNREFUSED 127.0.0.1:27017");
          (error as any).name = "MongooseServerSelectionError";
          error.stack = `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
    at findAllUsers (/app/src/services/userService.ts:12:5)
    at getUsersList (/app/src/routes/users.ts:78:10)
    at /app/node_modules/mongoose/lib/model.js:4890:15
    at /app/node_modules/mongoose/lib/query.js:1234:5
    at async /app/node_modules/express/lib/router.js:456:32`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).get("/users");

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("DATABASE_ERROR");
      // ✅ User code visible with line numbers
      expect(res.body.error.stack).toContain("findAllUsers");
      expect(res.body.error.stack).toContain(
        "/app/src/services/userService.ts:12:5",
      );
      expect(res.body.error.stack).toContain("getUsersList");
      expect(res.body.error.stack).toContain("/app/src/routes/users.ts:78:10");
      // ✅ Mongoose internals hidden
      expect(res.body.error.stack).not.toContain("node_modules");
    });
  });

  describe("8. Stack Trace Fallback (when all frames are filtered)", () => {
    it("should return original stack if all user code is filtered", async () => {
      const app = express();
      app.use(
        createResponseMiddleware({
          error: { exposeStack: true },
        }),
      );

      app.get(
        "/error",
        asyncHandler(async (req: Request, res: Response) => {
          // Edge case: error only from framework (shouldn't happen but handled)
          const error = new Error("Framework error");
          error.stack = `Error: Framework error
    at /app/node_modules/express/lib/router.js:123:45
    at /app/node_modules/express/lib/application.js:890:3
    at (node:internal/events:89:2)`;

          throw error;
        }),
      );

      app.use(
        createErrorMiddleware({
          error: { exposeStack: true },
        }),
      );

      const res = await request(app).get("/error");

      expect(res.status).toBe(500);
      // ✅ Original stack returned as fallback
      expect(res.body.error.stack).toBeDefined();
      expect(res.body.error.stack).toContain("Framework error");
    });
  });
});
