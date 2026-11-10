import { chooseItem, QUOTE_THEMES, shiftDays, today, zJournalInput, zJournalPatch, zPickKind, zQuoteInput, zRecallKind, zRecallPrefs, type JournalEntry, type Quote } from '@logbook/shared';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { dailyPicks, journalEntries, quotePrefs, quotes, shownItems, userQuotes } from '../db/schema.js';
import { toEntry } from '../lib/map.js';
import { keyOf, recallToday, setRecallPrefs } from '../services/recall.js';
import { addTag, dayOf, markDay, removeTag, statsOf } from '../services/daytags.js';
import { isISODate, zDayTagAdd, zDayTagMark } from '@logbook/shared';
import { ApiError, nowISO, parseBody, parseQuery, uid } from '../lib/util.js';

export const journalRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  /**
   * "Contains this text", with % and _ matched as themselves (finding journal-26): searching "%" finds entries with a
   * percent sign, not every entry.
   */
  const contains = (col: SQL | AnyColumn, needle: string) => sql`lower(${col}) like ${`%${needle.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`} escape '\\'`;
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  // ---------- entries ----------
  r.get('/journal', (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ q: z.string().max(200).optional(), fav: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100), before: z.string().optional() }));
    const conds = [eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)];
    // a search of only spaces matches nothing; no search at all (q absent or "") lists everything
    if (q.q && !q.q.trim()) return c.json({ entries: [], more: false, total: 0 });
    if (q.q) conds.push(contains(journalEntries.text, q.q.trim()));
    if (q.fav === '1') conds.push(eq(journalEntries.fav, true));
    // every entry that matches the search and the favorite filter, whatever page this is (the header's "Entries 412")
    const total = db.select({ n: sql<number>`count(*)` }).from(journalEntries).where(and(...conds)).get()?.n ?? 0;
    if (q.before) conds.push(lt(journalEntries.createdAt, q.before));
    const rows = db.select().from(journalEntries).where(and(...conds)).orderBy(desc(journalEntries.date), desc(journalEntries.createdAt)).limit(q.limit + 1).all();
    const more = rows.length > q.limit;
    return c.json({ entries: rows.slice(0, q.limit).map(toEntry), more, total });
  });

  r.post('/journal', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zJournalInput);
    const id = uid('j');
    db.insert(journalEntries).values({ id, userId, date: body.date, text: body.text, fav: false, createdAt: nowISO(), editedAt: null, deletedAt: null }).run();
    return c.json(toEntry(db.select().from(journalEntries).where(eq(journalEntries.id, id)).get()!), 201);
  });

  r.patch('/journal/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zJournalPatch);
    const set: Partial<typeof journalEntries.$inferInsert> = {};
    if (body.text !== undefined) {
      set.text = body.text;
      set.editedAt = nowISO();
    }
    if (body.fav !== undefined) set.fav = body.fav;
    const n = db.update(journalEntries).set(set).where(and(eq(journalEntries.userId, userId), eq(journalEntries.id, c.req.param('id')), isNull(journalEntries.deletedAt))).run().changes;
    if (!n) throw new ApiError(404, 'Entry not found');
    return c.json(toEntry(db.select().from(journalEntries).where(eq(journalEntries.id, c.req.param('id'))).get()!));
  });

  r.delete('/journal/:id', (c) => {
    const userId = uidOf(c);
    const n = db.update(journalEntries).set({ deletedAt: nowISO() }).where(and(eq(journalEntries.userId, userId), eq(journalEntries.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Entry not found');
    return c.json({ ok: true });
  });

  r.post('/journal/:id/restore', (c) => {
    const userId = uidOf(c);
    const n = db.update(journalEntries).set({ deletedAt: null }).where(and(eq(journalEntries.userId, userId), eq(journalEntries.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Entry not found');
    return c.json(toEntry(db.select().from(journalEntries).where(eq(journalEntries.id, c.req.param('id'))).get()!));
  });

  // ---------- quotes ----------
  const prefsOf = (userId: string) => {
    const rows = db.select().from(quotePrefs).where(eq(quotePrefs.userId, userId)).all();
    return { favs: new Set(rows.filter((x) => x.fav).map((x) => x.quoteId)), hidden: new Set(rows.filter((x) => x.hidden).map((x) => x.quoteId)) };
  };
  const mineOf = (userId: string, favs: Set<string>): Quote[] =>
    db
      .select()
      .from(userQuotes)
      .where(and(eq(userQuotes.userId, userId), isNull(userQuotes.deletedAt)))
      .orderBy(desc(userQuotes.createdAt))
      .all()
      .map((q) => ({ id: q.id, text: q.text, author: q.author, theme: 'Yours', work: '', mine: true, fav: favs.has(q.id) }));

  r.get('/quotes', (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ theme: z.string().optional(), q: z.string().max(120).optional(), fav: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(40), offset: z.coerce.number().int().min(0).default(0) }));
    const { favs, hidden } = prefsOf(userId);
    const mine = mineOf(userId, favs);
    const needle = q.q?.trim().toLowerCase();
    const matches = (x: Quote) => !needle || x.text.toLowerCase().includes(needle) || x.author.toLowerCase().includes(needle) || x.work.toLowerCase().includes(needle);
    let list: Quote[];
    if (q.fav === '1') {
      const favIds = [...favs].filter((id) => !id.startsWith('q_'));
      const lib = favIds.length ? db.select().from(quotes).where(inArray(quotes.id, favIds)).all() : [];
      list = [...mine.filter((x) => x.fav), ...lib.map((x) => ({ ...x, mine: false, fav: true }))].filter(matches);
      return c.json({ total: list.length, quotes: list.slice(q.offset, q.offset + q.limit), themes: QUOTE_THEMES });
    }
    if (q.theme === 'Yours') {
      list = mine.filter(matches);
      return c.json({ total: list.length, quotes: list.slice(q.offset, q.offset + q.limit), themes: QUOTE_THEMES });
    }
    const conds = [];
    if (q.theme && q.theme !== 'All') conds.push(eq(quotes.theme, q.theme));
    if (needle) {
      conds.push(or(contains(quotes.text, needle), contains(quotes.author, needle), contains(quotes.work, needle))!);
    }
    if (hidden.size) conds.push(sql`${quotes.id} not in (${sql.join([...hidden].map((h) => sql`${h}`), sql`, `)})`);
    const where = conds.length ? and(...conds) : undefined;
    const total = db.select({ n: sql<number>`count(*)` }).from(quotes).where(where).get()?.n ?? 0;
    const head = q.offset === 0 && (!q.theme || q.theme === 'All') ? mine.filter(matches) : [];
    const lib = db.select().from(quotes).where(where).orderBy(asc(quotes.author), asc(quotes.id)).limit(q.limit).offset(q.offset).all();
    return c.json({ total: total + (!q.theme || q.theme === 'All' ? mine.filter(matches).length : 0), quotes: [...head, ...lib.map((x) => ({ ...x, mine: false, fav: favs.has(x.id) }))], themes: QUOTE_THEMES });
  });

  r.post('/quotes', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zQuoteInput);
    const id = uid('q_');
    db.insert(userQuotes).values({ id, userId, text: body.text, author: body.author, createdAt: nowISO(), deletedAt: null }).run();
    db.insert(quotePrefs).values({ userId, quoteId: id, fav: true, hidden: false }).onConflictDoUpdate({ target: [quotePrefs.userId, quotePrefs.quoteId], set: { fav: true } }).run();
    const out: Quote = { id, text: body.text, author: body.author, theme: 'Yours', work: '', mine: true, fav: true };
    return c.json(out, 201);
  });

  r.delete('/quotes/:id', (c) => {
    const userId = uidOf(c);
    const n = db.update(userQuotes).set({ deletedAt: nowISO() }).where(and(eq(userQuotes.userId, userId), eq(userQuotes.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Quote not found');
    return c.json({ ok: true });
  });

  r.put('/quotes/:id/prefs', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, z.object({ fav: z.boolean().optional(), hidden: z.boolean().optional() }));
    const id = c.req.param('id');
    const cur = db.select().from(quotePrefs).where(and(eq(quotePrefs.userId, userId), eq(quotePrefs.quoteId, id))).get();
    const fav = body.fav ?? cur?.fav ?? false;
    const hidden = body.hidden ?? cur?.hidden ?? false;
    db.insert(quotePrefs).values({ userId, quoteId: id, fav, hidden }).onConflictDoUpdate({ target: [quotePrefs.userId, quotePrefs.quoteId], set: { fav, hidden } }).run();
    return c.json({ id, fav, hidden });
  });

  // ---------- today's picks ----------
  const lastShownMap = (userId: string, kind: string) => {
    const rows = db.select().from(shownItems).where(and(eq(shownItems.userId, userId), eq(shownItems.kind, kind))).all();
    const m = new Map(rows.map((x) => [x.itemId, x.lastShown]));
    return (id: string) => m.get(id) ?? null;
  };
  const record = (userId: string, kind: string, itemId: string, date: string) => {
    db.transaction((tx) => {
      tx.insert(dailyPicks).values({ userId, date, kind, itemId }).onConflictDoUpdate({ target: [dailyPicks.userId, dailyPicks.date, dailyPicks.kind], set: { itemId } }).run();
      tx.insert(shownItems).values({ userId, kind, itemId, lastShown: date }).onConflictDoUpdate({ target: [shownItems.userId, shownItems.kind, shownItems.itemId], set: { lastShown: date } }).run();
      tx.delete(shownItems).where(and(eq(shownItems.userId, userId), lt(shownItems.lastShown, shiftDays(date, -90)))).run();
      tx.delete(dailyPicks).where(and(eq(dailyPicks.userId, userId), lt(dailyPicks.date, shiftDays(date, -14)))).run();
    });
  };
  const memoryPool = (userId: string, date: string) =>
    db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt), lt(journalEntries.date, date)))
      .all()
      .map(toEntry);
  const quotePool = (userId: string): Quote[] => {
    const { favs, hidden } = prefsOf(userId);
    const lib = db.select().from(quotes).all().filter((x) => !hidden.has(x.id)).map((x) => ({ ...x, mine: false, fav: favs.has(x.id) }));
    return [...mineOf(userId, favs), ...lib];
  };
  const pick = (userId: string, kind: 'memory' | 'quote', date: string, reroll: boolean): JournalEntry | Quote | null => {
    const cur = db.select().from(dailyPicks).where(and(eq(dailyPicks.userId, userId), eq(dailyPicks.date, date), eq(dailyPicks.kind, kind))).get();
    const items = kind === 'memory' ? memoryPool(userId, date) : quotePool(userId);
    if (!reroll && cur) {
      const hit = items.find((x) => x.id === cur.itemId);
      if (hit) return hit;
    }
    const chosen = chooseItem<JournalEntry | Quote>(items, lastShownMap(userId, kind), date, reroll ? cur?.itemId : null);
    if (!chosen) return null;
    record(userId, kind, chosen.id, date);
    return chosen;
  };

  r.get('/journal/daily', (c) => {
    const userId = uidOf(c);
    const date = c.get('today');
    const memory = pick(userId, 'memory', date, false);
    const quote = pick(userId, 'quote', date, false);
    const pastCount = memoryPool(userId, date).length;
    return c.json({ date, memory, quote, pastCount });
  });

  r.post('/journal/daily/another', async (c) => {
    const userId = uidOf(c);
    const { kind } = await parseBody(c.req.raw, z.object({ kind: zPickKind }));
    const item = pick(userId, kind, c.get('today'), true);
    return c.json({ kind, item });
  });

  // ---------- remember when (services/recall.ts) ----------
  r.get('/journal/recall', async (c) => c.json(await recallToday(db, uidOf(c), c.get('today'))));

  r.post('/journal/recall/another', async (c) => c.json(await recallToday(db, uidOf(c), c.get('today'), { another: true })));

  r.put('/journal/recall/:kind/:id', async (c) => {
    const userId = uidOf(c);
    const kind = zRecallKind.safeParse(c.req.param('kind'));
    if (!kind.success) throw new ApiError(404, 'Nothing to remember there');
    const id = c.req.param('id');
    const body = await parseBody(c.req.raw, zRecallPrefs);
    if (!setRecallPrefs(db, userId, kind.data, id, body)) throw new ApiError(404, 'Nothing to remember there');
    // un-hiding (Undo) puts it back as today's; hiding moves on to the next
    return c.json(await recallToday(db, userId, c.get('today'), { prefer: body.hidden === false ? keyOf({ kind: kind.data, id }) : undefined }));
  });

  // ---------- day tags (services/daytags.ts) ----------
  const dayParam = (c: { req: { param: (k: string) => string }; get: (k: 'today') => string }) => {
    const d = c.req.param('date');
    if (!isISODate(d)) throw new ApiError(400, 'That isn’t a day.', 'bad_date');
    if (d > c.get('today')) throw new ApiError(422, 'That day has not come yet');
    return d;
  };
  r.get('/journal/tags/stats', (c) => c.json(statsOf(db, uidOf(c))));
  r.post('/journal/tags', async (c) => c.json({ tags: addTag(db, uidOf(c), (await parseBody(c.req.raw, zDayTagAdd)).label) }));
  r.delete('/journal/tags/:id', (c) => c.json({ tags: removeTag(db, uidOf(c), c.req.param('id')) }));
  r.get('/journal/tags/:date', (c) => c.json(dayOf(db, uidOf(c), dayParam(c))));
  r.put('/journal/tags/:date', async (c) => {
    const date = dayParam(c);
    const body = await parseBody(c.req.raw, zDayTagMark);
    return c.json(markDay(db, uidOf(c), date, body.tag, body.value));
  });

  return r;
};
