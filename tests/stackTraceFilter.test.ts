import { describe, it, expect } from 'vitest';
import { filterStackTrace, safeStringify } from '../src/utils/stackTraceFilter';

describe('Stack Trace Filtering', () => {
  it('should filter out node_modules paths', () => {
    const stack = `Error: Something went wrong
    at getUserById (/app/src/routes/users.ts:42:10)
    at Object.<anonymous> (/app/node_modules/express/lib/router.js:123:45)
    at processRequest (/app/src/middleware/handler.ts:15:5)
    at async /app/node_modules/@vitest/runner/dist/index.js:145:11`;

    const filtered = filterStackTrace(stack);
    expect(filtered).toContain('getUserById');
    expect(filtered).toContain('processRequest');
    expect(filtered).not.toContain('node_modules');
  });

  it('should filter out node:internal paths', () => {
    const stack = `Error: Internal error
    at myFunction (/app/src/app.ts:10:5)
    at async (node:internal/streams/destroy:45:30)
    at other (/app/src/index.ts:5:1)`;

    const filtered = filterStackTrace(stack);
    expect(filtered).toContain('myFunction');
    expect(filtered).toContain('other');
    expect(filtered).not.toContain('node:internal');
  });

  it('should handle undefined/null stack gracefully', () => {
    expect(filterStackTrace(undefined)).toBeUndefined();
    expect(filterStackTrace(null as any)).toBeUndefined();
  });

  it('should return original if all lines are filtered', () => {
    const stack = `Error: Test
    at /app/node_modules/lib.js:1:1
    at (node:internal/util:2:2)`;

    const filtered = filterStackTrace(stack);
    expect(filtered).toBe(stack);
  });
});

describe('Safe Stringify', () => {
  it('should handle circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj;

    const result = safeStringify(obj);
    expect(result.self).toBe('[Circular Reference]');
  });

  it('should handle functions', () => {
    const obj = { method: () => {} };
    const result = safeStringify(obj);
    expect(result.method).toBe('[Function]');
  });

  it('should handle symbols', () => {
    const sym = Symbol('test');
    const obj = { symbol: sym };
    const result = safeStringify(obj);
    expect(typeof result.symbol).toBe('string');
    expect(result.symbol).toContain('Symbol');
  });

  it('should handle dates', () => {
    const date = new Date('2026-05-31');
    const obj = { date };
    const result = safeStringify(obj);
    expect(result.date).toBe('2026-05-31T00:00:00.000Z');
  });

  it('should handle nested errors', () => {
    const err = new Error('Test error');
    const obj = { error: err };
    const result = safeStringify(obj);
    expect(result.error.name).toBe('Error');
    expect(result.error.message).toBe('Test error');
  });

  it('should respect max depth', () => {
    const obj = { a: { b: { c: { d: { e: 'deep' } } } } };
    const result = safeStringify(obj, 2);
    expect(result.a.b.c).toBe('[Max depth exceeded]');
  });
});
