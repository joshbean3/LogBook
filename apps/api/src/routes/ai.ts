import { eachDay, monthsBetween, shiftDays, today, zCoachRequest, zPlanApply, zPlanDraftRequest, zPlanMode, type Session } from '@logbook/shared';
import { and, eq, gte, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { coachReads, planBlocks, trainingSessions } from '../db/schema.js';
import { toBlock, toSession } from '../lib/map.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { coachRead, draftPlan, type AthleteContext } from '../services/claude.js';
import { stravaStatus } from '../services/strava.js';
import { activitiesBetween, sessionsBetween, zonesOf } from './core.js';

const MAX_FILE = 25 * 1024 * 1024;

export const aiRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;
  const ctxOf = (userId: string): AthleteContext => {
    const t = today();
    return { activities: activitiesBetween(db, userId, shiftDays(t, -60), t), zones: zonesOf(db, userId), stravaOk: stravaStatus(db, userId).connected };
  };

  /** multipart (file) or JSON; both carry the same fields */
  r.post('/plans/draft', async (c) => {
    const userId = uidOf(c);
    const ct = c.req.header('content-type') ?? '';
    let fields: Record<string, string> = {};
    let file: { data: Buffer; mediaType: string } | null = null;
    if (ct.includes('multipart/form-data')) {
      const form = await c.req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === 'string') fields[k] = v;
        else if (k === 'file') {
          if (v.size > MAX_FILE) throw new ApiError(422, 'That file is over 25 MB.', 'file_too_big');
          file = { data: Buffer.from(await v.arrayBuffer()), mediaType: v.type || 'application/pdf' };
        }
      }
    } else {
      fields = (await c.req.json().catch(() => ({}))) as Record<string, string>;
    }
    const body = zPlanDraftRequest.safeParse(fields);
    if (!body.success) throw new ApiError(422, body.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 'validation');
    const req = body.data;
    if (req.mode === 'file' && !file) throw new ApiError(422, 'Choose a PDF or a photo of your plan first.', 'no_file');
    if (req.mode === 'text' && (req.text ?? '').trim().length < 20) throw new ApiError(422, 'Paste the plan text first.', 'no_text');
    if ((req.mode === 'describe' || req.mode === 'revise') && (req.instructions ?? '').trim().length < 5) throw new ApiError(422, 'Tell Claude what you want first.', 'no_instructions');

    let existing: Session[] | undefined;
    let end = req.end;
    if (req.mode === 'revise') {
      end = end ?? lastPlanned(userId) ?? shiftDays(req.start, 27);
      if (end < req.start) throw new ApiError(422, 'The end date is before the start date.', 'bad_range');
      existing = sessionsBetween(db, userId, req.start, end);
    }
    const draft = await draftPlan({
      mode: req.mode,
      text: req.text,
      instructions: req.instructions,
      start: req.start,
      end,
      existing: existing?.map(({ date, kind, type, title, details, miles, minutes }) => ({ date, kind, type, title, details, miles, minutes })),
      file,
      ctx: ctxOf(userId),
    });
    if (req.mode === 'revise') {
      draft.start = req.start < draft.start ? req.start : draft.start;
      draft.end = end && end > draft.end ? end : draft.end;
    }
    return c.json(draft);
  });

  const lastPlanned = (userId: string) => {
    const row = db.select({ d: trainingSessions.date }).from(trainingSessions).where(eq(trainingSessions.userId, userId)).orderBy(trainingSessions.date).all().pop();
    return row?.d ?? null;
  };

  /** Write a draft into the calendar. `replace` clears the date range first; `add` keeps what is there. */
  r.post('/plans/apply', async (c) => {
    const userId = uidOf(c);
    const { draft, mode, source } = await parseBody(c.req.raw, zPlanApply);
    const blockId = uid('b');
    const now = nowISO();
    db.transaction((tx) => {
      if (mode === 'replace') tx.delete(trainingSessions).where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.date, draft.start), lte(trainingSessions.date, draft.end))).run();
      const pos = new Map<string, number>();
      if (mode === 'add') {
        for (const d of eachDay(draft.start, draft.end)) pos.set(d, 0);
        for (const s of tx.select({ date: trainingSessions.date, position: trainingSessions.position }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.date, draft.start), lte(trainingSessions.date, draft.end))).all()) pos.set(s.date, Math.max(pos.get(s.date) ?? 0, s.position + 1));
      }
      for (const s of draft.sessions) {
        const p = pos.get(s.date) ?? 0;
        pos.set(s.date, p + 1);
        tx.insert(trainingSessions).values({ id: uid('p'), userId, date: s.date, position: p, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: s.miles, minutes: s.minutes, blockId, movedFrom: null, mark: null, createdAt: now, updatedAt: now }).run();
      }
      tx.insert(planBlocks).values({ id: blockId, userId, name: draft.name, start: draft.start, end: draft.end, source: source ? zPlanMode.or(z.literal('chat')).parse(source) : null, summary: draft.summary || null, createdAt: now }).run();
    });
    const block = db.select().from(planBlocks).where(eq(planBlocks.id, blockId)).get()!;
    return c.json({ block: toBlock(block, draft.sessions.length), months: monthsBetween(draft.start, draft.end) }, 201);
  });

  r.post('/coach/read', async (c) => {
    const userId = uidOf(c);
    const { date, sessionId } = await parseBody(c.req.raw, zCoachRequest);
    const sessions = sessionsBetween(db, userId, date, date);
    const sess = sessionId ? sessions.find((s) => s.id === sessionId) ?? null : null;
    const runs = activitiesBetween(db, userId, date, date).filter((a) => a.kind === 'run');
    if (!runs.length) throw new ApiError(422, 'No run recorded on that day yet.', 'no_runs');
    const text = await coachRead(date, sess, runs, ctxOf(userId));
    const key = sess ? sess.id : 'run';
    db.insert(coachReads).values({ userId, date, key, text, createdAt: nowISO() }).onConflictDoUpdate({ target: [coachReads.userId, coachReads.date, coachReads.key], set: { text, createdAt: nowISO() } }).run();
    return c.json({ date, key, text, createdAt: nowISO() });
  });

  void toSession;
  return r;
};
