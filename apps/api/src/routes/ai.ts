import { shiftDays, today, zCoachRequest, zPlanApply, zPlanDraftRequest, zPlanMode, type Session, type Template } from '@logbook/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { coachReads, planBlocks, trainingSessions, users } from '../db/schema.js';
import { toSession } from '../lib/map.js';
import { rateLimit } from '../lib/ratelimit.js';
import { ApiError, nowISO, parseBody } from '../lib/util.js';
import { coachRead, draftPlan, type AthleteContext } from '../services/claude.js';
import { liveBlocks, removePlanned, writeTemplate } from '../services/plans.js';
import { stravaStatus } from '../services/strava.js';
import { activitiesBetween, sessionsBetween, zonesOf } from './core.js';

const MAX_FILE = 25 * 1024 * 1024;
/** Ten plan drafts a day per account (each is a long Claude call). */
export const DRAFT_LIMIT = { limit: 10, windowMs: 24 * 3600_000 };

export const aiRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;
  const ctxOf = (userId: string): AthleteContext => {
    const t = today();
    return { activities: activitiesBetween(db, userId, shiftDays(t, -60), t), zones: zonesOf(db, userId), stravaOk: stravaStatus(db, userId).connected, note: db.select({ n: users.profileNote }).from(users).where(eq(users.id, userId)).get()?.n ?? null };
  };

  /** multipart (file) or JSON; both carry the same fields */
  r.post('/plans/draft', rateLimit('plans-draft', DRAFT_LIMIT.limit, DRAFT_LIMIT.windowMs, 'Plan drafts are limited to 10 a day.'), async (c) => {
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
    const row = db.select({ d: trainingSessions.date }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt))).orderBy(trainingSessions.date).all().pop();
    return row?.d ?? null;
  };

  /**
   * Write a draft into the calendar with the template's semantics (`writeTemplate`): `replace` soft-deletes only the
   * planned, not-kept sessions in the window from today on (a session done by a tap, a Strava run or logged sets stays;
   * the past is never touched), and ends any block the new one overlaps. `only` first clears what is planned after the
   * draft's end and ends older blocks the day before. Answers `{ block, months, removed, replacedIds, endedBlocks }`,
   * which `POST /plans/template/undo` takes back.
   */
  r.post('/plans/apply', async (c) => {
    const userId = uidOf(c);
    const { draft, mode, source, only } = await parseBody(c.req.raw, zPlanApply);
    const today = c.get('today');
    const template: Template = { name: draft.name, summary: draft.summary || null, start: draft.start, end: draft.end, sessions: draft.sessions.map((s) => ({ ...s, type: s.type ?? null, title: s.title ?? null, details: s.details ?? null, miles: s.miles ?? null, minutes: s.minutes ?? null })), weeks: [] } as unknown as Template;
    const applied = db.transaction(() => {
      const at = nowISO();
      const extraReplaced: string[] = [];
      const extraEnded: Array<{ id: string; prevEnd: string } | { id: string; deleted: true }> = [];
      // a plan that stops at its end: nothing only planned after it, and no other block running over it
      if (only) {
        const last = db.select({ d: trainingSessions.date }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt))).orderBy(trainingSessions.date).all().pop()?.d;
        if (last && last > draft.end) extraReplaced.push(...removePlanned(db, userId, shiftDays(draft.end, 1), last, today, undefined, at));
        for (const b of liveBlocks(db, userId)) {
          if (b.end < draft.start) continue;
          if (b.start < draft.start) {
            db.update(planBlocks).set({ end: shiftDays(draft.start, -1) }).where(eq(planBlocks.id, b.id)).run();
            extraEnded.push({ id: b.id, prevEnd: b.end });
          } else {
            extraReplaced.push(...removePlanned(db, userId, b.start, b.end, today, b.id, at));
            db.update(planBlocks).set({ deletedAt: at }).where(eq(planBlocks.id, b.id)).run();
            extraEnded.push({ id: b.id, deleted: true });
          }
        }
      }
      const out = writeTemplate(db, userId, template, { replace: mode === 'replace', source: source ? zPlanMode.or(z.literal('chat')).parse(source) : 'chat', today });
      const replacedIds = [...new Set([...extraReplaced, ...out.replacedIds])];
      const endedBlocks = [...extraEnded, ...out.endedBlocks.filter((e) => !extraEnded.some((x) => x.id === e.id))];
      return { ...out, replacedIds, removed: replacedIds.length, endedBlocks, ...(endedBlocks[0] ? { endedBlock: endedBlocks[0] } : {}) };
    });
    return c.json(applied, 201);
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
