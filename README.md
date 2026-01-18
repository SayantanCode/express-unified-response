# express-unified-response

<!-- [![npm version](https://img.shields.io/npm/v/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![npm downloads](https://img.shields.io/npm/dm/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![license](https://img.shields.io/npm/l/express-unified-response)](LICENSE)
[![node](https://img.shields.io/node/v/express-unified-response)](https://nodejs.org) -->

![express](https://img.shields.io/badge/express-middleware-black)
![typescript](https://img.shields.io/badge/typescript-supported-blue)

# 🚀 Express Smart Response & Error Toolkit

A production-ready response, error handling, and pagination toolkit for Express + Mongoose APIs.
It enforces consistent API responses, centralized error handling, and powerful pagination with minimal boilerplate.

## ✨ FEATURES

### ✅ Unified API Responses Unified API responses

- Standard success, created, updated, deleted responses
- Configurable response keys (success, data, meta, message, error)
- Built-in REST semantics (204 No Content, 201 Created, etc.)

### ❌ Centralized error handling

- Custom AppError hierarchy
- Automatic conversion of:
  - Mongoose validation errors
  - Mongoose cast errors
  - Mongoose duplicate key errors
  - JWT errors
  - File upload errors
  - Axios / external service errors
- Safe defaults for production (no stack leaks)

### 📄 Pagination (Query + Aggregate)

- Paginate standard Mongoose queries
- Paginate aggregation pipelines
- Supports transform (DTO) functions
- Enforces max limits automatically

### 🧠 Smart Middleware Extensions

- Adds helper methods directly to res:
  - `res.success()`
  - `res.created()`
  - `res.updated()`
  - `res.deleted()`
  - `res.list()`
  - `res.paginateQuery()`
  - `res.paginateAggregate()`
  - `res.apperror()`

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

- Node.js ≥ 16
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

The library follows 2 consistent pattern 1 for non paginated non array responses and 2 for paginated responses.
like this:
(1. (Data, Message, Options) or (Data, Message) or (Data) )

(2. (Data, Options, Message) or (Data, Options) )

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

Useful for sending arrays of data while still supporting pagination.

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

### Paginated Query

```js
await res.paginateQuery(
  UserModel,
  {
    page: 1,
    limit: 10,
    filter: { isActive: true },
    sort: { createdAt: -1 },
    populate: "profile",
    transform: (doc) => ({ id: doc._id, email: doc.email }),
  },
  "Active users fetched"
);
```

### Paginated Aggregate

```js
await res.paginateAggregate(
  UserModel,
  {
    page: 1,
    limit: 10,
    pipeline: [{ $match: { score: { $gt: 80 } } }, { $sort: { score: -1 } }],
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
  <tr>
    <th>Error Class</th>
    <th>HTTP Status</th>
  </tr>
  <tr>
    <td><code>BadRequestError</code></td>
    <td><code>400</code></td>
  </tr>
  <tr>
    <td><code>ValidationError</code></td>
    <td><code>400</code></td>
  </tr>
  <tr>
    <td><code>UnauthorizedError</code></td>
    <td><code>401</code></td>
  </tr>
  <tr>
    <td><code>ForbiddenError</code></td>
    <td><code>403</code></td>
  </tr>
  <tr>
    <td><code>NotFoundError</code></td>
    <td><code>404</code></td>
  </tr>
  <tr>
    <td><code>MethodNotAllowedError</code></td>
    <td><code>405</code></td>
  </tr>
  <tr>
    <td><code>PayloadTooLargeError</code></td>
    <td><code>413</code></td>
  </tr>
  <tr>
    <td><code>RateLimitError</code></td>
    <td><code>429</code></td>
  </tr>
  <tr>
    <td><code>ExternalServiceError</code></td>
    <td><code>502</code></td>
  </tr>
  <tr>
    <td><code>DatabaseError</code></td>
    <td><code>503</code></td>
  </tr>
</table>

### Mongoose-Specific

- `MongooseValidationError`
- `MongooseCastError`
- `MongooseDuplicateKeyError`
- `MongooseGeneralError`

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
const config ={
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
      console.log(`REQ ${req.method} ${req.originalUrl} ${status} - ${duration}ms`),
    onError: (req, err, status, duration) => {
      console.error(`REQ ${req.method} ${req.originalUrl} ${status} - ${duration}ms`);
      console.error(err);
    },
  },
  routeNotFound: true,
  error: {
    exposeStack: `${process.env.NODE_ENV}` !== "production",
    exposeErrorName: false,
    defaultErrorMessage: "An unexpected error occurred",
  },
};
app.use(createResponseMiddleware(config));
-----------------------------------------------
app.use(createErrorMiddleware(config));
```

> `Note:` Pass the same config to `createErrorMiddleware(config)`. to make them consistent.

## 📤 Error Response Example

```js
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

## 🧠 Design Philosophy

- Zero response duplication
- Single source of truth for errors
- REST-correct defaults
- Production-safe
- Framework-agnostic mindset
- Easy to customize
- Type-safe

## 📜 License

MIT License

## 🤝 Ideal Use Cases

- SaaS backends
- REST APIs
- Admin panels
- Microservices
- Enterprise Node.js systems

## 📝 Credits

- [Sayantan Chakraborty](https://github.com/SayantanCode)

## 🌟 Star this project on GitHub

[![Star](https://img.shields.io/github/stars/sayantanCode/express-unified-response?style=social)](https://github.com/sayantanCode/express-unified-response)

## Made with ❤️ by Sayantan Chakraborty
