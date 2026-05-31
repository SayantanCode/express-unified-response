# express-unified-response

[![npm version](https://img.shields.io/npm/v/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![npm downloads](https://img.shields.io/npm/dm/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![license](https://img.shields.io/npm/l/express-unified-response)](LICENSE)
<!-- [![node](https://img.shields.io/node/v/express-unified-response)](https://nodejs.org) -->

![express](https://img.shields.io/badge/express-middleware-black)
![typescript](https://img.shields.io/badge/typescript-supported-blue)

# 🚀 Express Smart Response & Error Toolkit

A production-ready response, error handling, and pagination toolkit for Express + Mongoose APIs.
It enforces consistent API responses, centralized error handling, and powerful pagination with minimal boilerplate.

## FEATURES

### ✅ Unified API responses

- Standard success, created, updated, deleted responses
- Configurable response keys (success, data, meta, message, error)
- Built-in REST semantics (204 No Content, 201 Created, etc.)

### ❌ Centralized error handling

- Custom AppError hierarchy
- Automatic conversion of Mongoose errors (Validation, Cast, Duplicate Key).
- Handles JWT, File Upload, and Axios errors automatically.
- Safe defaults for production (no stack leaks)

### 📄 Pagination (Query + Aggregate)

- Paginate standard Mongoose queries and aggregation pipelines.
- Supports DTO / Transform functions to clean data.
- Enforces `maxLimit` automatically to protect your database.

### 🧠 Smart Middleware Extensions

Methods are attached directly to the `res` object: `res.success()`, `res.created()`, `res.updated()`, `res.deleted()`, `res.list()`, `res.paginateQuery()`, `res.paginateAggregate()`.

### ⚙️ Fully configurable

- Rename response keys
- Customize pagination labels
- Control REST defaults
- Plug in custom logging
- Enable/disable stack traces

## 📦 Installation

```bash
npm install express-unified-response
```

> Requirements

- Node.js ≥ 20
- Express
- Mongoose

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
  "Users fetched successfully"
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
  "Active users fetched"
);

await res.paginateAggregate(
  UserModel,
  {
    pipeline: [{ $match: { score: { $gt: 80 } } }],
    transform: (doc) => ({ id: doc._id, score: doc.score }),
  },
  "High scorers fetched"
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
  })
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
