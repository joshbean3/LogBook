import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.js';
import { quotes } from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

type Row = [string, string, string, string, string?];

/** Load the quote library once. Idempotent: existing ids are left alone. */
export const seedQuotes = (db: DB) => {
  const count = db.select({ n: sql<number>`count(*)` }).from(quotes).get()?.n ?? 0;
  const candidates = [path.join(here, 'data', 'quotes.json'), path.join(here, '..', 'data', 'quotes.json')];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    if (!count) console.warn('quotes.json not found; the quote library will be empty.');
    return;
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Row[];
  if (count >= rows.length) return;
  const insert = db.insert(quotes).values({ id: sql.placeholder('id'), text: sql.placeholder('text'), author: sql.placeholder('author'), theme: sql.placeholder('theme'), work: sql.placeholder('work') }).onConflictDoNothing().prepare();
  db.transaction(() => {
    for (const [id, text, author, theme, work] of rows) insert.run({ id, text, author: author ?? '', theme: theme ?? '', work: work ?? '' });
  });
  console.log(`Seeded ${rows.length - count} quotes.`);
};
