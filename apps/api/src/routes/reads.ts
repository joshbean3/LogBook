import { daysBetween, today, zDate, zLinkInput, zLinkPatch, zPickFeedback, type Link, type LinkSource, type LinkVerdict, type PickResult } from '@logbook/shared';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { links } from '../db/schema.js';
import { ApiError, nowISO, parseBody, parseQuery, uid } from '../lib/util.js';
import { cleanPick, normalizeUrl, pickerFor, readPage, sameResource, siteOf, type TasteInput } from '../services/reads.js';

/** Manual refreshes allowed on top of the day's one pick. */
const REFRESHES_PER_DAY = 3;

export const toLink = (r: InferSelectModel<typeof links>): Link => ({
  id: r.id,
  url: r.url,
  title: r.title,
  siteName: r.siteName,
  description: r.description,
  imageUrl: r.imageUrl,
  note: r.note,
  tags: (() => {
    try {
      const t = JSON.parse(r.tagsJson) as unknown;
      return Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })(),
  addedAt: r.addedAt,
  readAt: r.readAt,
  source: (r.source === 'pick' ? 'pick' : 'me') as LinkSource,
  pickReason: r.pickReason,
  pickDate: r.pickDate,
  verdict: (r.verdict === 'saved' || r.verdict === 'dismissed' ? r.verdict : null) as LinkVerdict | null,
});

/** Unread first, then newest first. */
const order = (a: Link, b: Link) => (!!a.readAt === !!b.readAt ? (a.addedAt < b.addedAt ? 1 : -1) : a.readAt ? 1 : -1);

export const readsRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;
  /** One generation at a time per user and day, so two screens asking at once share the answer. */
  const inFlight = new Map<string, Promise<Link | null>>();

  const live = (userId: string) => and(eq(links.userId, userId), isNull(links.deletedAt));
  const one = (userId: string, id: string) => db.select().from(links).where(and(eq(links.userId, userId), eq(links.id, id))).get();
  /** The list the athlete sees: what they saved, and the picks they kept. */
  const saved = (userId: string): Link[] =>
    db
      .select()
      .from(links)
      .where(and(live(userId), or(eq(links.source, 'me'), eq(links.verdict, 'saved'))))
      .all()
      .map(toLink)
      .sort(order);

  r.get('/reads', (c) => c.json({ links: saved(uidOf(c)) }));

  r.post('/reads', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zLinkInput);
    const url = normalizeUrl(body.url);
    const all = db.select().from(links).where(eq(links.userId, userId)).all();
    const twin = all.find((x) => sameResource(x.url, url));
    if (twin) {
      // already here: a kept link comes back as is, a waiting pick is kept, a deleted one comes back
      const set: Partial<typeof links.$inferInsert> = {};
      if (twin.deletedAt) set.deletedAt = null;
      if (twin.source === 'pick' && twin.verdict !== 'saved') set.verdict = 'saved';
      if (body.note) set.note = body.note;
      if (Object.keys(set).length) db.update(links).set(set).where(eq(links.id, twin.id)).run();
      return c.json(toLink(one(userId, twin.id)!), 200);
    }
    const page = await readPage(url);
    const id = uid('l');
    db.insert(links)
      .values({ id, userId, url: page.fetched ? page.finalUrl : url, title: page.meta.title, siteName: page.meta.siteName, description: page.meta.description, imageUrl: page.meta.imageUrl, note: body.note || null, tagsJson: '[]', addedAt: nowISO(), readAt: null, source: 'me', pickReason: null, pickDate: null, verdict: null, deletedAt: null })
      .run();
    return c.json(toLink(one(userId, id)!), 201);
  });

  r.patch('/reads/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zLinkPatch);
    const id = c.req.param('id');
    const cur = one(userId, id);
    if (!cur || cur.deletedAt) throw new ApiError(404, 'Link not found');
    const set: Partial<typeof links.$inferInsert> = {};
    if (body.readAt !== undefined) set.readAt = body.readAt;
    if (body.note !== undefined) set.note = body.note || null;
    if (body.tags !== undefined) set.tagsJson = JSON.stringify([...new Set(body.tags.map((t) => t.toLowerCase()))]);
    if (body.verdict !== undefined) {
      if (cur.source !== 'pick') throw new ApiError(422, 'Only a pick takes a verdict.', 'not_a_pick');
      set.verdict = body.verdict;
    }
    if (Object.keys(set).length) db.update(links).set(set).where(eq(links.id, id)).run();
    return c.json(toLink(one(userId, id)!));
  });

  r.delete('/reads/:id', (c) => {
    const userId = uidOf(c);
    const n = db.update(links).set({ deletedAt: nowISO() }).where(and(live(userId), eq(links.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Link not found');
    return c.json({ ok: true });
  });

  r.post('/reads/:id/restore', (c) => {
    const userId = uidOf(c);
    const n = db.update(links).set({ deletedAt: null }).where(and(eq(links.userId, userId), eq(links.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Link not found');
    return c.json(toLink(one(userId, c.req.param('id'))!));
  });

  // ---------- today's pick ----------
  /** Every pick made for the day, deleted ones included (they still count toward the cap), newest first. */
  const picksOn = (userId: string, date: string) =>
    db
      .select()
      .from(links)
      .where(and(eq(links.userId, userId), eq(links.source, 'pick'), eq(links.pickDate, date)))
      .orderBy(desc(links.addedAt))
      .all();
  /** Attempts per user and day, failures included, so a search that comes back empty still spends a refresh. */
  const attempts = new Map<string, number>();
  /** Yesterday's counts are of no use: drop every key that is not for today whenever the map is read. */
  const prune = () => {
    const t = today();
    for (const k of attempts.keys()) if (!k.endsWith(`:${t}`)) attempts.delete(k);
  };
  const usedToday = (userId: string, date: string, rows: number) => {
    prune();
    return Math.max(rows, attempts.get(`${userId}:${date}`) ?? 0);
  };
  const leftAfter = (used: number) => Math.max(0, REFRESHES_PER_DAY - Math.max(0, used - 1));

  const generate = async (userId: string, date: string): Promise<Link | null> => {
    const picker = pickerFor();
    if (!picker) return null;
    const rows = db.select().from(links).where(eq(links.userId, userId)).all();
    const newest = (a: Link, b: Link) => (a.addedAt < b.addedAt ? 1 : -1);
    const input: TasteInput = {
      today: date,
      // deleted links still count as known, so a pick never brings back what was thrown out, but they no longer shape the taste
      saved: rows.filter((x) => !x.deletedAt && (x.source === 'me' || x.verdict === 'saved')).map(toLink).sort(newest),
      dismissed: rows.filter((x) => x.source === 'pick' && x.verdict === 'dismissed').map(toLink).sort(newest),
      known: [...new Set(rows.map((x) => x.url))],
    };
    const out = cleanPick(await picker.generate(input), input.known);
    const page = picker.fake ? null : await readPage(out.url, { timeoutMs: 8_000 });
    const id = uid('l');
    db.insert(links)
      .values({
        id,
        userId,
        url: page?.fetched ? page.finalUrl : out.url,
        title: out.title || page?.meta.title || siteOf(out.url),
        siteName: page?.meta.siteName || siteOf(out.url),
        description: page?.meta.description ?? null,
        imageUrl: page?.meta.imageUrl ?? null,
        note: null,
        tagsJson: JSON.stringify(out.tags),
        addedAt: nowISO(),
        readAt: null,
        source: 'pick',
        pickReason: out.why || null,
        pickDate: date,
        verdict: null,
        deletedAt: null,
      })
      .run();
    return toLink(one(userId, id)!);
  };

  r.get('/reads/pick', async (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ date: zDate.optional(), force: z.string().optional() }));
    const date = q.date ?? today();
    const force = q.force === '1' || q.force === 'true';
    const result = (pick: Link | null, reason: PickResult['reason'], refreshesLeft: number): PickResult => ({ date, pick, reason, refreshesLeft });
    if (!pickerFor()) return c.json(result(null, 'off', 0));
    const key = `${userId}:${date}`;
    const todays = picksOn(userId, date);
    const current = todays.find((x) => !x.deletedAt) ? toLink(todays.find((x) => !x.deletedAt)!) : null;
    const left = leftAfter(usedToday(userId, date, todays.length));
    if (current && !force) return c.json(result(current, null, left));
    // the day's one pick plus three refreshes, counting the ones that were deleted and the searches that found nothing
    if (left <= 0 && (force || todays.length || attempts.has(key))) return c.json(result(current, 'limit', 0));
    // a pick is made for today (give or take a day for the phone's clock), never for the past or the future
    if (Math.abs(daysBetween(today(), date)) > 1) return c.json(result(current, current ? null : 'failed', left));
    if (!saved(userId).length) return c.json(result(null, 'empty', left));
    let job = inFlight.get(key);
    if (!job) {
      attempts.set(key, usedToday(userId, date, todays.length) + 1);
      job = generate(userId, date).finally(() => inFlight.delete(key));
      inFlight.set(key, job);
    }
    try {
      const pick = await job;
      const after = leftAfter(usedToday(userId, date, picksOn(userId, date).length));
      return c.json(result(pick ?? current, pick ? null : 'failed', after));
    } catch (e) {
      if (!(e instanceof ApiError)) console.error(e);
      return c.json(result(current, 'failed', leftAfter(usedToday(userId, date, picksOn(userId, date).length))));
    }
  });

  r.post('/reads/pick/feedback', async (c) => {
    const userId = uidOf(c);
    const { id, verdict } = await parseBody(c.req.raw, zPickFeedback);
    const cur = one(userId, id);
    if (!cur || cur.deletedAt || cur.source !== 'pick') throw new ApiError(404, 'Pick not found');
    db.update(links).set({ verdict }).where(eq(links.id, id)).run();
    return c.json(toLink(one(userId, id)!));
  });

  return r;
};
