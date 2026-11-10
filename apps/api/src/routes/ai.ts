import { eachDay, monthsBetween, shiftDays, zPlanApply, zPlanDraftRequest, zPlanMode, type EndedBlockRef, type Session } from '@logbook/shared';
import { and, eq, gt, gte, isNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { planBlocks, trainingSessions } from '../db/schema.js';
import { toBlock, toSession } from '../lib/map.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { withAiLimit } from '../services/aiLimits.js';
import { RUN_NOTE_OFF, claudeClient, draftPlan, type AthleteContext } from '../services/claude.js';
import { sessionsBetween } from './core.js';
import { assistantMayReadTraining, requireAiPermission } from '../services/consent.js';

/** What Claude takes: a photo up to 5 MB, and a request up to 32 MB once a PDF is base64 (so 20 MB of PDF). */
export const PLAN_FILE_LIMITS = { imageBytes: 5 * 1024 * 1024, pdfBytes: 20 * 1024 * 1024 } as const;
export const REVISE_NEEDS_TRAINING = "Turn on 'Let the assistant read my training data' in Settings, Privacy to revise your plan.";

export const aiRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;
  /**
   * What a draft is told about the person. `zones` is always null: heart rate zones come from Strava, and nothing from
   * Strava goes to Claude (routes/claudeGuard.test.ts fails if it does).
   */
  const ctxOf = (userId: string, t: string): AthleteContext => {
    // with training data turned off (Settings, Privacy), a draft is written from what the person hands it, nothing else
    if (!assistantMayReadTraining(db, userId)) return { runs: [], zones: null };
    const runs = sessionsBetween(db, userId, shiftDays(t, -60), t)
      .filter((s) => s.kind === 'run' && (s.mark === 'done' || s.mark === 'floor') && s.miles)
      .map((s) => ({ date: s.date, miles: s.miles!, minutes: s.minutes }));
    return { runs, zones: null };
  };

  /** multipart (file) or JSON; both carry the same fields */
  r.post('/plans/draft', async (c) => {
    const userId = uidOf(c);
    // 503 `claude_not_configured` without a key; 403 `consent_required` until the person has answered the permission
    // step (every mode: typed text, a pasted plan and a file are theirs to send only after a yes or a no)
    claudeClient();
    const consent = requireAiPermission(db, userId, 'plan');
    const t = c.get('today');
    const ct = c.req.header('content-type') ?? '';
    let fields: Record<string, string> = {};
    let file: { data: Buffer; mediaType: string } | null = null;
    if (ct.includes('multipart/form-data')) {
      const form = await c.req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === 'string') fields[k] = v;
        else if (k === 'file') {
          const mediaType = v.type || 'application/pdf';
          const isPdf = mediaType === 'application/pdf';
          if (v.size > (isPdf ? PLAN_FILE_LIMITS.pdfBytes : PLAN_FILE_LIMITS.imageBytes)) throw new ApiError(422, isPdf ? 'That PDF is over 20 MB. Upload fewer pages.' : 'That photo is over 5 MB. Send a smaller one.', 'file_too_big');
          file = { data: Buffer.from(await v.arrayBuffer()), mediaType };
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
    if ((req.mode === 'describe' || req.mode === 'revise') && (req.instructions ?? '').trim().length < 5) throw new ApiError(422, 'Say what you want first.', 'no_instructions');
    // revise sends the planned sessions themselves, which the training switch covers: off means no revise
    if (req.mode === 'revise' && !consent.training) throw new ApiError(403, REVISE_NEEDS_TRAINING, 'training_off');

    let existing: Session[] | undefined;
    let end = req.end;
    if (req.mode === 'revise') {
      end = end ?? lastPlanned(userId) ?? shiftDays(req.start, 27);
      if (end < req.start) throw new ApiError(422, 'The end date is before the start date.', 'bad_range');
      existing = sessionsBetween(db, userId, req.start, end);
    }
    // 5 drafts in 10 minutes, a daily budget, one at a time (429 `rate_limited`)
    const draft = await withAiLimit(userId, 'plan', () =>
      draftPlan(userId, {
      mode: req.mode,
      text: req.text,
      instructions: req.instructions,
      start: req.start,
      end,
      existing: existing?.map(({ date, kind, type, title, details, miles, minutes }) => ({ date, kind, type, title, details, miles, minutes })),
      file,
      ctx: ctxOf(userId, t),
      today: t,
      }),
    );
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
   * Write a draft into the calendar. `replace` clears the date range first; `add` keeps what is there. Answers
   * `{ block, months, replacedIds, endedBlocks }` (201): the sessions it removed and the blocks it ended, exactly what
   * `POST /plans/template/undo` takes with `blockId` to put everything back.
   */
  r.post('/plans/apply', async (c) => {
    const userId = uidOf(c);
    const { draft, mode, source, only } = await parseBody(c.req.raw, zPlanApply);
    const blockId = uid('b');
    const now = nowISO();
    const replacedIds: string[] = [];
    const endedBlocks: EndedBlockRef[] = [];
    db.transaction((tx) => {
      /** Soft-delete the planned (never marked) sessions that match, and remember them for Undo. */
      const clear = (...where: Parameters<typeof and>) => {
        const scope = and(eq(trainingSessions.userId, userId), isNull(trainingSessions.mark), isNull(trainingSessions.deletedAt), ...where);
        const ids = tx.select({ id: trainingSessions.id }).from(trainingSessions).where(scope).all().map((r) => r.id);
        if (!ids.length) return;
        tx.update(trainingSessions).set({ deletedAt: now, updatedAt: now }).where(scope).run();
        replacedIds.push(...ids);
      };
      // a plan that stops at its end: nothing planned after it, and no other block running over it
      if (only) {
        clear(gt(trainingSessions.date, draft.end));
        for (const b of tx.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt), gte(planBlocks.end, draft.start))).all()) {
          if (b.start < draft.start) {
            tx.update(planBlocks).set({ end: shiftDays(draft.start, -1) }).where(eq(planBlocks.id, b.id)).run();
            endedBlocks.push({ id: b.id, prevEnd: b.end });
          } else {
            tx.update(planBlocks).set({ deletedAt: now }).where(eq(planBlocks.id, b.id)).run();
            endedBlocks.push({ id: b.id, deleted: true });
          }
        }
      }
      // replace clears what was only planned; anything already marked (done, floor, skipped, sick) is history and stays
      if (mode === 'replace') clear(gte(trainingSessions.date, draft.start), lte(trainingSessions.date, draft.end));
      const pos = new Map<string, number>();
      if (mode === 'add' || mode === 'replace') {
        for (const d of eachDay(draft.start, draft.end)) pos.set(d, 0);
        for (const s of tx.select({ date: trainingSessions.date, position: trainingSessions.position }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.date, draft.start), lte(trainingSessions.date, draft.end), isNull(trainingSessions.deletedAt))).all()) pos.set(s.date, Math.max(pos.get(s.date) ?? 0, s.position + 1));
      }
      for (const s of draft.sessions) {
        const p = pos.get(s.date) ?? 0;
        pos.set(s.date, p + 1);
        tx.insert(trainingSessions).values({ id: uid('p'), userId, date: s.date, position: p, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: s.miles, minutes: s.minutes, blockId, movedFrom: null, mark: null, createdAt: now, updatedAt: now }).run();
      }
      tx.insert(planBlocks).values({ id: blockId, userId, name: draft.name, start: draft.start, end: draft.end, source: source ? zPlanMode.or(z.literal('chat')).parse(source) : null, summary: draft.summary || null, createdAt: now }).run();
    });
    const block = db.select().from(planBlocks).where(eq(planBlocks.id, blockId)).get()!;
    return c.json({ block: toBlock(block, draft.sessions.length), months: monthsBetween(draft.start, draft.end), removed: replacedIds.length, replacedIds, endedBlocks }, 201);
  });

  /** Off: see RUN_NOTE_OFF. Saved notes from before still show; no new ones are written. */
  r.post('/coach/read', () => {
    throw new ApiError(422, RUN_NOTE_OFF, 'strava_terms');
  });

  void toSession;
  return r;
};
