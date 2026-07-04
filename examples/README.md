# Examples

Five self-contained projects showing `express-unified-response` in real-world scenarios.
Each runs independently with `npm install && npm start`.

## Prerequisites

- Node.js ≥ 18

## What's here

| Folder | What it demonstrates | Extra requirement |
|--------|---------------------|-------------------|
| [01-basic-rest-api](./01-basic-rest-api) | All response helpers, error classes, asyncHandler, custom logger | — |
| [02-mongoose-crud](./02-mongoose-crud) | CRUD + offset / cursor / aggregate pagination, Mongoose error auto-detection | MongoDB |
| [03-zod-validation](./03-zod-validation) | Zod schema validation, `ZodError` auto-mapped to field-level 400 with details | — |
| [04-jwt-auth](./04-jwt-auth) | JWT middleware, `TokenExpiredError` / `JsonWebTokenError` → 401 auto, role-based `ForbiddenError` | — |
| [05-file-upload](./05-file-upload) | Multer disk upload (`index.js`), AWS S3 with custom error adapter (`s3.js`) | AWS creds for `s3.js` |

## Running any example

```bash
cd examples/01-basic-rest-api   # swap for any folder
npm install
npm start
```

## Using local source instead of npm

Replace `"express-unified-response": "^1.1.2"` in the example's `package.json` with:

```json
"express-unified-response": "file:../.."
```

Then run `npm run build` from the **repo root** before installing the example.