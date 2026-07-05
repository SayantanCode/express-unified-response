# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - July 04, 2026

### Added
- **`res.noContent()` — explicit 204**: Standalone 204 No Content response for non-delete endpoints (PATCH actions, HEAD, job triggers, etc.). Using `res.deleted()` for non-delete operations was semantically wrong; this provides a clean, intention-revealing alternative. Supports `silent` option.
  ```js
  await processJob(req.params.id);
  res.noContent();
  ```
- **`createErrorMiddleware` no longer requires spread**: Previously returned `[RequestHandler, ErrorRequestHandler]` tuple requiring `app.use(...createErrorMiddleware())`. Now returns `(RequestHandler | ErrorRequestHandler)[]` — Express accepts this array natively, so `app.use(createErrorMiddleware())` works without spread. The spread form still works for existing codebases.
- **`express-rate-limit` integration documented**: Added `express-rate-limit` wiring example to README showing how to route rate limit events through the package's error pipeline using `RateLimitError` and the limiter's `handler` option.
- **`res.accepted()` — 202 Accepted**: New response helper for async/queued operations. Same signature as `res.success()` (data, message, options). Supports transform and `_doc` unwrapping.
  ```js
  const jobId = await queue.add(req.body);
  res.accepted({ jobId }, "Export queued");
  ```
- **`res.paginateCursor()` — Cursor-based pagination**: For large Mongoose collections where offset `skip` becomes slow. Fetches `limit + 1` documents to determine `hasNextPage` without a `$count` query. Returns `nextCursor`, `hasNextPage`, and `limit` in the meta block instead of page/total fields. Supports `filter`, `sort`, `populate`, `select`, `lean`, `transform`, and configurable `cursorField` (defaults to `_id`).
  ```js
  await res.paginateCursor(PostModel, { cursor: req.query.cursor, limit: 20 }, "Posts fetched");
  ```
- **Zod auto-normalization**: `ZodError` thrown from `schema.parse()` is now automatically caught by the error middleware and normalized into a `400 VALIDATION_ERROR` with each Zod issue mapped to a `details` entry (`field`, `message`, `code`). No Zod import in the package — detected via duck-typing.
- **All error classes now exported**: `RateLimitError`, `DatabaseError`, `TokenExpiredError`, `InvalidTokenError`, `FileUploadError`, `ExternalServiceError`, `MethodNotAllowedError`, `PayloadTooLargeError`, `MongooseValidationError`, `MongooseCastError`, `MongooseDuplicateKeyError`, and `MongooseGeneralError` are now importable from the package. Previously only the base classes were exported.
- **`QueryOptions` now exposes `select` and `lean`**: These options were accepted by the paginator internally but were absent from the public `QueryOptions` TypeScript type, making them invisible to TS users and IDE autocomplete.
- **Explicit return type on `createErrorMiddleware`**: Now typed as `[RequestHandler, ErrorRequestHandler]` for better TypeScript integration.
- **New exported types**: `CursorPaginatedResult`, `CursorOptions`, `CursorPaginationOptions` are now part of the public API.
- **Dev-mode diagnostic for missing `createResponseMiddleware`**: `createErrorMiddleware` now detects, once per instance and only outside `NODE_ENV=production`, when `res.success`/`created`/etc. aren't present at error-handling time — the two most common setup mistakes (`createResponseMiddleware()` never registered, or registered after `createErrorMiddleware()`/after the routes). Routes through `logger.onWarn` like other package warnings; never changes the actual error response, and explicitly does not flag the supported standalone `createErrorMiddleware()` usage.
- **`transform` now receives an `index` as its second argument**: `TransformFn<T, R> = (doc, index) => R`. Purely additive — existing single-argument transform functions keep working unchanged, same as `Array.prototype.map`. `index` is always `0` for single-object calls (`res.success`/`created`/`updated`/`deleted`).
  ```js
  res.list(users, { transform: (u, i) => ({ position: i, id: u._id, name: u.name }) });
  ```

