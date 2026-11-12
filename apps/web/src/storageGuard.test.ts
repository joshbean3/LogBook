import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A guardrail for the whole app: the phone's storage can refuse at any time. Safari throws on `localStorage` in a private
 * window with site data blocked, a full disk throws on every write, and a web view can hand back nothing at all. A read
 * or a write outside a `try` is then an exception at start-up or in the middle of a tap, and the screen it belongs to is
 * gone. So every use of `localStorage` or `sessionStorage` in the app sits inside a `try`, and falls back to a default.
 *
 * This reads the source (as caseNames.test.ts does): for each line that touches storage, a `try {` must open within the
 * 16 lines above it, with no `} catch` in between. When it fails, wrap the access:
 *
 *   try { v = localStorage.getItem(KEY) } catch { v = null }
 *
 * and read what comes back as untrusted (see `parseStoredPrefs` in lib/prefs.ts): anything in another shape is "nothing".
 */
const SRC = join(__dirname);
const USES = /\b(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/;
const files = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
};
const unguarded = (source: string): number[] => {
  const lines = source.split('\n');
  const out: number[] = [];
  lines.forEach((line, i) => {
    const text = line.trim();
    if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*') || !USES.test(line)) return;
    for (let j = i; j >= Math.max(0, i - 16); j--) {
      if (/\btry\s*\{/.test(lines[j]!)) return;
      if (j < i && /\}\s*catch\b/.test(lines[j]!)) break;
    }
    out.push(i + 1);
  });
  return out;
};

describe('storage is never touched outside a try', () => {
  it('the check itself sees a bare read and accepts a guarded one', () => {
    expect(unguarded(`const v = localStorage.getItem('k');`)).toEqual([1]);
    expect(unguarded(`try {\n  const v = localStorage.getItem('k');\n} catch {\n  /* none */\n}`)).toEqual([]);
    expect(unguarded(`try {\n  a();\n} catch {\n  b();\n}\nsessionStorage.setItem('k', '1');`)).toEqual([6]);
    expect(unguarded(`// localStorage.getItem('k') in a comment`)).toEqual([]);
  });
  it('holds for every source file', () => {
    const found = files(SRC).flatMap((p) => unguarded(readFileSync(p, 'utf8')).map((n) => `${p.slice(SRC.length + 1)}:${n}`));
    expect(found, `storage used outside a try (wrap it, and default safely):\n${found.join('\n')}`).toEqual([]);
  });
});
