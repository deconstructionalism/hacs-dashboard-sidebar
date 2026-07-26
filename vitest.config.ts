import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic unit tests only. The browser render test runs under
    // web-test-runner (real Chromium), not here.
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.browser.test.ts', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
