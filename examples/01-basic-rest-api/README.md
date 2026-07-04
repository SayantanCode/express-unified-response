# 01 — Basic REST API

In-memory product store demonstrating every core feature without a database.

## Run

```bash
npm install
npm start
# → http://localhost:3001
```

## Endpoints

| Method | Path | Demonstrates |
|--------|------|-------------|
| `GET` | `/products` | `res.success` — list all |
| `GET` | `/products/:id` | `res.success` or `NotFoundError` |
| `POST` | `/products` | Manual validation → `res.created` or `ValidationError` |
| `PUT` | `/products/:id` | `res.updated` |
| `DELETE` | `/products/:id` | `res.deleted` (204 no content) |
| `GET` | `/errors/custom` | Custom `AppError` with machine-readable code + details |
| `GET` | `/errors/unhandled` | Uncaught `TypeError` → masked 500 (non-operational) |

## Things to notice

- No `try/catch` anywhere — `asyncHandler` handles everything
- Terminal shows coloured request logs from the custom `onSuccess` / `onError` hooks
- Every error response has the same `{ success, message, error: { code, details } }` shape
- A `TypeError` (non-operational) shows your `defaultErrorMessage`, not the raw JS error