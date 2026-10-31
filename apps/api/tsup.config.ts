import { defineConfig } from 'tsup';

export default defineConfig({
  // two processes from one build: the API and the worker (README: The worker process)
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // the shared workspace package ships as TypeScript source, so it has to be bundled in
  noExternal: ['@logbook/shared'],
  // better-sqlite3 is native; @sentry/node is loaded only when SENTRY_DSN is set
  external: ['better-sqlite3', '@sentry/node'],
});
