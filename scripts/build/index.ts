import { rm } from 'node:fs/promises';

import { $, type BuildConfig, build } from 'bun';

const outdir = 'dist';
const config = {
  entrypoints: ['src/index.ts'],
  outdir,
  plugins: [],
  target: 'browser',
} satisfies BuildConfig;

await rm(outdir, { recursive: true, force: true });
await build(config);
await $`tsc`;
