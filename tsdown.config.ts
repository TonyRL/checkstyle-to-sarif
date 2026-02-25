import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
