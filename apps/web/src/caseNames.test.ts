import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * macOS ignores case in file names; Linux does not. Two modules in one folder whose import paths differ only in case
 * ('./MorningCard' and './morningCard') build here and break on a Mac, where one import picks up the other's file.
 * Stylesheets are imported with their extension, so `Shell.tsx` beside `shell.css` is fine.
 */
const MODULE = /\.(test\.)?(tsx?|jsx?|mjs)$/;
const clashes = (dir: string, out: string[] = []): string[] => {
  const names = readdirSync(dir);
  const seen = new Map<string, string>();
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      clashes(p, out);
      continue;
    }
    if (!MODULE.test(n)) continue;
    const key = n.replace(MODULE, '').toLowerCase() + (n.includes('.test.') ? '.test' : '');
    const other = seen.get(key);
    if (other) out.push(`${join(dir, other)} <-> ${p}`);
    else seen.set(key, n);
  }
  return out;
};

describe('file names', () => {
  it('no two modules in a folder differ only in case', () => {
    expect(clashes(join(__dirname))).toEqual([]);
  });
});
