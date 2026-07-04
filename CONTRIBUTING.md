# Contributing to Express Unified Response

Thank you for your interest in contributing!

## Setup

```bash
git clone https://github.com/SayantanCode/express-unified-response.git
cd express-unified-response
npm install
```

## Branch workflow

- `main` — latest published release (do not push directly)
- `dev` — active development branch

Submit all pull requests against **`dev`**, not `main`.

## Development commands

```bash
npm run build   # compile TypeScript via tsup
npm test        # run the Vitest test suite
npm run lint    # ESLint check
```

## Making changes

1. Fork the repository and create a branch from `dev`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Write or update tests for your change — all new behaviour must be covered.
3. Run `npm test` and confirm all tests pass before opening a PR.
4. Run `npm run lint` and fix any issues.
5. If you changed any public API or behaviour, update **README.md** and **CHANGELOG.md** under the current unreleased version heading.

## Commit messages

Use a short, imperative subject line (≤ 72 chars). Prefix with a type:

| Prefix | When to use |
|--------|-------------|
| `feat:` | new feature or behaviour |
| `fix:` | bug fix |
| `docs:` | documentation only |
| `refactor:` | code change with no behaviour change |
| `test:` | adding or updating tests |
| `chore:` | tooling, CI, build config |

Example: `feat: add res.paginateCursorRaw for ORM-agnostic cursor pagination`

## Writing tests

Tests live in the `tests/` directory and use **Vitest** with a real Express app setup (no mocks for the middleware layer).

- One test file per feature area (e.g. `paginatorFeatures.test.ts`, `errorHandling.test.ts`).
- Test both the happy path and edge cases (null input, invalid options, silent flag, etc.).
- Do not mock `ResponseBuilder` or `Paginator` internals — test through the Express response methods.

## Pull Request checklist

- [ ] All existing tests pass (`npm test`)
- [ ] New tests added for the change
- [ ] Lint passes (`npm run lint`)
- [ ] README updated if public API changed
- [ ] CHANGELOG updated under the current unreleased version
- [ ] PR is opened against `dev`, not `main`