### Fixed
- **`res.success` silent option ignored**: The `silent` option passed to `res.success()` had no effect because the middleware was internally checking a non-existent `shouldLog` property instead of `silent`. Now consistent with all other response helpers.
- **`created()` missing Mongoose `_doc` unwrapping**: `res.created()` did not unwrap Mongoose document internals, so raw Mongoose docs passed from `Model.create()` leaked `_doc` and internal fields. Now matches the behaviour of `res.success()`.
- **`RestDefaults` config was completely ignored**: `deleteReturnsNoContent` and `updateReturnsBody` were defined in config and documented but never read by `ResponseBuilder`. Both options now correctly control the default HTTP status when no data or message is provided.
- **`res.list()` options now optional**: The `options` argument is now typed as optional (`options?`). Calling `res.list(users)` or `res.list(users, undefined, "message")` no longer produces a TypeScript error.
- **`page` and `limit` accept strings**: `QueryOptions`, `ListOptions`, `AggregateOptions`, and `CursorOptions` now type `page` and `limit` as `number | string`. Passing `req.query.page` directly without `Number()` conversion now compiles correctly — the runtime normalizer already handled strings, types just didn't reflect it.
- **`res.deleted()` missing `options` in type**: The type declaration for `deleted` was missing the third `options?: { silent?: boolean }` parameter. TypeScript users can now pass `silent: true` to `res.deleted()`.

### Security
- **Runtime errors no longer leak messages to clients**: `TypeError`, `RangeError`, `ReferenceError`, and other named runtime errors are now correctly marked as non-operational — their raw messages are hidden from API clients and replaced with the configured `defaultErrorMessage`. Plain `new Error("msg")` (intentional throws) remain operational and still show their message.
- **`ValidationError` name collision fixed**: The Mongoose detection check previously matched any error named `"ValidationError"` (from Joi, Zod, class-validator, etc.) and tried to construct a `MongooseValidationError` from it, which would crash or return garbage. Now guarded by a Mongoose-specific structural check (`_message` string + `errors` object).

### Changed
- **`isEmpty` magic sentinels removed from `updated()` and `deleted()`**: `false` and `"_"` were silently treated as "no data", causing surprising 204 responses when passing boolean or single-underscore string values. Only `undefined` and `null` now mean "no data provided".
- **`asyncHandler` now finds `next` from the end of arguments**: `next` is always the last function argument in both Express and Mongoose hooks. The previous `find` (first match) was semantically incorrect; replaced with a reverse scan.
- **Removed `[key: string]: any` from `ListOptions`**: The index signature was destroying TypeScript type safety, allowing any arbitrary object to be passed without a type error.
- **Removed unused `docs` field from `PaginationLabelMapping`**: This field was defined in the type but was never read anywhere in the codebase. The docs array key is controlled by `keys.dataKey` in `ResponseKeyMapping`, not by pagination labels.
- **`filterStackTrace` now filters all `node:` built-ins**: Previously only `node:internal` was filtered, missing `node:async_hooks`, `node:events`, `node:fs`, and others. Now any line containing `node:` is removed from the exposed stack.

### Improved
- **Removed 400+ lines of commented-out dead code** from `paginator.ts`, `middleware.ts`, and `errors.ts` (leftover from earlier refactors).
- **`logger` config now shallow-merges with defaults**: Previously `logger: { onSuccess: myFn }` silently discarded the default `onError` and `onWarn` handlers — a full object replacement, unlike every other config key which merges. The logger now merges, so partial overrides work as expected. Pass only the callbacks you want to replace; omitted ones keep the default behavior.
- **`logger.onWarn` — internal package warnings now routable**: Internal warnings (e.g. `useEstimatedCount + filter` conflict, adapter crash notifications) were hardcoded to `console.warn` and impossible to silence or redirect. Added `logger.onWarn?: (message: string, context?: unknown) => void`. When provided, all package-level warnings go through it instead of directly to `console`. Falls back to `console.warn` if not configured.
  ```js
  logger: {
    onWarn: (msg, context) => pino.warn({ msg, context }),
  }
  ```
- **`logger.logLevel` — suppress verbose 2xx logs**: Added `logger.logLevel?: "all" | "error" | "none"`. Use `"error"` in production to only log 4xx/5xx responses. Use `"none"` to disable all request logging without having to override `onSuccess`/`onError` with no-ops.
  ```js
  logger: { logLevel: "error" }  // only 4xx/5xx lines printed
  logger: { logLevel: "none"  }  // fully silent
  ```
