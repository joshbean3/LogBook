import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './index.js';
import { dailyPicks, quotePrefs, quotes } from './schema.js';
import { seedQuotes } from './seed.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'quotes.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown[];

/** The quote library for a US release (finding copy-legal-18). */
describe('quotes.json', () => {
  it('every row is [id, text, author, theme, source], all filled, ids unique', () => {
    expect(rows.length).toBeGreaterThan(3000);
    const ids = new Set<string>();
    for (const r of rows) {
      expect(Array.isArray(r) && r.length === 5, JSON.stringify(r)).toBe(true);
      const [id, text, author, theme, source] = r as string[];
      for (const v of [id, text, author, theme, source]) expect(typeof v === 'string' && v.trim().length > 0, JSON.stringify(r)).toBe(true);
      expect(ids.has(id!), id).toBe(false);
      ids.add(id!);
    }
  });

  it('has no Kafka, Hesse, Rumi or Mann rows (translations still in copyright), and no bracket-damaged text', () => {
    for (const r of rows as string[][]) {
      expect(r[2]!, r[1]).not.toMatch(/Kafka|Hesse|Rumi|Thomas Mann/i);
      const t = r[1]!;
      expect(t.split('(').length, t).toBe(t.split(')').length);
      expect(t.split('[').length, t).toBe(t.split(']').length);
      expect(t.split('“').length, t).toBe(t.split('”').length);
    }
  });

  it('seeding keeps the table the same as the file: a removed row goes, with the picks and favourites that named it', () => {
    const { db } = openDatabase(':memory:');
    seedQuotes(db, file);
    expect(db.select().from(quotes).all()).toHaveLength(rows.length);
    db.insert(quotes).values({ id: 'gone01', text: 'A line no longer in the file.', author: 'Someone', theme: 'Time', work: '' }).run();
    db.insert(quotePrefs).values({ userId: 'u1', quoteId: 'gone01', fav: true, hidden: false }).run();
    db.insert(quotePrefs).values({ userId: 'u1', quoteId: 'q_mine', fav: true, hidden: false }).run();
    db.insert(dailyPicks).values({ userId: 'u1', date: '2026-11-10', kind: 'quote', itemId: 'gone01' }).run();
    seedQuotes(db, file);
    expect(db.select().from(quotes).where(eq(quotes.id, 'gone01')).get()).toBeUndefined();
    expect(db.select().from(quotePrefs).all().map((p) => p.quoteId)).toEqual(['q_mine']);
    expect(db.select().from(dailyPicks).all()).toEqual([]);
    expect(db.select().from(quotes).all()).toHaveLength(rows.length);
  });
});
