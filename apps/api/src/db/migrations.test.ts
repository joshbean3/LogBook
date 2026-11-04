import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const journal = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'drizzle', 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string; when: number }> };

/**
 * Production once ran a newer server whose migrations are recorded with stamps up to this one. Drizzle runs a migration
 * only when its stamp is later than the newest it has recorded, so a migration added here with an earlier stamp would be
 * skipped in production, silently: its tables would never exist there.
 */
const PRODUCTION_HIGH_WATER = 1793100000000;

describe('the migration journal', () => {
  it('stamps every migration after 0012 later than anything production has recorded, in order', () => {
    const later = journal.entries.filter((e) => e.idx > 12);
    for (const e of later) expect(e.when, `${e.tag} must be stamped after ${PRODUCTION_HIGH_WATER}`).toBeGreaterThan(PRODUCTION_HIGH_WATER);
    const whens = journal.entries.map((e) => e.when);
    expect([...whens].sort((a, b) => a - b)).toEqual(whens);
  });
});
