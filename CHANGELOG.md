# Changelog

All notable changes to this project will be documented in this file.
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