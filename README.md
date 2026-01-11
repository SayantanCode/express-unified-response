# express-unified-response

[![npm version](https://img.shields.io/npm/v/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![npm downloads](https://img.shields.io/npm/dm/express-unified-response)](https://www.npmjs.com/package/express-unified-response)
[![license](https://img.shields.io/npm/l/express-unified-response)](LICENSE)
[![node](https://img.shields.io/node/v/express-unified-response)](https://nodejs.org)
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
    - `res.paginated()`
    - `res.paginateQuery()`
    - `res.paginateAggregate()`
    - `res.error()`
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

### Success Response

```js
res.success(user, "User fetched successfully");
```

```js
{
  "success": true,
  "data": { ... },
  "message": "User fetched successfully"
}
```

### Created (201)

```js
res.created(user, "User created");
```

### Updated

```js
res.updated(updatedUser, "User updated");
```

Returns

- 200 + body (default)
- or 204 No Content based on config

### Deleted

```js
res.deleted(user, "User deleted");
```

### List (Non Paginated)

```js
res.list(users, "User list");
```

### Paginated Query

```js
await res.paginateQuery(UserModel, {
  page: 1,
  limit: 10,
  filter: { isActive: true },
  sort: { createdAt: -1 },
});
```

### Paginated Aggregate

```js
await res.paginateAggregate(UserModel, {
  page: 1,
  limit: 10,
  pipeline: [{ $match: { isActive: true } }],
});
```

### DTO/ Transform Support (If you want to return a subset of fields or transform the response)

```js
res.success(user, "OK", {
  transform: (u) => ({
    id: u._id,
    email: u.email,
  }),
});
```

Works for:

- `success`
- `created`
- `updated`
- `list`
- `paginated`

## ❌ THROWING ERRORS

```js
import { NotFoundError } from "express-unified-response";

throw new NotFoundError("User not found");
```
Even with `res.error()` you can still throw errors.
```js
res.error();
```

Handled automatically by error middleware.

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

## 🔐 Async Handler (No Try/Catch)
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
## ⚙️ Configuration
```js
createResponseMiddleware({
  keys: {
    dataKey: "result"
  },
  error: {
    exposeStack: false,
    exposeErrorName: false
  },
  pagination: {
    defaults: {
      limit: 20,
      maxLimit: 100
    }
  },
  restDefaults: {
    deleteReturnsNoContent: true,
    updateReturnsBody: true
  },
  logger: {
    onSuccess: (status) => console.log("✔", status),
    onError: (err, status) => console.error("✖", status, err.code)
  }
});
```
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
[![Star](https://img.shields.io/github/stars/sayantan-chakraborty/express-unified-response?style=social)](https://github.com/sayantan-chakraborty/express-unified-response)

## Made with ❤️ by Sayantan Chakraborty