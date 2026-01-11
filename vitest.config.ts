import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Allows using describe, it, expect without importing them
    globals: true, 
    // Uses Node.js environment for testing Express/Mongoose logic
    environment: 'node', 
    // Patterns to find your test files
    include: ['tests/**/*.test.ts'],
    // Ensures coverage reports don't include the tests themselves
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
});