- **Accurate request duration via `res.once('finish')`**: `durationMs` was previously computed and logged before `res.json()` was called — missing JSON serialization and socket write time. Both `onSuccess` and `onError` now fire from a `res.once('finish')` listener, so the reported time covers the full response pipeline.
- **Zero-duration fix when `createErrorMiddleware` is used standalone**: Without `createResponseMiddleware`, `req.startTime` was never set, causing every error log to show `0.000 ms`. The fallback now captures time at the point the error handler fires.
- **Transform errors now pinpoint the failing item**: Previously a failing array transform threw a generic `"Transform function threw: ..."` with no way to tell which item caused it. Each item's transform is now caught individually, so the message includes the failing index and the item's `_id`/`id` if present (e.g. `"Transform function threw at index 42, id: 664f...: ..."`).
- **`ResponseBuilder.list()`/`.paginated()` deduplicated**: Both built an identical pagination-meta envelope independently; now share one private helper. No output change.
- **Build produces zero warnings**: The esbuild "ignored side-effect import" warning (from the `express-serve-static-core` type augmentation combined with `sideEffects: false`) is gone — resolved with a lint-safe type-only import instead of a bare side-effect import.

### Pagination — Performance & Safety
- **`skipCount` option on `paginateQuery` and `paginateAggregate`**: Pass `skipCount: true` to skip the count query entirely. `totalDocs` and `totalPages` return `-1`. Use for infinite scroll where count is not needed.
- **`useEstimatedCount` option on `paginateQuery`**: Use `estimatedDocumentCount()` instead of `countDocuments()` for dramatically faster totals on large unfiltered collections. A dev warning is logged if `useEstimatedCount: true` is combined with a non-empty `filter` (since `estimatedDocumentCount` ignores the filter and would return wrong totals).
- **`paginate: false` no longer runs `countDocuments`**: Previously a redundant count query fired even when all docs were requested. Now the docs array length is used directly.
- **`allowDiskUse` option on `paginateAggregate`**: Passes `allowDiskUse(true)` to both the data and count aggregate pipelines, required for large pipelines that exceed MongoDB's 100 MB memory limit.
- **Cursor `Date` fields serialize as ISO 8601**: Previously `String(dateValue)` produced locale-dependent output. Cursor values that are `Date` instances are now serialized with `.toISOString()` for consistent cross-environment pagination.
- **Cursor pagination direction**: New `cursorDirection: "asc" | "desc"` option. `"asc"` (default) uses `$gt` for forward pagination; `"desc"` uses `$lt` for newest-first feeds.
- **`lean + populate` conflict detection**: Both `paginateQuery` and `paginateCursor` now throw `INVALID_QUERY_OPTIONS` immediately if `lean: true` and `populate` are both set — Mongoose silently ignores `populate` with `lean`, which was previously a silent data bug.
- **`FilterQuery<T>` typing on filter**: `filter` in `QueryPaginationOptions<T>` and `CursorPaginationOptions<T>` is now typed as `QueryFilter<T>` (Mongoose 9 equivalent) instead of `Record<string, any>`, giving full IDE autocomplete and type safety on filter keys.
- **`$limit`/`$skip` stripped from count pipeline in `paginateAggregate`**: If a developer accidentally included `$limit` or `$skip` in their pipeline, the count would silently reflect the capped subset. These stages are now removed from the count pipeline before execution.
- **`nonPaginatedMaxItems` wiring fixed**: `restDefaults.nonPaginatedMaxItems` was accepted in config but never passed to the `Paginator`. Non-paginated `res.list()` calls were always capped at `maxLimit` (default 100) instead of `nonPaginatedMaxItems` (default 1000). Now wired correctly.
- **Transform runs once in `ResponseBuilder`**: Previously transform was applied in the `Paginator` and then `ResponseBuilder.applyTransform` ran `unwrapDoc` again on already-transformed docs (double-processing). Transform is now applied exclusively in `ResponseBuilder` for all methods, one pass, after `_doc` unwrapping.

### Security
- **`MongooseDuplicateKeyError` no longer exposes the raw field value**: The conflicting field value (e.g. the actual email address causing a unique key violation) was included in the error response `details.value`. This field is now removed from the default response — only the field name is exposed.

