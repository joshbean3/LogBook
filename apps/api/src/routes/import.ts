import { normalizeMorningSettings, METERS_PER_MILE } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { activities, coachReads, dailyPicks, habitChecks, habits, journalEntries, liftSets, morningDays, planBlocks, quotePrefs, shownItems, todos, trainingSessions, userQuotes } from '../db/schema.js';
import { ApiError, nowISO } from '../lib/util.js';
import { readSetting, writeSetting } from './core.js';

/**
 * Brings everything over from the original Logbook dashboard (the claude.ai artifact).
 * The bundle is the artifact's private documents, keyed the way they were stored there:
 *   habits {items:[{id,name,created,archived?}]}
 *   blocks {items:{id:{name,start,end,source,summary,created}}}
 *   plans  {YYYY-MM: {days:{date:{sessions:[{id,kind,type,title,details,miles,minutes,block?,movedFrom?}]}}}}
 *   logs   {YYYY-MM: {days:{date:{done:{habitId:bool}, notes:{habitId:str}, note, s:{sessionId:mark}, acts:{id:{...}}, coach:{key:{text,at}}}}}}
 *   lifts  {YYYY-MM: {sets:{id:{date,ex,w,r,at,gone?}}}}
 *   journal{YYYY-MM: {entries:{id:{date,text,at,fav?,edited?}}}}
 *   morning {settings, days}
 *   todos   {items:{id:{text,created,done,deleted,at}}}
 *   picks   {daily:{date:{n,q}}, shown:{"n:id"|"q:id": date}}
 *   quotes_mine {favs:{id:true}, hidden:{id:true}, added:{k:{text,author,at}}}
 * Idempotent: rows that already exist are left alone, so it is safe to run twice.
 */
