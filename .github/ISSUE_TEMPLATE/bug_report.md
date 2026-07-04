---
name: Bug Report
about: Something isn't working as documented
title: "[Bug] "
labels: bug
assignees: ''
---

## Describe the Bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

```js
// Minimal reproduction — paste the relevant code here
const app = express();
app.use(createResponseMiddleware());

app.get('/example', asyncHandler(async (req, res) => {
  // What you did
}));

app.use(...createErrorMiddleware());
```

**Expected behavior:** What you expected to happen.

**Actual behavior:** What actually happened (include the full response body or error message).

## Environment

- Package version: `express-unified-response@x.x.x`
- Node.js version: `node --version`
- Express version: `x.x.x`
- Mongoose version (if applicable): `x.x.x`
- TypeScript version (if applicable): `x.x.x`

## Additional Context

Any other context, screenshots, or stack traces.