### Developer Experience
- **`routeNotFound` now tracked in `ResolvedResponseConfig`**: Previously the `routeNotFound` option was read directly from the raw config object in `createErrorMiddleware`, bypassing `resolveConfig`. It is now resolved through `builder.config.routeNotFound` like all other options.
- **`res.paginateRaw()` — ORM-agnostic offset pagination**: Accepts pre-fetched docs and a total count directly. Builds the full pagination envelope (totalDocs, totalPages, hasNextPage, etc.) without any DB query. Designed for Prisma, TypeORM, Drizzle, pg, and any ORM where the developer runs the query themselves. `res.list()` with `paginate: true` was the previous workaround but caused double-pagination (sliced the input again) producing empty arrays on page > 1.
- **`res.paginateCursorRaw()` — ORM-agnostic cursor pagination**: Accepts pre-fetched docs and pre-computed cursor meta (`nextCursor`, `hasNextPage`, `limit`). Returns the same cursor-pagination envelope as `res.paginateCursor()`. Works with any ORM that supports cursor-based queries (e.g. Prisma's `cursor` + `skip: 1` pattern). Developer implements the limit+1 trick; package handles the response format.
- **New exported types**: `RawPaginationOptions`, `RawCursorMeta`.
- **Non-Mongoose model guard in pagination methods**: Passing a Prisma client, TypeORM repository, or any non-Mongoose object to `paginateQuery`, `paginateAggregate`, or `paginateCursor` previously crashed with an opaque masked `500 "Internal server error"` (`TypeError: model.find is not a function`, name !== "Error" → non-operational → message hidden). Now throws `INVALID_MODEL` immediately with a clear message pointing developers to `res.list()` as the correct alternative.
- **Non-Mongoose usage documented**: New "Using Without Mongoose" section in README covering which methods are ORM-agnostic, Prisma/TypeORM pagination pattern using `res.list()`, and why ORM error adapters are required.
- **Adapter duplication bug fixed**: Custom error adapters were being called twice per error. `createErrorMiddleware` extracted adapters from config and passed them to `builder.apperror()` as `methodAdapters`, but `builder.config.adapters` already held the same array — so `combinedAdapters` was `[...adapters, ...adapters]`. The first call returned an AppError and short-circuited the loop, so behavior was correct, but the second registration was a logic bug. Fixed by removing the redundant pass — `builder.apperror(err)` now uses only `builder.config.adapters`.
- **`filter`, `sort`, `projection`, `populate` types tightened**: These fields in `QueryOptions` and `CursorOptions` were typed as `any`. Now typed as `Record<string, any>`, `Record<string, 1 | -1 | "asc" | "desc">`, `Record<string, 0 | 1>`, and a union of populate forms respectively. Catches obvious misuse (e.g. `filter: 42`) at compile time while keeping flexibility for complex queries.
- **README: Prisma and TypeORM adapter examples added**: Full adapter examples for Prisma (`P2002`, `P2025`, `P2003`) and TypeORM added to the Custom Error Adapters section.
- **SECURITY.md added**: Documents supported versions, vulnerability reporting process, and security considerations.
- **GitHub issue templates and PR template added**: Bug report and feature request templates under `.github/ISSUE_TEMPLATE/`, plus `.github/PULL_REQUEST_TEMPLATE.md` mirroring the existing CONTRIBUTING.md checklist.
- **New Common Mistake: relying on a schema's `toJSON` transform to hide sensitive fields**: `res.success`/`created`/`updated`/`deleted` unwrap Mongoose's internal `_doc` directly for convenience, which skips `toJSON`/`toObject` schema transforms and virtuals entirely — verified with a real schema test that a `password` field hidden via a `toJSON` transform was **not** hidden in the actual response. Documented with the two safe alternatives: `select: false` at the schema level, or an explicit `transform`.
- **New example: `06-typescript-mongoose`**: A full TypeScript example — typed Mongoose model, inferred `transform` generics, the `res.*` module augmentation in action — verified to type-check clean against the shipped `.d.ts`.
- **Release pipeline fixed**: `publish.yml`'s version-bump detection matched literal `major:`/`minor:` strings that never occurred under this project's actual `feat:`/`fix:`/etc. commit convention, so every release could only ever compute a patch bump regardless of content. Now maps `feat:` → minor, a `!:`/`BREAKING CHANGE` marker → major, everything else → patch. `test.yml` also now runs on pushes to `dev` (previously only `main`), so the branch PRs are actually opened against gets CI signal before merging.
- **114 tests** (up from 42): pagination features (`skipCount`, `useEstimatedCount`, `lean+populate` guard, cursor `asc`/`desc` direction, `hasNextPage` detection, `Date` cursor serialization, `allowDiskUse`, count pipeline `$limit`/`$skip` stripping, `MongooseDuplicateKeyError` value exposure, `routeNotFound` behavior), `nonPaginatedMaxItems` enforcement, `createAppError` string/object-throw branches, `paginateAggregate` `skipCount` end-to-end, the dev-mode setup diagnostic, and the `transform` `index` parameter / pinpointed error messages.

## [1.1.3] - May 31, 2026

### Fixed
- **Stack Trace Filtering**: Stack traces now filter out `node_modules` and `node:internal` paths, preventing ugly/leaked file paths and showing only user code. Addresses the issue where users received confusing stack traces with internal framework details.
- **Non-Paginated Items DoS Protection**: Enforced `nonPaginatedMaxItems` limit in `res.list()` to prevent accidental/intentional DoS from unbounded list responses. Lists now cap at `maxLimit` items when pagination is disabled.
- **Circular Reference Protection**: Added safe serialization for error details to prevent crashes from circular references in error objects. Circular references are now marked as `[Circular Reference]` in responses.
- **Improved Mongoose Duplicate Key Error**: Added defensive checks for malformed MongoDB error responses. Safely handles edge cases where `keyValue` is missing or has unexpected structure.

### Added
- **Stack Trace Utilities**: Exported `filterStackTrace()` and `safeStringify()` utilities for advanced users who need custom error processing.
- **Better Error Details Sanitization**: Error details now undergo safe serialization to prevent:
  - Non-serializable values (functions, symbols) from crashing responses
  - Circular references from infinite loops
  - Invalid data structures from causing JSON errors

### Improved
- **Error Message Consistency**: Non-operational errors (truly unexpected failures) now show a generic message instead of leaking implementation details. Operational errors (user-thrown) show their full messages for better debugging.
- **Security**: Default configuration is now safer for production; stack trace filtering and message masking work together to prevent information leakage.

## [1.1.2] - May 27, 2026

### Fixed
- **Mongoose Compatibility**: Refactored `asyncHandler` to be context-aware. It now correctly preserves the `this` binding and function `length`, allowing it to work seamlessly with Mongoose `pre` hooks and Express route matching.
- **Optional Dependency Crash**: Removed hard runtime requirement for Mongoose. The package now uses type-only imports and string-based name checks, preventing crashes in non-Mongoose projects.
- **Security**: Changed `exposeStack` default to `false`. Stack traces are now hidden by default in API responses to prevent sensitive data leakage in production.

### Added
- **Auto-Error Propagation**: Added `try/catch` wrappers to `res.paginateQuery`, `res.paginateAggregate`, and `res.list`. These helpers now automatically call `next(err)` on failure, ensuring errors reach the global handler even if the user forgets to use `asyncHandler`.
- **Flexible AppError**: The `code` parameter in `AppError` is now optional (defaults to `"CUSTOM_ERROR"`), making it faster to throw simple custom errors.
- **String Throw Support**: `createAppError` now correctly maps string-based throws (e.g., `throw "Unauthorized"`) to standard error responses.

### Changed
- **Performance**: Optimized `ResponseBuilder` and removed legacy codebase artifacts for better maintainability.

## [1.1.1] - 22nd February, 2026
### Added
- Custom Error Adapters: You can now plug in custom logic to handle errors from any library (Prisma, Postgres, etc.) without touching the core code.
- Morgan-Style Logging: Beautiful, color-coded console logs out-of-the-box that look just like morgan('dev').
- Global Silence Mode: Added a silent: true config option to easily toggle off all console output for testing or production.
- Adapter Safety: Built-in protection that prevents your app from crashing even if a custom error adapter has a bug.
### Changed
Config Flexibility: createErrorMiddleware and createResponseMiddleware now accept an adapters array to prioritize your custom error logic over built-in handlers.

## [1.0.0] - 11th January, 2026
### Added
- Initial release of `express-unified-response`.
- Global error handling middleware.
- Response injection for `res.success`, `res.error`, and `res.paginated` and many more.
- Mongoose pagination and aggregate support.
- TypeScript support with full type definitions.