const zBundle = z
  .object({
    version: z.number().optional(),
    habits: z.any().optional(),
    blocks: z.any().optional(),
    plans: z.record(z.string(), z.any()).optional(),
    logs: z.record(z.string(), z.any()).optional(),
    lifts: z.record(z.string(), z.any()).optional(),
    journal: z.record(z.string(), z.any()).optional(),
    morning: z.any().optional(),
    todos: z.any().optional(),
    picks: z.any().optional(),
    quotes_mine: z.any().optional(),
  })
  .passthrough();

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 600): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export const importRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  r.post('/import', async (c) => {
    const userId = c.get('user').id;
    const raw = await c.req.json().catch(() => null);
    const parsed = zBundle.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, 'That file isn’t a Logbook export.', 'bad_bundle');
    const b = parsed.data;
    const now = nowISO();
    const counts: Record<string, number> = {};
    const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

    db.transaction((tx) => {
      // ---------- habits ----------
      const habitItems: any[] = Array.isArray(b.habits?.items) ? b.habits.items : [];
      habitItems.forEach((h, i) => {
        if (!h || typeof h.id !== 'string' || !str(h.name, 80)) return;
        const res = tx
          .insert(habits)
          .values({ id: h.id, userId, name: str(h.name, 80)!, position: i, createdOn: isDate(h.created) ? h.created : now.slice(0, 10), archivedOn: isDate(h.archived) ? h.archived : null })
          .onConflictDoNothing()
          .run();
        if (res.changes) bump('habits');
      });

      // ---------- blocks ----------
      for (const [id, blk] of Object.entries<any>(b.blocks?.items ?? {})) {
        if (!blk || blk.removed || !isDate(blk.start) || !isDate(blk.end)) continue;
        const res = tx
          .insert(planBlocks)
          .values({ id, userId, name: str(blk.name, 80) ?? 'Imported plan', start: blk.start, end: blk.end, source: str(blk.source, 40), summary: str(blk.summary, 300), createdAt: typeof blk.created === 'string' ? blk.created : now })
          .onConflictDoNothing()
          .run();
        if (res.changes) bump('blocks');
      }

      // marks live in the logs; collect them first so sessions get them on insert
      const marks = new Map<string, string>();
      for (const log of Object.values<any>(b.logs ?? {})) for (const day of Object.values<any>(log?.days ?? {})) for (const [sid, m] of Object.entries<any>(day?.s ?? {})) if (m === 'done' || m === 'floor' || m === 'skip') marks.set(sid, m);

      // ---------- plan sessions ----------
      for (const plan of Object.values<any>(b.plans ?? {})) {
        for (const [date, day] of Object.entries<any>(plan?.days ?? {})) {
          if (!isDate(date) || !Array.isArray(day?.sessions)) continue;
          day.sessions.forEach((s: any, i: number) => {
            if (!s || typeof s.id !== 'string') return;
            const kind = ['run', 'lift', 'cross', 'rest'].includes(s.kind) ? s.kind : 'run';
            const res = tx
              .insert(trainingSessions)
              .values({
                id: s.id,
                userId,
                date,
                position: i,
                kind,
                type: str(s.type, 30),
                title: str(s.title, 60),
                details: str(s.details, 600),
                miles: kind === 'run' ? num(s.miles) : null,
                minutes: num(s.minutes) != null ? Math.round(num(s.minutes)!) : null,
                blockId: typeof s.block === 'string' ? s.block : null,
                movedFrom: isDate(s.movedFrom) ? s.movedFrom : null,
                mark: marks.get(s.id) ?? null,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing()
              .run();
            if (res.changes) bump('sessions');
          });
        }
      }

      // ---------- logs: habit checks, day notes, activities, coach reads ----------
      const noteEntryIds = new Map<string, string>();
      for (const log of Object.values<any>(b.logs ?? {})) {
        for (const [date, day] of Object.entries<any>(log?.days ?? {})) {
          if (!isDate(date) || !day) continue;
          const done = day.done ?? {};
          const notes = day.notes ?? {};
          for (const habitId of new Set([...Object.keys(done), ...Object.keys(notes)])) {
            const res = tx
              .insert(habitChecks)
              .values({ userId, habitId, date, done: !!done[habitId], note: str(notes[habitId], 280), updatedAt: now })
              .onConflictDoNothing()
              .run();
            if (res.changes) bump('habitChecks');
          }
          const note = str(day.note, 5000);
          if (note) {
            // a stable id per legacy day note keeps a second import from duplicating it
            const id = `jnote-${date}`;
            const res = tx.insert(journalEntries).values({ id, userId, date, text: note, fav: false, createdAt: `${date}T21:00:00.000Z`, editedAt: null, deletedAt: null }).onConflictDoNothing().run();
            noteEntryIds.set(`note-${date}`, id);
            if (res.changes) bump('journal');
          }
          for (const [aid, a] of Object.entries<any>(day.acts ?? {})) {
            if (!a) continue;
            const kind = ['run', 'lift', 'cross'].includes(a.kind) ? a.kind : 'run';
            const res = tx
              .insert(activities)
              .values({
                id: aid,
                userId,
                date,
                time: typeof a.time === 'string' ? a.time : null,
                name: str(a.name, 120) ?? 'Activity',
                sportType: str(a.type, 40) ?? 'Run',
                kind,
                distanceM: (num(a.miles) ?? 0) * METERS_PER_MILE,
                movingSec: Math.round(num(a.moving) ?? 0),
                elapsedSec: Math.round(num(a.moving) ?? 0),
                elevM: (num(a.elev) ?? 0) / 3.28084,
                avgHr: num(a.avg) != null ? Math.round(num(a.avg)!) : null,
                maxHr: num(a.max) != null ? Math.round(num(a.max)!) : null,
                cadence: num(a.cad) != null ? Math.round(num(a.cad)!) : null,
                lapsJson: Array.isArray(a.laps) ? JSON.stringify(a.laps) : null,
                perfAt: typeof a.perfAt === 'string' ? a.perfAt : null,
                perfFailed: 0,
                deletedAt: null,
                updatedAt: now,
              })
              .onConflictDoNothing()
              .run();
            if (res.changes) bump('activities');
          }
          for (const [key, cr] of Object.entries<any>(day.coach ?? {})) {
            const text = str(cr?.text, 700);
            if (!text) continue;
            const res = tx.insert(coachReads).values({ userId, date, key, text, createdAt: typeof cr.at === 'string' ? cr.at : now }).onConflictDoNothing().run();
            if (res.changes) bump('coach');
          }
        }
      }

      // ---------- lifts ----------
      for (const m of Object.values<any>(b.lifts ?? {})) {
        for (const [id, s] of Object.entries<any>(m?.sets ?? {})) {
          if (!s || s.gone || !isDate(s.date) || !str(s.ex, 60) || num(s.w) == null || num(s.r) == null) continue;
          const res = tx.insert(liftSets).values({ id, userId, date: s.date, exercise: str(s.ex, 60)!, weight: num(s.w)!, reps: Math.round(num(s.r)!), createdAt: typeof s.at === 'string' ? s.at : now, deletedAt: null }).onConflictDoNothing().run();
          if (res.changes) bump('lifts');
        }
      }

      // ---------- journal entries ----------
      for (const m of Object.values<any>(b.journal ?? {})) {
        for (const [id, e] of Object.entries<any>(m?.entries ?? {})) {
          if (!e || !isDate(e.date) || !str(e.text, 5000)) continue;
          const res = tx
            .insert(journalEntries)
            .values({ id, userId, date: e.date, text: str(e.text, 5000)!, fav: !!e.fav, createdAt: typeof e.at === 'string' ? e.at : `${e.date}T21:00:00.000Z`, editedAt: typeof e.edited === 'string' ? e.edited : null, deletedAt: null })
            .onConflictDoNothing()
            .run();
          if (res.changes) bump('journal');
        }
      }

      // ---------- morning ----------
      if (b.morning?.settings && !readSetting(tx as unknown as DB, userId, 'morning')) {
        writeSetting(tx as unknown as DB, userId, 'morning', normalizeMorningSettings(b.morning.settings));
        bump('morningSettings');
      }
      for (const [date, d] of Object.entries<any>(b.morning?.days ?? {})) {
        if (!d || !isDate(date)) continue;
        const res = tx
          .insert(morningDays)
          .values({ userId, date, mode: d.mode === 'gym' ? 'gym' : 'run', type: str(d.type, 30) ?? 'Easy', miles: num(d.miles) ?? 5, minutes: Math.round(num(d.minutes) ?? 40), wake: Math.round(num(d.wake) ?? 440) })
          .onConflictDoNothing()
          .run();
        if (res.changes) bump('morningDays');
      }

      // ---------- todos ----------
      for (const [id, t] of Object.entries<any>(b.todos?.items ?? {})) {
        if (!t || !str(t.text, 200) || !isDate(t.created)) continue;
        const res = tx.insert(todos).values({ id, userId, text: str(t.text, 200)!, createdOn: t.created, doneOn: isDate(t.done) ? t.done : null, deletedOn: isDate(t.deleted) ? t.deleted : null, createdAt: typeof t.at === 'string' ? t.at : now }).onConflictDoNothing().run();
        if (res.changes) bump('todos');
      }

      // ---------- quotes: favorites, hidden, your own ----------
      const qm = b.quotes_mine ?? {};
      for (const [k, q] of Object.entries<any>(qm.added ?? {})) {
        if (!q || !str(q.text, 400)) continue;
        const res = tx.insert(userQuotes).values({ id: `q_${k}`, userId, text: str(q.text, 400)!, author: str(q.author, 80) ?? '', createdAt: typeof q.at === 'string' ? q.at : now, deletedAt: null }).onConflictDoNothing().run();
        if (res.changes) bump('quotes');
      }
      const prefIds = new Set([...Object.keys(qm.favs ?? {}), ...Object.keys(qm.hidden ?? {})]);
      for (const id0 of prefIds) {
        const id = id0.startsWith('u') && qm.added?.[id0.slice(1)] ? `q_${id0.slice(1)}` : id0;
        const res = tx.insert(quotePrefs).values({ userId, quoteId: id, fav: !!qm.favs?.[id0], hidden: !!qm.hidden?.[id0] }).onConflictDoNothing().run();
        if (res.changes) bump('quotePrefs');
      }

      // ---------- rotation history ----------
      const mapId = (kind: 'n' | 'q', id: string) => (kind === 'n' ? noteEntryIds.get(id) ?? (id.startsWith('note-') ? null : id) : id.startsWith('u') && qm.added?.[id.slice(1)] ? `q_${id.slice(1)}` : id);
      for (const [key, date] of Object.entries<any>(b.picks?.shown ?? {})) {
        const [k, ...rest] = key.split(':');
        const id = mapId(k as 'n' | 'q', rest.join(':'));
        if (!id || !isDate(date) || (k !== 'n' && k !== 'q')) continue;
        tx.insert(shownItems).values({ userId, kind: k === 'n' ? 'memory' : 'quote', itemId: id, lastShown: date }).onConflictDoNothing().run();
      }
      for (const [date, d] of Object.entries<any>(b.picks?.daily ?? {})) {
        if (!isDate(date) || !d) continue;
        for (const k of ['n', 'q'] as const) {
          const id = typeof d[k] === 'string' ? mapId(k, d[k]) : null;
          if (id) tx.insert(dailyPicks).values({ userId, date, kind: k === 'n' ? 'memory' : 'quote', itemId: id }).onConflictDoNothing().run();
        }
      }
    });

    void eq;
    return c.json({ ok: true, imported: counts });
  });

  return r;
};
