# 03 — Zod Validation

`ZodError` is automatically mapped to `400 VALIDATION_ERROR` with a `details` array containing one entry per field. No `try/catch`, no `z.safeParse`, no manual error handling.

## Run

```bash
npm install
npm start
# → http://localhost:3003
```

## Endpoints

| Method | Path | Schema |
|--------|------|--------|
| `POST` | `/register` | `email`, `password` (min 8), `age` (min 18), optional `name` |
| `POST` | `/product` | `name`, `price` (positive), `category` (enum), optional nested `dimensions` |

## Try it

```bash
# Multiple field errors → 400 with details array
curl -X POST http://localhost:3003/register \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"short","age":16}'

# Valid → 201
curl -X POST http://localhost:3003/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123","age":25}'

# Nested field path (dimensions.width) appears as dot-notation in details
curl -X POST http://localhost:3003/product \
  -H "Content-Type: application/json" \
  -d '{"name":"Table","price":-10,"category":"furniture","dimensions":{"width":-5}}'
```

## What to notice

- `schema.parse(req.body)` throws — `asyncHandler` catches it and passes it to `createErrorMiddleware`
- Each Zod `issue` becomes `{ field, message, code }` in the `details` array
- Nested paths (`dimensions.width`) are joined with `.` automatically
- The response shape is identical to any other `ValidationError` in your API