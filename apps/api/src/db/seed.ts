import { and, eq, inArray, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.js';
import { dailyPicks, quotePrefs, quotes, shownItems } from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

type Row = [string, string, string, string, string?];

/**
 * Keep the quote library the same as quotes.json: add the rows it has and the table lacks, and remove library rows it no
 * longer has (rows taken out for a US release, copy-legal-18), with the favourites, hides and day picks that pointed at
 * them, so a removed quote never shows again. A person's own quotes live elsewhere and are never touched.
 */
export const seedQuotes = (db: DB, file?: string) => {
  const candidates = file ? [file] : [path.join(here, 'data', 'quotes.json'), path.join(here, '..', 'data', 'quotes.json')];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    if (!(db.select({ n: sql<number>`count(*)` }).from(quotes).get()?.n ?? 0)) console.warn('quotes.json not found; the quote library will be empty.');
    return;
  }
  const rows = JSON.parse(fs.readFileSync(found, 'utf8')) as Row[];
  const want = new Set(rows.map((r) => r[0]));
  const have = new Set(db.select({ id: quotes.id }).from(quotes).all().map((q) => q.id));
  const gone = [...have].filter((id) => !want.has(id));
  const added = rows.filter((r) => !have.has(r[0]));
  if (!gone.length && !added.length) return;
  const insert = db.insert(quotes).values({ id: sql.placeholder('id'), text: sql.placeholder('text'), author: sql.placeholder('author'), theme: sql.placeholder('theme'), work: sql.placeholder('work') }).onConflictDoNothing().prepare();
  db.transaction(() => {
    for (const [id, text, author, theme, work] of added) insert.run({ id, text, author: author ?? '', theme: theme ?? '', work: work ?? '' });
    for (let i = 0; i < gone.length; i += 500) {
      const part = gone.slice(i, i + 500);
      db.delete(quotePrefs).where(inArray(quotePrefs.quoteId, part)).run();
      db.delete(dailyPicks).where(and(eq(dailyPicks.kind, 'quote'), inArray(dailyPicks.itemId, part))).run();
      db.delete(shownItems).where(and(eq(shownItems.kind, 'quote'), inArray(shownItems.itemId, part))).run();
      db.delete(quotes).where(inArray(quotes.id, part)).run();
    }
  });
  console.log(`Quote library: ${added.length} added, ${gone.length} removed.`);
};
