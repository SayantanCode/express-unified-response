# express-unified-response

[![npm version](https://img.shields.io/npm/v/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![npm downloads](https://img.shields.io/npm/dm/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![license](https://img.shields.io/npm/l/express-unified-response)](LICENSE)

<!-- [![node](https://img.shields.io/node/v/express-unified-response)](https://nodejs.org) -->

![express](https://img.shields.io/badge/express-middleware-black)
![typescript](https://img.shields.io/badge/typescript-supported-blue)

# 🚀 Express Smart Response & Error Toolkit

A production-ready toolkit for standardized API responses, centralized error handling, smart pagination, DTO transforms, and adapter-based error normalization in Express applications.

Built-in integrations include Mongoose, JWT, Multer, Axios, and custom error adapters.

## Why express-unified-response?

Most Express applications eventually end up with:

- ❌ Different response formats across routes
- ❌ Repeated error-handling logic
- ❌ ORM-specific error conversion scattered across the codebase
- ❌ Inconsistent pagination responses
- ❌ Duplicate DTO transformation code
- ❌ Logging logic spread across middleware and controllers

express-unified-response centralizes these concerns into a single, configurable middleware layer while keeping your route handlers clean and predictable.

## Features

| Feature                    | Supported |
| -------------------------- | --------- |
| Unified Responses          | ✅        |
| Centralized Error Handling | ✅        |
| Custom Error Classes       | ✅        |
| Built-in Error Adapters    | ✅        |
| Custom Error Adapters      | ✅        |
| DTO Transforms             | ✅        |
| Query Pagination           | ✅        |
| Aggregate Pagination       | ✅        |
| TypeScript                 | ✅        |
| Logger Hooks               | ✅        |

## Architecture

Request
→ Route Handler
→ Response Helpers
→ Error Adapters
→ Error Middleware
→ Standardized JSON Response

## Before vs After

## Before

```js
try {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.status(200).json({ success: true, data: user });
} catch (err) {
  next(err);
}
```

## After

```js
const user = await User.findById(req.params.id);
if (!user) {
  throw new NotFoundError("User not found");
}
res.success(user, "User fetched successfully");
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "123",
    "name": "John Doe"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Required"
      }
    ]
  }
}
```

## Core Features

### ✅ Unified API responses

- Standard success, created, updated, deleted responses
- Consistent response structure across all endpoints
- Configurable response keys
- Built-in REST semantics
- DTO transform support

### ❌ Centralized error handling

- Custom AppError hierarchy
- Automatic error normalization
- Safe production defaults
- Operational vs non-operational error separation
- Stack trace filtering

### 🔌 Built-in Error Adapters

Errors from common libraries are automatically normalized.

Supported integrations:
| Integration | Supported |
|------------|------------|
| Mongoose | ✅ |
| JWT | ✅ |
| Multer | ✅ |
| Axios | ✅ |
| Custom Adapters | ✅ |

### Automatically handled:

- Mongoose ValidationError
- Mongoose CastError
- Mongoose Duplicate Key (11000)
- JsonWebTokenError
- TokenExpiredError
- Multer upload errors
- Axios request errors

### 📄 Smart Pagination

- Query pagination
- Aggregate pagination
- DTO transforms
- Maximum page size protection
- Consistent pagination metadata

### 🧠 Middleware Extensions

Methods are attached directly to the Express response object:

- `res.success()`
- `res.created()`
- `res.updated()`
- `res.deleted()`
- `res.list()`
- `res.paginateQuery()`
- `res.paginateAggregate()`

### ⚙️ Fully configurable

- Rename response keys
- Customize pagination labels
- Control REST defaults
- Plug in custom logging
- Enable/disable stack traces
- Register custom error adapters

## 📦 Installation

```bash
npm install express-unified-response
```

> Requirements

- Node.js ≥ 20
- Express ≥ 4

## 🔧 Basic Setup

```js
import express from "express";
import {
  createResponseMiddleware,
  createErrorMiddleware,
} from "express-unified-response";

const app = express();

app.use(express.json());

// Attach response helpers
app.use(createResponseMiddleware());

// Your routes go here...

// Central error handler (must be last)
app.use(createErrorMiddleware());

export default app;
```

## 🟢 USING RESPONSE HELPERS

The library follows two intuitive argument patterns:

Standard: (Data, Message, Options)

Paginated: (Data/Model, Options, Message)

### Success & Created

```js
// Simple usage
res.success(user, "User fetched successfully");

// With Transform (DTO) and Silent Logging
res.success(user, "OK", {
  transform: (u) => ({ id: u._id, name: u.name }),
  silent: true,
});

res.created(newUser, "User created");
```

### Updated & Deleted

The toolkit handles REST semantics automatically. If data is provided, it returns `200`. If data is null/empty, it returns `204`.

```js
// Returns 200 + Body
res.updated(updatedUser, "User updated");

// Returns 204 No Content (No body)
res.updated(null);

// Message-only: Returns 200 + Message (Skips data when 1st arg is null/undefined/`_`)
res.updated(null, "Password changed successfully");

res.deleted(null, "User deleted");
```

### List (Paginated or Non Paginated)

Standardizes array responses. Non-paginated lists still receive a meta block for frontend consistency.

```js
res.list(
  users,
  {
    paginate: true,
    page: 1,
    limit: 10,
    transform: (u) => ({ id: u._id, name: u.name }),
  },
  "Users fetched successfully",
);
```

### Paginated Query & Aggregate

```js
await res.paginateQuery(
  UserModel,
  {
    page: 1,
    limit: 10,
    filter: { isActive: true },
    populate: "profile",
    transform: (doc) => ({ id: doc._id, email: doc.email }),
  },
  "Active users fetched",
);

await res.paginateAggregate(
  UserModel,
  {
    pipeline: [{ $match: { score: { $gt: 80 } } }],
    transform: (doc) => ({ id: doc._id, score: doc.score }),
  },
  "High scorers fetched",
);
```

## ❌ THROWING ERRORS

You can throw custom errors anywhere in your logic; the error middleware will catch and format them.

```js
import { NotFoundError } from "express-unified-response";

app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.success(user);
});
```

### 🧱 Available Error Classes

<table> 
  <thead> 
    <tr> 
      <th>Category</th> 
      <th>Error Class</th> 
      <th>HTTP Status</th> 
    </tr> 
  </thead>
  <tbody> 
    <tr> 
      <td rowspan="4"><b>Client (4xx)</b></td> <td><code>BadRequestError</code></td> <td><code>400</code></td> 
    </tr>
    <tr> 
      <td><code>ValidationError</code></td> <td><code>400</code></td> 
    </tr> 
    <tr> 
      <td><code>NotFoundError</code></td> 
      <td><code>404</code></td> 
    </tr> 
    <tr> 
      <td><code>RateLimitError</code></td> 
      <td><code>429</code></td> 
    </tr> 
    <tr> 
      <td rowspan="3"><b>Security</b></td> <td><code>UnauthorizedError</code></td> <td><code>401</code></td> 
    </tr> 
    <tr> 
      <td><code>TokenExpiredError</code></td> <td><code>401</code></td> 
    </tr> 
    <tr> 
      <td><code>ForbiddenError</code></td> 
      <td><code>403</code></td> 
    </tr> 
    <tr> 
      <td rowspan="3"><b>Server (5xx)</b></td> <td><code>ExternalServiceError</code></td> <td><code>502</code></td> 
    </tr> 
    <tr> 
      <td><code>DatabaseError</code></td> 
      <td><code>503</code></td> 
    </tr> 
    <tr> 
      <td><code>AppError</code> (Base)</td> <td><code>500</code></td> 
    </tr> 
  </tbody> 
</table>

### ✨ Automatic Mongoose & JWT Mapping

You don't always have to throw these manually. The middleware automatically detects and converts:

- **Mongoose:** `ValidationError`, `CastError`, and `DuplicateKey (11000)` are converted to their respective 400 classes.
- **JWT:** `TokenExpiredError` and `JsonWebTokenError` are mapped to 401.
- **Multer:** File size limits and unexpected fields are mapped to `FileUploadError`.

## 🔐 Utility: Async Handler (No Try/Catch)

The toolkit provides a `asyncHandler` utility to catch async errors without try-catch blocks.

```js
import { asyncHandler } from "express-unified-response";

app.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await User.find();
    res.list(users);
  }),
);
```

## ⚙️ Full Configuration

```js
const config = {
  keys: {
    successKey: "success",
    dataKey: "data",
    metaKey: "meta",
    messageKey: "msg",
    errorKey: "err",
  },
  pagination: {
    defaults: {
      page: 1,
      limit: 10,
      maxLimit: 50, // safe limit for paginated lists, limit can never exceed this
    },
    labels: {
      nextPage: "next",
      prevPage: "prev",
      totalDocs: "totalItems",
      docs: "items",
      totalPages: "totalPages",
      limit: "perPage",
      page: "currentPage",
      hasPrevPage: "hasPrev",
      hasNextPage: "hasNext",
    },
  },
  restDefaults: {
    deleteReturnsNoContent: true, // true for 204, false for 200
    updateReturnsBody: true, // true for 200, false for 204
    nonPaginatedMaxItems: 1000, // safe limit for non-paginated lists
  },
  logger: {
    onSuccess: (req, status, duration) =>
      console.log(`✔ ${req.method} ${status} (${duration}ms)`),
    onError: (req, err, status) => console.error(`✖ ${err.code} [${status}]`),
  },
  silent: process.env.NODE_ENV === 'production', //[new] disable logging from middleware
  adapters: [
    (err) => err.code === 'P2002' ? new AppError('Conflict', 409, 'DB_ERR') : null // like this
  ] // [new] custom error adapters
  routeNotFound: true,
  error: {
    exposeStack: `${process.env.NODE_ENV}` !== "production",
    exposeErrorName: false,
    defaultErrorMessage: "An unexpected error occurred",
  },
};
app.use(createResponseMiddleware(config));
app.use(createErrorMiddleware(config));
```

> `Note:` Pass the same config to `createErrorMiddleware(config)`. to make them consistent.

## 🔒 Security & Error Handling Best Practices

### Stack Traces

Stack traces are **filtered by default** to hide internal `node_modules` paths. This prevents:

- Exposing sensitive file system paths
- Leaking library versions and internal implementation details
- Confusing API users with ugly error output

When `exposeStack: true`, stack traces show only your application code, not framework internals:

```json
{
  "success": false,
  "message": "An unexpected error occurred",
  "error": {
    "code": "INTERNAL_ERROR",
    "stack": "Error: Cannot read property 'name' of undefined\n    at getUserById (/src/routes/users.ts:42:10)\n    at processRequest (/src/middleware/handler.ts:15:5)"
  }
}
```

### Non-Operational vs Operational Errors

- **Operational Errors** (e.g., validation failures, not found): Client caused; safe to expose details
- **Non-Operational Errors** (e.g., code bugs, database crashes): Server caused; shows generic message

Non-operational errors are automatically masked to prevent information leakage:

```js
// Code bug (non-operational)
throw new Error("TypeError: Cannot read property 'name' of undefined");
// Client receives: "An unexpected error occurred"
```

### Pagination DoS Protection

Non-paginated endpoints are automatically limited via `nonPaginatedMaxItems`:

```js
// Even if you return huge arrays, only first 1000 items are sent
res.list(millionItems); // Limited to 1000 items
```

### Safe Error Details

Error details undergo circular reference detection and sanitization:

```js
// Before: Object with circular references crashes JSON.stringify
// After: Circular references are safely marked as [Circular Reference]
```

## 🪵 Logging Integration (Morgan, Winston & CloudWatch)

This package is intentionally logger-agnostic: it only calls the configured `logger.onSuccess` and `logger.onError` hooks. That makes it fully compatible with common logging stacks such as `morgan` + `winston` + cloud transports (CloudWatch, Datadog, etc.). Key recommendations:

- Ordering: mount `morgan` first (or an express-winston request logger), then `createResponseMiddleware({ silent: true })`, then routes, and finally `createErrorMiddleware()`.
- Disable built-in console logs in production by passing `silent: true` to `createResponseMiddleware`.
- Use structured logs (JSON) with Winston so cloud providers index fields like `method`, `url`, `status`, `duration`, `reqId`, `error.code`.
- Add a request ID middleware (e.g., `express-request-id`) and include `req.id` in every log for correlation.
- Use `filterStackTrace(err.stack)` if you want to keep stack traces but remove framework noise before shipping to CloudWatch.

Example: Morgan + Winston + CloudWatch (conceptual)

```js
import express from 'express';
import morgan from 'morgan';
import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import { createResponseMiddleware, createErrorMiddleware, filterStackTrace } from 'express-unified-response';
import requestId from 'express-request-id';

const app = express();

// 1) Setup Winston with CloudWatch transport
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new WinstonCloudWatch({
      logGroupName: 'my-app-group',
      logStreamName: 'my-app-stream',
      awsRegion: 'us-east-1',
      // credentials: provide via env or IAM role
    }),
  ],
});

// 2) Request ID for tracing
app.use(requestId());

// 3) Morgan to log combined access logs into Winston
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info('access', { message: msg.trim() }) }
}));

// 4) Use middleware with silent logs (we'll emit via Winston)
app.use(createResponseMiddleware({
  silent: true,
  logger: {
    onSuccess: (req, status, duration) => {
      logger.info('request_success', {
        reqId: (req as any).id,
        method: req.method,
        url: req.originalUrl || req.url,
        status,
        duration,
      });
    },
    onError: (req, err, status, duration) => {
      logger.error('request_error', {
        reqId: (req as any).id,
        method: req.method,
        url: req.originalUrl || req.url,
        status,
        duration,
        code: err.code,
        stack: filterStackTrace(err.stack),
      });
    },
  },
}));

// 5) Your routes
app.get('/ping', (req, res) => res.success({ pong: true }));

// 6) Error middleware last
app.use(createErrorMiddleware({ error: { exposeStack: false } }));

export default app;
```

Notes:

- If you prefer using `express-winston`, it can replace the `morgan` step and automatically format request logs for Winston. Use `silent: true` to avoid duplicate console output.
- CloudWatch works best with structured JSON logs; ensure `winston.format.json()` is used.
- Include fields useful for observability: `reqId`, `userId`, `route`, `method`, `status`, `duration`, `error.code`, `error.details`.

## Custom Error Adapters

You can register custom error adapters to map library-specific errors (Prisma, Postgres, etc.) to AppError instances. Custom adapters execute before built-in adapters and are isolated so failures cannot interrupt request processing.

Example adapter (Prisma unique key):

```js
const prismaAdapter = (err) => {
  if (err && err.code === "P2002") {
    return new AppError("Conflict", 409, "DB_CONFLICT", {
      message: err.message,
    });
  }
  return null; // not handled
};

app.use(createResponseMiddleware({ adapters: [prismaAdapter] }));
app.use(createErrorMiddleware({ adapters: [prismaAdapter] }));
```

Guidelines:

- Adapter signature: (err: unknown) => AppError | null
- Return an AppError instance to stop further processing; return null to continue.
- Adapters are wrapped in try/catch — if one throws, we log it and continue to the next.

## Exports & Types

Main exports:

- createResponseMiddleware(config?)
- createErrorMiddleware(config?)
- asyncHandler(fn)
- AppError and subclasses (NotFoundError, ValidationError, etc.)
- filterStackTrace(stack?) and safeStringify(obj)
- Types: ResponseConfig, ErrorAdapter, PaginatedResult, ErrorDetails

TypeScript users: import types from the package and pass config objects. All public APIs are typed.

## Development & Contributing

Run tests:

```bash
npm install
npm run build
npm test
npm run lint
```

- Build: `npm run build` (tsup)
- Tests: `npm test` (vitest)
- Lint: `npm run lint` (eslint)

Contributions welcome — follow CONTRIBUTING.md for PR guidelines.

## FAQ & Gotchas

Q: Can I use morgan and winston together? A: Yes. Mount morgan before the middleware and use `silent: true` on the middleware to avoid duplicate logs.

Q: Do I need to pass the same config to both response and error middleware? A: Yes — especially important for `adapters`, `keys`, and `error.exposeStack` so behavior is consistent.

Q: How do I include request IDs? A: Use `express-request-id` or similar and include `req.id` in your logger (shown in the example above).

Q: Will stack traces leak sensitive info? A: By default stacks are filtered; set `error.exposeStack` to true only in trusted environments and consider using `filterStackTrace()` before sending to logs.

## 📤 Response Examples

## 📤 Response Examples

Success List (Paginated)

```json
{
  "success": true,
  "data": [{ "id": "123", "score": 90 }],
  "meta": {
    "currentPage": 1,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

Error

```json
{
  "success": false,
  "msg": "Validation failed",
  "err": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "email", "message": "Required" }]
  }
}
```

## 📜 License

MIT License

## 📝 Credits

- [Sayantan Chakraborty](https://github.com/SayantanCode)

## 🌟 Star this project on GitHub

[![Star](https://img.shields.io/github/stars/sayantanCode/express-unified-response?style=social)](https://github.com/sayantanCode/express-unified-response)

## Made with ❤️ by Sayantan Chakraborty
