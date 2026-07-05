# 06 — TypeScript + Mongoose

The same CRUD/pagination story as [02-mongoose-crud](../02-mongoose-crud), written entirely
in TypeScript to show the package's type layer in a real project: the `res.*` module
augmentation, typed Mongoose models, and inferred `transform` generics — no `as any`
anywhere in this file.

## Run

```bash
cp .env.example .env    # optionally change MONGO_URI / PORT
npm install
npm start
# → http://localhost:3006
```

Requires a running MongoDB instance (see `MONGO_URI` in `.env.example`).

## Using local source instead of npm

Replace `"express-unified-response": "^1.1.2"` in `package.json` with:

```json
"express-unified-response": "file:../.."
```

Then run `npm run build` from the **repo root** before `npm install` here.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/users` | `res.created(user, message, { transform: toUserDTO })` |
| `GET` | `/users` | `res.paginateQuery` — typed `filter`/`sort`/`lean` against `IUser` |
| `GET` | `/users/:id` | `res.success` + `NotFoundError` if missing |
| `PUT` | `/users/:id` | `res.updated` |
| `DELETE` | `/users/:id` | `res.deleted` — 204 by default |

## What to notice

- `res.success`, `res.created`, `res.paginateQuery`, etc. exist on `res` purely from
  `import "express-unified-response"` — the package augments Express's `Response` type,
  no wrapper object, no cast.
- `toUserDTO` is `(user: IUser) => UserDTO` — passing it as `transform` makes TypeScript
  infer the response's generic types automatically. None of the `res.*` calls in
  `index.ts` annotate `<T, R>` explicitly.
- `models/user.ts` types the Mongoose schema with `Schema<IUser>` — `paginateQuery`'s
  `filter`/`sort` options are checked against that shape.
- Run `npm run typecheck` to compile-check the whole example with no emit — useful for
  confirming the package's shipped `.d.ts` still matches this usage after an upgrade.
