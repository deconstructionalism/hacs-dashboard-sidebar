import js from '@eslint/js';
import lit from 'eslint-plugin-lit';
import wc from 'eslint-plugin-wc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'rollup.config.mjs', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  lit.configs['flat/recommended'],
  wc.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Home Assistant's `hass` object is untyped in many places; allow `any`
      // deliberately rather than littering the code with casts.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
