# express-unified-response

[![npm version](https://img.shields.io/npm/v/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![npm downloads](https://img.shields.io/npm/dm/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![license](https://img.shields.io/npm/l/express-unified-response)](LICENSE)
![express](https://img.shields.io/badge/express-middleware-black)
![typescript](https://img.shields.io/badge/typescript-supported-blue)

A production-ready toolkit for standardized API responses, centralized error handling, smart pagination, DTO transforms, and adapter-based error normalization in Express applications. Built-in integrations include Mongoose, Zod, JWT, Multer, and Axios.

## Why express-unified-response?

Most Express applications eventually end up with:

- ❌ Different response formats across routes
- ❌ Repeated error-handling logic
- ❌ ORM-specific error conversion scattered across the codebase
- ❌ Inconsistent pagination responses
- ❌ Duplicate DTO transformation code
- ❌ Logging logic spread across middleware and controllers

express-unified-response centralizes these concerns into a single, configurable middleware layer while keeping your route handlers clean and predictable.

## Before → After

### Before

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

### After

```js
const user = await User.findById(req.params.id);
if (!user) throw new NotFoundError("User not found");
res.success(user, "User fetched successfully");
```

## Response Format

### Success

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": { "id": "123", "name": "John Doe" }
}
```

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "email", "message": "Required" }]
  }
}
```

## Installation

```bash
npm install express-unified-response
```

**Requirements**

- Node.js ≥ 18 (Express 5 requires it; Express 4 users on Node 18+ are also covered)
- Express ≥ 4

## Quick Setup

```js
import express from "express";
import {
  createResponseMiddleware,
  createErrorMiddleware,
} from "express-unified-response";

const app = express();
app.use(express.json());

// Attach response helpers to res
app.use(createResponseMiddleware());

// Your routes go here...

// Central error handler — must be last
app.use(createErrorMiddleware());
```

> **`routeNotFound` behavior**: By default, the package registers a 404 handler for any unmatched route and returns `{ success: false, error: { code: "ROUTE_NOT_FOUND" } }`. To disable this (if you have your own 404 handler), pass `routeNotFound: false` to `createErrorMiddleware({ routeNotFound: false })`.

---

## Table of Contents

- [Response Helpers](#-response-helpers)
- [Error Handling](#-error-handling)
- [Async Handler](#-async-handler-no-trycatch)
- [Transform Guide](#-transform-guide)
- [Full Configuration](#-full-configuration)
- [Security & Best Practices](#-security--error-handling-best-practices)
- [Logging Integration](#-logging-integration-morgan-winston--cloudwatch)
- [express-rate-limit](#-express-rate-limit-integration)
- [Using Without Mongoose](#-using-without-mongoose-prisma-typeorm-drizzle-pg)
- [Using Error Classes Outside Express](#-using-error-classes-outside-express-cron-jobs-queues-cli-scripts)
- [Custom Error Adapters](#custom-error-adapters)
- [Common Mistakes](#-common-mistakes)
- [FAQ & Gotchas](#-faq--gotchas)
- [Exports & Types](#exports--types)
- [Contributing](#development--contributing)

---

## 🟢 Response Helpers

The library follows two intuitive argument patterns:

- **Standard:** `(data, message, options)`
- **Paginated:** `(model/data, options, message)`

Methods attached directly to the Express response object:

| Method | Status |
|--------|--------|
| `res.success()` | 200 |
| `res.created()` | 201 |
| `res.accepted()` | 202 |
| `res.updated()` | 200 / 204 |
| `res.deleted()` | 200 / 204 |
| `res.noContent()` | 204 |
| `res.list()` | 200 (in-memory array, paginated or not) |
| `res.paginateQuery()` | 200 (Mongoose offset pagination) |
| `res.paginateAggregate()` | 200 (Mongoose aggregate pagination) |
| `res.paginateCursor()` | 200 (Mongoose cursor pagination) |
| `res.paginateRaw()` | 200 (offset pagination for any ORM) |
| `res.paginateCursorRaw()` | 200 (cursor pagination for any ORM) |

### Success & Created

```js
// Simple usage
res.success(user, "User fetched successfully");

// With transform (DTO) — transform always receives the plain object,
// Mongoose _doc is unwrapped automatically before your function is called
res.success(user, "OK", {
  transform: (u) => ({ id: u._id, name: u.name }),
  silent: true,
});

res.created(newUser, "User created");
```

### Accepted (202)

For async operations that are queued and not immediately resolved.

```js
// Queue a background job and tell the client it was accepted
const jobId = await exportQueue.add(req.body);
res.accepted({ jobId }, "Export queued — you will be notified when ready");

// No data needed
res.accepted(null, "Report generation started");
```

### Updated, Deleted & No Content

The toolkit handles REST semantics automatically. If data or a message is provided, it always returns `200`. When neither is provided, the status code follows your `restDefaults` config.

```js
// Returns 200 + Body
res.updated(updatedUser, "User updated");

// No data, no message: returns 200 { success: true } when updateReturnsBody: true (default)
// Returns 204 when updateReturnsBody: false in config
res.updated(null);

// Message-only: returns 200 + Message
res.updated(null, "Password changed successfully");

res.deleted(null, "User deleted");

// Explicit 204 No Content — for non-delete endpoints that return no body
// Use this instead of res.deleted() when the operation is not a delete
await processJob(req.params.id);
res.noContent();

// With silent flag
res.noContent({ silent: true });
```

### List (Paginated or Non-Paginated)

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
    page: req.query.page,
    limit: req.query.limit,
    filter: { isActive: true },
    sort: { createdAt: -1 },        // sort order
    projection: { password: 0 },    // exclude fields (MongoDB projection)
    select: "name email role",       // mongoose .select() string (alternative to projection)
    populate: "profile",             // populate a relation
    lean: true,                      // return plain objects instead of Mongoose Documents (faster)
    transform: (doc) => ({ id: doc._id, email: doc.email }),
  },
  "Active users fetched",
);
```

> `lean` and `populate` cannot be combined — Mongoose silently ignores `populate` with `lean`. The package throws `INVALID_QUERY_OPTIONS` immediately if both are set.

**Performance options** — for large collections:

```js
// skipCount: skip the COUNT query entirely — totalDocs/totalPages will be -1.
// Use for infinite scroll where total is not needed.
await res.paginateQuery(UserModel, {
  page: req.query.page, limit: 20,
  skipCount: true,
}, "Next page");

// useEstimatedCount: use estimatedDocumentCount() instead of countDocuments().
// Much faster on large unfiltered collections — do NOT combine with filter.
await res.paginateQuery(UserModel, {
  page: req.query.page, limit: 20,
  useEstimatedCount: true,
  // filter: { active: true }  ← don't do this — estimatedDocumentCount ignores filters
}, "Users");
```

```js
await res.paginateAggregate(
  UserModel,
  {
    pipeline: [{ $match: { score: { $gt: 80 } } }],
    transform: (doc) => ({ id: doc._id, score: doc.score }),
    allowDiskUse: true,   // required for pipelines that exceed MongoDB's 100 MB memory limit
    skipCount: true,      // skip the count pipeline entirely
  },
  "High scorers fetched",
);
```

### Cursor Pagination

Use this for large collections where offset pagination gets slow. No `totalDocs` or page count — the client uses `nextCursor` from the response to fetch the next page.

```js
await res.paginateCursor(
  PostModel,
  {
    cursor: req.query.cursor,      // undefined on first request
    limit: req.query.limit,
    filter: { published: true },
    cursorField: "_id",            // field to paginate on (default: "_id")
    cursorDirection: "asc",        // "asc" = oldest-first ($gt), "desc" = newest-first ($lt)
    populate: "author",
    select: "title author createdAt",
    lean: true,
  },
  "Posts fetched",
);
```

**Newest-first feed** (social feed, notifications):

```js
// cursorDirection: "desc" uses $lt — each page fetches items older than the cursor
await res.paginateCursor(
  PostModel,
  {
    cursor: req.query.cursor,
    limit: 20,
    cursorDirection: "desc",      // newest-first
    filter: { published: true },
    sort: { createdAt: -1 },      // ensure consistent ordering
  },
  "Feed loaded",
);
```

Response:
```json
{
  "success": true,
  "data": [{ "id": "...", "title": "..." }],
  "meta": {
    "nextCursor": "6654abc123...",
    "hasNextPage": true,
    "limit": 20
  },
  "message": "Posts fetched"
}
```

On subsequent requests, pass `nextCursor` as the `cursor` option. When `hasNextPage` is `false`, there are no more results.

> `page` and `limit` query params passed as strings are accepted automatically — no need to call `Number()` yourself.

---

## 🔴 Error Handling

You can throw custom errors anywhere in your route logic; the error middleware catches and formats them automatically.

```js
import { NotFoundError } from "express-unified-response";

app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError("User not found");
  res.success(user);
});
```

### Error Classes

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
      <td rowspan="6"><b>Client (4xx)</b></td>
      <td><code>BadRequestError</code></td><td><code>400</code></td>
    </tr>
    <tr><td><code>ValidationError</code></td><td><code>400</code></td></tr>
    <tr><td><code>FileUploadError</code></td><td><code>400</code></td></tr>
    <tr><td><code>NotFoundError</code></td><td><code>404</code></td></tr>
    <tr><td><code>MethodNotAllowedError</code></td><td><code>405</code></td></tr>
    <tr><td><code>PayloadTooLargeError</code></td><td><code>413</code></td></tr>
    <tr>
      <td><b>Rate Limiting</b></td>
      <td><code>RateLimitError</code></td><td><code>429</code></td>
    </tr>
    <tr>
      <td rowspan="4"><b>Security</b></td>
      <td><code>UnauthorizedError</code></td><td><code>401</code></td>
    </tr>
    <tr><td><code>TokenExpiredError</code></td><td><code>401</code></td></tr>
    <tr><td><code>InvalidTokenError</code></td><td><code>401</code></td></tr>
    <tr><td><code>ForbiddenError</code></td><td><code>403</code></td></tr>
    <tr>
      <td rowspan="3"><b>Server (5xx)</b></td>
      <td><code>ExternalServiceError</code></td><td><code>502</code></td>
    </tr>
    <tr><td><code>DatabaseError</code></td><td><code>503</code></td></tr>
    <tr><td><code>AppError</code> (Base)</td><td><code>500</code></td></tr>
  </tbody>
</table>

### Automatic Error Mapping

You don't always have to throw these manually. The middleware automatically detects and converts errors from common libraries:

| Library | What's detected | Mapped to |
|---------|----------------|-----------|
| **Mongoose** | `ValidationError`, `CastError`, duplicate key (11000) | Respective 400 classes |
| **Zod** | `ZodError` (all issues mapped to `details[]`) | `ValidationError` |
| **JWT** | `TokenExpiredError`, `JsonWebTokenError` | 401 |
| **Multer** | `LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE` | `FileUploadError` |
| **Axios** | Network/API errors | `ExternalServiceError` (502) |
| **body-parser** | `entity.too.large`, `entity.parse.failed` | `PayloadTooLargeError` (413), `BadRequestError` (400) |

> **Multer note:** Only Multer-specific codes are auto-detected. Other upload packages (AWS S3, Cloudinary, formidable) need a [custom upload adapter](#file-upload-adapters).

```js
// Zod example — no try/catch needed
import { z } from "zod";
const schema = z.object({ email: z.string().email(), age: z.number().min(18) });

app.post("/register", asyncHandler(async (req, res) => {
  const body = schema.parse(req.body); // ZodError is caught and normalized automatically
  res.created(await User.create(body), "User registered");
}));

// Client receives on validation failure:
// 400 { success: false, message: "Validation failed",
//        error: { code: "VALIDATION_ERROR", details: [
//          { field: "email", message: "Invalid email", code: "invalid_string" },
//          { field: "age",   message: "Number must be greater than or equal to 18", code: "too_small" }
//        ]}}
```

---

## 🔐 Async Handler (No Try/Catch)

`asyncHandler` wraps your route handlers so async errors propagate to the error middleware automatically — no try/catch needed.

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

> Express 5 catches async errors natively — `asyncHandler` is mainly needed for Express 4 routes and Mongoose pre/post hooks.

---

## 🔄 Transform Guide

Transforms shape your data before it hits the response. Here is exactly what your function receives and when it is called.

### What transform receives

**Mongoose single document** — `_doc` is automatically unwrapped before your function is called. You get a plain object, not a Mongoose Document:

```js
const user = await User.findOne({ email: "john@example.com" });

res.success(user, "Found", {
  transform: (u) => {
    // u is the plain _doc object — no Mongoose internals
    return { id: u._id, name: u.name };
  }
});
```

**Array of documents** — transform is called once per item, each item is `_doc`-unwrapped individually. The second argument is the item's index in the array (always `0` for single-object calls like `res.success`) — existing single-argument transform functions keep working unchanged:

```js
res.success(await User.find(), "Found", {
  transform: (u, i) => ({ position: i, id: u._id, name: u.name })
  // called once per user in the array, i = 0, 1, 2, ...
});
```

**`null` or `undefined`** — transform is NOT called. Data is passed through as-is:

```js
const user = await User.findOne({ email: "ghost@example.com" }); // null
res.success(user, "OK", {
  transform: (u) => u.id  // never called — no crash
});
// Response: { success: true, data: null, message: "OK" }
// Better practice: throw NotFoundError before reaching this point
```

### Nested structures

Transform receives the entire data shape. If your object has arrays inside, you handle them in your function:

```js
const user = await User.findOne({}).populate("posts");

res.success(user, "Found", {
  transform: (u) => ({
    id: u._id,
    name: u.name,
    // u.posts are populated Mongoose docs — map them yourself
    posts: u.posts.map(p => ({ id: p._id, title: p.title }))
  })
});
```

Populated nested documents (like `u.posts`) are not individually `_doc`-unwrapped by the middleware, but Mongoose's own `toJSON` handles their serialization correctly if you don't transform them — because they're left as real Mongoose Document instances, and `JSON.stringify` calls `.toJSON()` on any nested value that has one.

The *top-level* document you pass in doesn't get this benefit: it's unwrapped to plain `_doc` **before** `JSON.stringify` ever runs, so by the time serialization happens it's already a plain object with no `.toJSON()` to call. This is why a schema-level `toJSON` transform on the top-level document never runs through this package — see [Common Mistake #9](#-common-mistakes) below.

### If transform throws

The error is caught, passed to `next(err)`, and reaches your error middleware as a `500 TRANSFORM_ERROR` — it never crashes the process:

```js
res.success(user, "OK", {
  transform: (u) => u.nonExistent.deeply.nested  // throws TypeError
  // Client gets: 500 { success: false, message: "Transform function threw: ..." }
});
```

For arrays, each item is transformed independently — a throw on one item doesn't affect the others' *processing*, but since the whole response fails as one `TRANSFORM_ERROR`, the error message tells you exactly which item broke (its index, and `_id`/`id` if present), so you're not left guessing which of N items in a large or deeply nested array caused it:

```js
res.list(users, {
  transform: (u) => ({ id: u._id, postCount: u.posts.length }) // throws if u.posts is null
});
// Client gets: 500 { message: "Transform function threw at index 42, id: 664f...: Cannot read properties of null (reading 'length')" }
```

### Transform is for output shaping only

```js
// ✅ Correct — shape the output
transform: (u) => ({ id: u._id, fullName: `${u.firstName} ${u.lastName}` })

// ❌ Wrong — side effects or business logic inside transform
transform: async (u) => {
  await Analytics.track(u._id);  // side effect — use middleware for this
  return { id: u._id };
}

// ❌ Wrong — database calls inside transform
transform: async (u) => {
  const role = await Role.findById(u.roleId);  // extra DB round-trip per item
  return { id: u._id, role: role.name };
  // Populate the role before the response instead
}
```

---

## ⚙ Full Configuration

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
      maxLimit: 50, // limit can never exceed this value
    },
    labels: {
      nextPage: "next",
      prevPage: "prev",
      totalDocs: "totalItems",
      totalPages: "totalPages",
      limit: "perPage",
      page: "currentPage",
      hasPrevPage: "hasPrev",
      hasNextPage: "hasNext",
    },
  },
  restDefaults: {
    deleteReturnsNoContent: true, // true → 204, false → 200
    updateReturnsBody: true,      // true → 200, false → 204
    nonPaginatedMaxItems: 1000,   // safe limit for non-paginated lists
  },
  logger: {
    // "all" logs every request. "error" logs only 4xx/5xx. "none" suppresses everything.
    logLevel: "all",
    onSuccess: (req, status, duration) =>
      console.log(`✔ ${req.method} ${status} (${duration}ms)`),
    onError: (req, err, status) => console.error(`✖ ${err.code} [${status}]`),
    // Routes internal package warnings (e.g. useEstimatedCount conflicts, adapter crashes)
    // through your logger instead of leaking to console.warn
    onWarn: (msg, context) => console.warn(`⚠ ${msg}`, context ?? ""),
  },
  // silent: true kills all logging including custom hooks — use for test environments only.
  // For production tuning (suppress 2xx but keep errors), use logger.logLevel instead.
  silent: false,
  adapters: [
    (err) => err.code === 'P2002' ? new AppError('Conflict', 409, 'DB_ERR') : null,
  ], // custom error adapters
  routeNotFound: true,
  error: {
    exposeStack: `${process.env.NODE_ENV}` !== "production", // filtered stack trace in error response
    exposeErrorName: false,  // include error class name (e.g. "TypeError") in error.name field
    defaultErrorMessage: "An unexpected error occurred", // shown for non-operational errors
  },
};

app.use(createResponseMiddleware(config));
app.use(createErrorMiddleware(config));
```

> Pass the same config object to both middlewares to keep response format and error format consistent.

---

## 🔒 Security & Error Handling Best Practices

### Stack Traces

Stack traces are **filtered by default** to hide internal `node_modules` paths. This prevents exposing sensitive file system paths, leaking library versions, and confusing API users with framework internals.

When `exposeStack: true`, stack traces show only your application code:

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

### Operational vs Non-Operational Errors

- **Operational errors** (validation failures, not found): client caused; safe to expose details
- **Non-operational errors** (code bugs, database crashes): server caused; shows generic message

```js
// Runtime bug (non-operational) — message is hidden; client gets defaultErrorMessage
throw new TypeError("Cannot read properties of undefined (reading 'name')");
// Client receives: "An unexpected error occurred"

// Intentional throw with plain Error — message IS shown (operational)
throw new Error("Something went wrong");
// Client receives: "Something went wrong"
```

### Pagination DoS Protection

Non-paginated endpoints are automatically limited via `nonPaginatedMaxItems`:

```js
// Even if you return huge arrays, only the first 1000 items are sent
res.list(millionItems); // Limited to 1000 items
```

### Safe Error Details

Error details undergo circular reference detection and sanitization before serialization — circular references are safely marked as `[Circular Reference]` instead of crashing `JSON.stringify`.

---

## 📓 Logging Integration (Morgan, Winston & CloudWatch)

This package is intentionally logger-agnostic: it calls the configured `logger.onSuccess`, `logger.onError`, and `logger.onWarn` hooks after the response is fully sent. Hooks shallow-merge with defaults — you only need to specify the ones you want to override.

Key recommendations:

- Providing custom hooks replaces the default colored console output — no need for `silent: true`.
- Use `logger.logLevel: "error"` in production to suppress noisy 2xx lines while keeping 4xx/5xx.
- Use `logger.onWarn` to route internal package warnings (adapter crashes, `useEstimatedCount` conflicts) through your own logger so nothing leaks to `console.warn` unexpectedly.
- Use structured logs (JSON) with Winston so cloud providers can index fields like `method`, `url`, `status`, `duration`, `reqId`, `error.code`.
- Add a request ID middleware (e.g., `express-request-id`) and include `req.id` in every log for correlation.
- Use `filterStackTrace(err.stack)` to strip framework noise before shipping stack traces to CloudWatch.
- `silent: true` is a kill-switch that suppresses **all** logging including custom hooks — use it only for test environments, not to replace the default logger.

**Winston + CloudWatch example:**

```js
import express from 'express';
import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import { createResponseMiddleware, createErrorMiddleware, filterStackTrace } from 'express-unified-response';
import requestId from 'express-request-id';

const app = express();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new WinstonCloudWatch({
      logGroupName: 'my-app-group',
      logStreamName: 'my-app-stream',
      awsRegion: 'us-east-1',
    }),
  ],
});

app.use(requestId());

app.use(createResponseMiddleware({
  logger: {
    logLevel: "error", // only log 4xx/5xx; remove for full request logging
    onSuccess: (req, status, duration) => {
      logger.info('request', {
        reqId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        status,
        duration,
      });
    },
    onError: (req, err, status, duration) => {
      logger.error('request_error', {
        reqId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        status,
        duration,
        code: err?.code,
        stack: filterStackTrace(err?.stack),
      });
    },
    onWarn: (msg, context) => {
      logger.warn('package_warning', { msg, context });
    },
  },
}));

app.get('/ping', (req, res) => res.success({ pong: true }));

app.use(createErrorMiddleware({ error: { exposeStack: false } }));
```

**Co-existing with Morgan:** mount Morgan before `createResponseMiddleware` and set `logLevel: "none"` to avoid duplicate lines:

```js
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info('access', { message: msg.trim() }) }
}));
app.use(createResponseMiddleware({ logger: { logLevel: "none" } }));
```

Notes:

- CloudWatch works best with structured JSON logs; ensure `winston.format.json()` is used.
- Include fields useful for observability: `reqId`, `userId`, `route`, `method`, `status`, `duration`, `error.code`, `error.details`.

---

## 🚦 express-rate-limit Integration

`express-rate-limit` fires its own `handler` function when a limit is reached, which bypasses your error middleware entirely. Wire it into the package's error pipeline so rate limit responses use the same format as everything else:

```js
import rateLimit from "express-rate-limit";
import { RateLimitError } from "express-unified-response";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  handler: (req, res, next) => {
    next(new RateLimitError("Too many requests — please slow down"));
  },
});

app.use(limiter);
```

Client receives:
```json
{
  "success": false,
  "message": "Too many requests — please slow down",
  "error": { "code": "TOO_MANY_REQUESTS" }
}
```

> Without wiring the `handler`, `express-rate-limit` sends its own plain-text or HTML response that bypasses your error middleware and looks inconsistent with the rest of your API.

---

## 📡 Using Without Mongoose (Prisma, TypeORM, Drizzle, pg)

All response helpers and error classes work with any ORM or database library. The **only** Mongoose-specific methods are the three paginator helpers:

| Method | Mongoose | Other ORMs |
|--------|----------|------------|
| `res.success/created/updated/deleted/accepted/noContent` | ✅ | ✅ |
| `res.list()` | ✅ | ✅ (any array) |
| `res.paginateQuery()` | ✅ | ❌ |
| `res.paginateAggregate()` | ✅ | ❌ |
| `res.paginateCursor()` | ✅ | ❌ |
| Error auto-normalization | Mongoose, Zod, JWT, Multer, Axios | Zod, JWT, Multer, Axios (ORM errors need adapters) |

### Offset Pagination — Prisma / TypeORM / Drizzle / pg

Use `res.paginateRaw()` — run your own query and hand the results + total count directly to the package. It builds the full pagination envelope without touching the database.

```js
// Prisma example — offset pagination
app.get("/users", asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({ skip, take: limit, where: { active: true } }),
    prisma.user.count({ where: { active: true } }),
  ]);

  await res.paginateRaw(users, total, { page, limit }, "Users fetched");
}));
```

Response:
```json
{
  "success": true,
  "data": [...],
  "meta": { "totalDocs": 50, "totalPages": 5, "page": 1, "hasNextPage": true, ... },
  "message": "Users fetched"
}
```

> **Do not use `res.list()` with `paginate: true` for pre-fetched pages.** `res.list()` paginates its input array in memory — passing already-paginated data will be sliced again and produce an empty array.

### Cursor Pagination — Prisma / TypeORM / Drizzle

Use `res.paginateCursorRaw()` — implement the limit+1 trick in your ORM query, then pass the result:

```js
// Prisma cursor pagination
app.get("/posts", asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const cursor = req.query.cursor;

  const posts = await prisma.post.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  const hasNextPage = posts.length > limit;
  if (hasNextPage) posts.pop();

  const nextCursor = hasNextPage ? posts[posts.length - 1].id : null;

  await res.paginateCursorRaw(
    posts,
    { nextCursor, hasNextPage, limit },
    {},
    "Posts fetched"
  );
}));
```

> Passing a non-Mongoose object to `res.paginateQuery()` throws `INVALID_MODEL` immediately with a clear message instead of a confusing TypeError.

### Error Normalization for Other ORMs

ORM-specific errors (Prisma `P2002`, TypeORM `QueryFailedError`, pg `23505`) are not auto-handled. Register a custom adapter — see [Custom Error Adapters](#custom-error-adapters) below.

Without an adapter, ORM errors that are not `AppError` subclasses fall through to the generic handler. Since they are named errors (e.g. `PrismaClientKnownRequestError`), they are treated as non-operational and the client receives your configured `defaultErrorMessage` instead of the raw ORM message.

---

## 🔁 Using Error Classes Outside Express (Cron Jobs, Queues, CLI Scripts)

`core/` has zero dependency on Express — `AppError`, `createAppError`, and every error
class are plain, framework-agnostic code. You can use them anywhere you want structured,
consistent errors, even with no `res` to respond to: BullMQ/Agenda job processors,
node-cron tasks, CLI scripts, or any background worker.

```js
// worker.js — a BullMQ job processor, no Express involved
import { createAppError } from "express-unified-response";

async function processExportJob(job) {
  try {
    const user = await User.findById(job.data.userId);
    if (!user) throw new Error("User not found for export");
    await generateExport(user);
  } catch (err) {
    // Same Mongoose/Zod/etc. normalization the HTTP middleware uses —
    // useful for consistent structured logging even without a response to send.
    const appError = createAppError(err);
    logger.error({ code: appError.code, message: appError.message, jobId: job.id });
    throw appError; // let the queue's own retry mechanism handle it
  }
}
```

`createResponseMiddleware`/`createErrorMiddleware` are Express-only — everything else in
`core/` (errors, `createAppError`) works standalone.

---

## Custom Error Adapters

You can register custom error adapters to map library-specific errors to `AppError` instances. Custom adapters execute before built-in adapters and are isolated — if one throws, it is logged and skipped, never interrupting request processing.

**Prisma adapter** (covers the most common Prisma errors):

```js
import { AppError, NotFoundError, ValidationError } from "express-unified-response";

const prismaAdapter = (err) => {
  if (!err || typeof err !== "object") return null;

  switch (err.code) {
    case "P2002": // Unique constraint violation
      return new AppError("Duplicate value — a record with this value already exists", 409, "DB_CONFLICT", {
        field: err.meta?.target?.[0] ?? "unknown",
      });
    case "P2025": // Record not found
      return new NotFoundError(err.meta?.cause ?? "Record not found");
    case "P2003": // Foreign key constraint
      return new ValidationError("Related record does not exist", [{
        field: err.meta?.field_name ?? "unknown",
        message: "Foreign key constraint failed",
      }]);
    default:
      return null;
  }
};

const config = { adapters: [prismaAdapter] };
app.use(createResponseMiddleware(config));
app.use(createErrorMiddleware(config));
```

**TypeORM adapter:**

```js
const typeormAdapter = (err) => {
  if (err?.name === "QueryFailedError" && err?.driverError?.code === "23505") {
    return new AppError("Duplicate entry", 409, "DB_CONFLICT");
  }
  if (err?.name === "EntityNotFoundError") {
    return new NotFoundError(err.message);
  }
  return null;
};
```

#### File upload adapters

Built-in detection only covers Multer error codes. If you upload to S3, Cloudinary, or use formidable/express-fileupload directly, add one of these adapters.

**AWS S3** (`@aws-sdk/client-s3`):

```js
import { FileUploadError, ExternalServiceError, UnauthorizedError } from "express-unified-response";

const s3Adapter = (err) => {
  // AWS SDK v3 — all S3 errors have $fault and $metadata
  if (!err?.$fault || !err?.$metadata) return null;

  switch (err.name) {
    case "NoSuchBucket":
    case "NoSuchKey":
      return new FileUploadError("Upload destination not found");
    case "AccessDenied":
      return new FileUploadError("Storage access denied");
    case "EntityTooLarge":
      return new FileUploadError("File exceeds S3 bucket size limit");
    default:
      return new ExternalServiceError("S3 error", { message: err.message });
  }
};
```

**Cloudinary** (`cloudinary` SDK):

```js
import { FileUploadError, UnauthorizedError, ExternalServiceError } from "express-unified-response";

const cloudinaryAdapter = (err) => {
  if (typeof err?.http_code !== "number") return null;

  switch (err.http_code) {
    case 400: return new FileUploadError(err.message ?? "Invalid upload");
    case 401:
    case 403: return new UnauthorizedError("Cloudinary authentication failed");
    case 413: return new FileUploadError("File exceeds Cloudinary size limit");
    default:  return new ExternalServiceError("Cloudinary error", { message: err.message });
  }
};
```

**formidable** (used directly or via `express-fileupload`):

```js
import { FileUploadError, BadRequestError } from "express-unified-response";

const formidableAdapter = (err) => {
  // formidable uses numeric codes — https://github.com/node-formidable/formidable#options
  if (typeof err?.code !== "number") return null;

  switch (err.code) {
    case 1009: return new FileUploadError("File size limit exceeded");
    case 1001: return new BadRequestError("Too many form fields");
    case 1002: return new FileUploadError("Total upload size limit exceeded");
    default:   return new FileUploadError(err.message ?? "File upload failed");
  }
};
```

**Adapter guidelines:**

- Signature: `(err: unknown) => AppError | null`
- Return an `AppError` instance to stop further processing; return `null` to pass to the next adapter.
- Adapters run before built-in detection (Mongoose, Zod, JWT, etc.).
- Adapters are wrapped in try/catch — a crash is logged and the next adapter runs.

---

## ❌ Common Mistakes

### 1. Passing null from `findOne()` without throwing

```js
// ❌ Wrong
const user = await User.findById(req.params.id);
res.success(user, "Found");  // user could be null → data: null in response

// ✅ Correct
const user = await User.findById(req.params.id);
if (!user) throw new NotFoundError("User not found");
res.success(user, "Found");
```

### 2. Using `res.success()` for arrays

```js
// ❌ Wrong — no pagination metadata, no DoS protection
const users = await User.find();
res.success(users, "Users");

// ✅ Correct — use list for in-memory arrays
res.list(users, { paginate: true, page: req.query.page, limit: req.query.limit }, "Users");

// ✅ Correct — use paginateQuery for Mongoose
await res.paginateQuery(UserModel, { page: req.query.page, limit: req.query.limit }, "Users");
```

### 3. Throwing runtime error types intentionally

```js
// ❌ Wrong — TypeError/RangeError/ReferenceError are non-operational.
// Their messages are hidden and client gets the generic defaultErrorMessage.
throw new TypeError("Invalid input format");

// ✅ Correct — use AppError subclasses for client-facing errors
throw new BadRequestError("Invalid input format");
// or
throw new AppError("Invalid input format", 400, "INVALID_FORMAT");
```

### 4. Forgetting `asyncHandler` on async routes (Express 4)

```js
// ❌ Wrong — unhandled promise rejection, error never reaches error middleware
app.get("/users", async (req, res) => {
  const users = await User.find();  // if this throws, Express 4 won't catch it
  res.list(users);
});

// ✅ Correct
import { asyncHandler } from "express-unified-response";
app.get("/users", asyncHandler(async (req, res) => {
  const users = await User.find();
  res.list(users);
}));
// Note: Express 5 catches async errors natively, asyncHandler is optional there
```

### 5. Building your own error responses instead of throwing

```js
// ❌ Wrong — bypasses error normalization, logging, and consistent format
if (!user) {
  return res.status(404).json({ success: false, message: "Not found" });
}

// ✅ Correct — throw and let the middleware handle it
if (!user) throw new NotFoundError("User not found");
```

### 6. Not passing the same config to both middlewares

```js
// ❌ Wrong — adapters and keys apply to responses only, not to errors
app.use(createResponseMiddleware({ adapters: [prismaAdapter], keys: { dataKey: "result" } }));
app.use(createErrorMiddleware());  // errors use different config → inconsistent format

// ✅ Correct
const config = { adapters: [prismaAdapter], keys: { dataKey: "result" } };
app.use(createResponseMiddleware(config));
app.use(createErrorMiddleware(config));
```

### 7. Using `paginateRaw` with already-sliced data

```js
// ❌ Wrong — passing pre-sliced page to res.list() with paginate: true slices it again
const users = await prisma.user.findMany({ skip, take: limit });
res.list(users, { paginate: true, page, limit }, "Users"); // re-slices → empty result

// ✅ Correct — use paginateRaw for pre-fetched paginated data
await res.paginateRaw(users, total, { page, limit }, "Users");
```

### 8. Cursor pagination — treating nextCursor as a page number

```js
// ❌ Wrong
await res.paginateCursor(PostModel, { cursor: req.query.page });

// ✅ Correct — cursor is the string from the previous response's meta.nextCursor
await res.paginateCursor(PostModel, { cursor: req.query.cursor });
// First request: omit cursor or pass undefined
// Subsequent requests: pass the nextCursor string from the previous response
```

### 9. Relying on your schema's `toJSON` transform to hide sensitive fields

```js
// ❌ Wrong — schema.toJSON transform is silently bypassed
schema.set("toJSON", { transform: (_doc, ret) => { delete ret.password; return ret; } });

const user = await User.findById(req.params.id);
res.success(user);
// password leaks — res.success()/created()/updated()/deleted() unwrap Mongoose's
// internal _doc directly for convenience, whether or not you pass a transform option.
// That skips toJSON()/toObject() entirely, so schema-level transforms and virtuals
// never run.

// ✅ Correct — put sensitive fields behind select: false at the schema level
const userSchema = new Schema({ password: { type: String, select: false } });
// select: false means password is never fetched from the DB in the first place —
// nothing in _doc to leak, regardless of any serialization path.

// ✅ Also correct — shape the DTO explicitly with transform
res.success(user, "Found", {
  transform: (u) => ({ id: u._id, name: u.name, email: u.email }), // password intentionally omitted
});
```

> Don't rely on a schema's `toJSON` transform (or virtuals) to hide/shape fields when passing a document straight to `res.success`/`created`/`updated`/`deleted`. Use `select: false` for anything sensitive, or shape the response explicitly with `transform`.

---

## ❔ FAQ & Gotchas

**Q: Can I use Morgan and Winston together?**
A: Yes. Mount Morgan before `createResponseMiddleware`, then set `logger: { logLevel: "none" }` on the middleware so its built-in request lines don't duplicate what Morgan already logs. Alternatively, skip Morgan and provide `logger.onSuccess`/`logger.onError` hooks to route everything through Winston yourself.

**Q: Do I need to pass the same config to both middlewares?**
A: Yes — especially important for `adapters`, `keys`, and `error.exposeStack` so behavior is consistent. See Common Mistake #6 above.

**Q: How do I include request IDs?**
A: Use `express-request-id` or similar and include `req.id` in your logger (shown in the Winston example above).

**Q: Will stack traces leak sensitive info?**
A: By default stacks are filtered — `node_modules` and `node:` internal frames are stripped. Set `error.exposeStack: true` only in trusted environments and consider using `filterStackTrace()` before sending to external log services.

**Q: Do I need `asyncHandler` in Express 5?**
A: No — Express 5 catches async errors natively. `asyncHandler` is mainly needed for Express 4 routes and Mongoose pre/post hooks.

**Q: What happens if `findOne()` returns null and I don't check?**
A: `res.success(null)` sends `{ success: true, data: null }` — not a 404. Always check and throw `NotFoundError`. See Common Mistake #1 above.

**Q: My transform is crashing — what error do I get?**
A: A `500 TRANSFORM_ERROR` with the thrown message. It reaches your error middleware cleanly and won't crash the process.

---

## Exports & Types

**Main exports:**

- `createResponseMiddleware(config?)`
- `createErrorMiddleware(config?)`
- `asyncHandler(fn)`
- `filterStackTrace(stack?)` — strips `node_modules` and `node:` internals from a stack string
- `safeStringify(obj)` — JSON serialization with circular reference protection
- `createAppError(err, adapters?)` — converts any thrown value into an `AppError` using the same detection logic the error middleware uses; useful in tests or custom error pipelines

**Error classes:** `AppError`, `BadRequestError`, `ValidationError`, `NotFoundError`, `FileUploadError`, `MethodNotAllowedError`, `PayloadTooLargeError`, `RateLimitError`, `UnauthorizedError`, `ForbiddenError`, `TokenExpiredError`, `InvalidTokenError`, `ExternalServiceError`, `DatabaseError`, `MongooseValidationError`, `MongooseCastError`, `MongooseDuplicateKeyError`, `MongooseGeneralError`

**Types:** `ResponseConfig`, `ResponseKeyMapping`, `ErrorAdapter`, `PaginatedResult`, `CursorPaginatedResult`, `ErrorDetails`, `ResponseOptions`, `ListOptions`, `QueryOptions`, `AggregateOptions`, `CursorOptions`, `CursorPaginationOptions`, `RawPaginationOptions`, `RawCursorMeta`

TypeScript users: all public APIs are fully typed — import types directly from the package and pass config objects with full IntelliSense support.

---

## Development & Contributing

```bash
npm install
npm run build   # tsup
npm test        # vitest
npm run lint    # eslint
```

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for branch workflow, commit format, and PR guidelines.

---

## License

MIT — [Sayantan Chakraborty](https://github.com/SayantanCode)

[![Star this project](https://img.shields.io/github/stars/sayantanCode/express-unified-response?style=social)](https://github.com/sayantanCode/express-unified-response)
