import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const dev = Boolean(process.env.ROLLUP_WATCH);

export default {
  input: 'src/dashboard-sidebar-card.ts',
  output: {
    file: 'dist/dashboard-sidebar-card.js',
    format: 'es',
    sourcemap: dev,
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({ tsconfig: './tsconfig.json' }),
    !dev && terser({ format: { comments: false } }),
  ].filter(Boolean),
};
