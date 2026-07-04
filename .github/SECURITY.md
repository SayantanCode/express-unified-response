# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.2.x   | ✅ |
| 1.1.x   | ⚠️ Bug fixes only |
| < 1.1   | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing: **sayantan648@gmail.com**

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested fix if you have one

You will receive a response within **72 hours**. If the issue is confirmed, a patch will be released as quickly as possible (target: within 7 days for critical issues).

## Security Considerations

### Information Exposure

- **Stack traces** are hidden by default (`exposeStack: false`). Enable only in trusted environments.
- **Non-operational errors** (TypeError, RangeError, etc.) have their messages masked and replaced with `defaultErrorMessage` to prevent implementation details from leaking to clients.
- **Duplicate key errors** expose only the field name, not the conflicting value.

### Input Validation

- `maxLimit` enforces a hard cap on paginated requests to prevent DoS via large page sizes.
- `nonPaginatedMaxItems` caps non-paginated list responses.
- Error adapter functions are wrapped in try/catch so a buggy adapter cannot crash the process.

### Dependencies

This package has one runtime dependency: `chalk` (terminal color output for logging). All other dependencies are `devDependencies` and are not included in the published package.
