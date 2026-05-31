# Changelog

All notable changes to this project will be documented in this file.

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