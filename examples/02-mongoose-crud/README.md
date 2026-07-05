# 02 — Mongoose CRUD

Full CRUD with three pagination styles and Mongoose error auto-detection (no adapters needed).

## Setup

```bash
cp .env.example .env    # set MONGO_URI if not running locally
npm install
npm start
# → http://localhost:3002
```

## Endpoints

| Method | Path | Demonstrates |
|--------|------|-------------|
| `GET` | `/users?page=1&limit=10` | Offset pagination — `res.paginateQuery` |
| `GET` | `/users/stats` | Aggregate pagination — `res.paginateAggregate` |
| `GET` | `/users/cursor?limit=5&cursor=` | Cursor pagination — `res.paginateCursor` |
| `GET` | `/users/:id` | `res.success` or `NotFoundError` |
| `POST` | `/users` | `res.created` with DTO transform (strips `__v`) |
| `PUT` | `/users/:id` | `res.updated` with validators |
| `DELETE` | `/users/:id` | `res.deleted` |

## Error scenarios to try

```bash
# CastError → 400 BAD_REQUEST "Invalid ID format"
curl http://localhost:3002/users/not-a-valid-id

# Duplicate email → 400 BAD_REQUEST with field name in details
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
# Run the same request twice

# Mongoose ValidationError → 400 VALIDATION_ERROR with per-field details
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"not-an-email"}'
```

## What to notice

- `paginateQuery`, `paginateAggregate`, and `paginateCursor` all return the same envelope shape
- Cursor pagination: copy `meta.nextCursor` from the first response into the next `?cursor=` query param
- Mongoose `ValidationError`, `CastError`, and duplicate key (11000) are normalised automatically — zero adapter code