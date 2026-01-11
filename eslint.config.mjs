import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config'; // Native ESLint helper
import tseslint from 'typescript-eslint';

export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["*.config.ts", "*.config.mjs"],
    // Spread the object directly; 'extends' is not valid here in Flat Config
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Global ignores must be in their own object
    ignores: ["dist/**", "node_modules/**"],
  }
);