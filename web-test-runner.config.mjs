import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'src/**/*.browser.test.ts',
  nodeResolve: true,
  concurrency: 1,
  // Compile TypeScript (including the Lit decorators, per tsconfig) on the fly.
  plugins: [esbuildPlugin({ ts: true, target: 'es2021', tsconfig: 'tsconfig.json' })],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  testFramework: {
    config: { timeout: '10000' },
  },
};
