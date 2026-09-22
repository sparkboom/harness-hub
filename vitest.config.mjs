import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // `./generate` must resolve to generate.ts (the tested core), not
    // generate.mjs (the CLI shim) — Vite's default order prefers .mjs.
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
});
