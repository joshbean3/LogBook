import { defineConfig } from 'tsup';

export default defineConfig({
  // index: the server. ops: operator commands (backup now, revoke sessions), see RUNBOOK.md
  entry: ['src/index.ts', 'src/ops.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // the shared workspace package ships as TypeScript source, so it has to be bundled in
  noExternal: ['@logbook/shared'],
  external: ['better-sqlite3'],
});
