# 04 — JWT Authentication

JWT middleware that lets `TokenExpiredError` and `JsonWebTokenError` propagate naturally — `createErrorMiddleware` maps both to `401 UNAUTHORIZED` automatically.

## Run

```bash
cp .env.example .env    # optionally change JWT_SECRET
npm install
npm start
# → http://localhost:3004
```

## Accounts (in-memory)

| Email | Password | Role |
|-------|----------|------|
| user@example.com | password123 | user |
| admin@example.com | admin123 | admin |

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/auth/login` | Returns a signed JWT (1 h expiry) |
| `GET` | `/profile` | Protected — requires `Authorization: Bearer <token>` |
| `GET` | `/admin` | Protected + admin role only → `403 FORBIDDEN` for regular users |
| `GET` | `/auth/test/expired` | Generates an already-expired token and verifies it → `401` |
| `GET` | `/auth/test/invalid` | Passes garbage to `jwt.verify` → `401` |

## Walkthrough

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' | \
  node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# 2. Access profile → 200
curl -H "Authorization: Bearer $TOKEN" http://localhost:3004/profile

# 3. Admin route → 403 FORBIDDEN
curl -H "Authorization: Bearer $TOKEN" http://localhost:3004/admin

# 4. Expired token → 401 "Token expired"
curl http://localhost:3004/auth/test/expired

# 5. Invalid token → 401 "Invalid authentication token"
curl http://localhost:3004/auth/test/invalid
```

## What to notice

- `requireAuth` uses `asyncHandler` so `jwt.verify()` errors propagate directly — no try/catch
- `requireRole` is a higher-order function that returns an `asyncHandler` middleware
- The same middleware pattern works on any route: `app.get("/route", requireAuth, requireRole("admin"), handler)`