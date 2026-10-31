import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // the shared workspace package ships as TypeScript source, so it has to be bundled in
  noExternal: ['@logbook/shared'],
  external: ['better-sqlite3'],
});
