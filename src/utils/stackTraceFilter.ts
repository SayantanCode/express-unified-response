/**
 * Filters a stack trace to hide node_modules paths and show only user code.
 * This prevents ugly paths like:
 *   at Node.js internal (node:internal/...)
 *   at /path/to/node_modules/...
 * 
 * Instead shows clean user code traces like:
 *   at getUserById (/src/routes/users.ts:42:10)
 *   at processRequest (/src/middleware/handler.ts:15:5)
 */
export function filterStackTrace(stack: string | undefined): string | undefined {
  if (!stack) return undefined;

  const lines = stack.split('\n');
  const filtered: string[] = [];

  for (const line of lines) {
    // Keep the error message line
    if (!line.includes('at ')) {
      filtered.push(line);
      continue;
    }

    // Filter out node_modules and node internal frames
    if (line.includes('node_modules') || line.includes('node:internal')) {
      continue;
    }

    // Filter out built-in Node.js modules (vitest, express, etc internal frames)
    if (
      line.includes('(internal/') ||
      line.includes('at async') && (line.includes('vitest') || line.includes('node_modules'))
    ) {
      continue;
    }

    filtered.push(line);
  }

  // If we filtered everything, return original (better to show something than nothing)
  if (filtered.length <= 1) {
    return stack;
  }

  return filtered.join('\n');
}

/**
 * Safely serializes error details to prevent circular references and non-serializable values.
 */
export function safeStringify(obj: any, maxDepth = 3): any {
  const seen = new WeakSet();

  function sanitize(value: any, depth: number): any {
    // Prevent infinite recursion
    if (depth > maxDepth) {
      return '[Max depth exceeded]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (typeof value === 'symbol') {
        return `[Symbol(${String(value)})]`;
      }
      return value;
    }

    // Check for circular references
    if (seen.has(value)) {
      return '[Circular Reference]';
    }

    // Mark as seen for circular reference detection
    if (typeof value === 'object') {
      seen.add(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item, depth + 1));
    }

    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle errors
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
      };
    }

    // Handle plain objects
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitize(val, depth + 1);
    }

    return sanitized;
  }

  return sanitize(obj, 0);
}
