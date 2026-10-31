import { buildTemplate, cleanBands, fmtDate, monthOf, periodOf, shiftDays, TemplateError, type AssistantOp, type AssistantProposal, type DayBands, type EndedBlockRef } from '@logbook/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from '../../db/index.js';
import { assistantActions, dayPlans, goalEvents, goals, habitChecks, habits, morningDays, reminders, todoGroups, todos, trainingSessions } from '../../db/schema.js';
import { localParts } from '../../lib/tz.js';
import { ApiError, nowISO, uid } from '../../lib/util.js';
import { undoTemplate, writeTemplate } from '../plans.js';
import { createReminder, reminderOf, restoreReminder, timezoneOf } from '../reminders.js';

type SessionRow = typeof trainingSessions.$inferSelect;
type TodoRow = typeof todos.$inferSelect;
type GoalRow = typeof goals.$inferSelect;
type CheckRow = typeof habitChecks.$inferSelect;
type DayPlanRow = typeof dayPlans.$inferSelect;
type MorningDayRow = typeof morningDays.$inferSelect;

export const dow = (d: string) => fmtDate('short', d);
export const sessionName = (s: Pick<SessionRow, 'title' | 'type' | 'kind' | 'miles'>) => s.title || [s.type, s.miles ? `${s.miles}` : null].filter(Boolean).join(' ') || s.kind;
const hm = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m) % 60;
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
};

// ---------- lookups that throw with a message Claude can act on ----------

export const sessionOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, id), isNull(trainingSessions.deletedAt))).get();
  if (!row) throw new Error(`No session with id ${id}.`);
  return row;
};
const todoOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.id, id), isNull(todos.deletedOn))).get();
  if (!row) throw new Error(`No to-do with id ${id}.`);
  return row;
};
const goalOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.deletedAt))).get();
  if (!row) throw new Error(`No goal with id ${id}.`);
  return row;
};
const listOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), eq(todoGroups.id, id), isNull(todoGroups.deletedAt))).get();
  if (!row) throw new Error(`No list with id ${id}.`);
  return row;
};
const habitOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.id, id), isNull(habits.archivedOn))).get();
  if (!row) throw new Error(`No habit with id ${id}.`);
  return row;
};
const reminderOrThrow = (db: DB, userId: string, id: string) => {
  try {
    return reminderOf(db, userId, id);
  } catch {
    throw new Error(`No reminder with id ${id}.`);
  }
};
const goalPeriodOk = (level: string, period: string) =>
  level === 'year' ? /^\d{4}$/.test(period) : level === 'month' ? /^\d{4}-\d{2}$/.test(period) : /^\d{4}-\d{2}-\d{2}$/.test(period) && periodOf(level as 'week', period) === period;
const P = ['no priority', 'P3', 'P2', 'P1'];
const GOAL_NAME: Record<string, string> = { base: 'base-building', '5k': '5K', '10k': '10K', half: 'half-marathon', marathon: 'marathon' };

const bandRefsOk = (db: DB, userId: string, bands: DayBands) => {
  const refs = [...bands.morning, ...bands.afternoon, ...bands.evening];
  for (const r of refs) {
    if (r.startsWith('todo:')) todoOf(db, userId, r.slice(5));
    else if (r.startsWith('step:')) goalOf(db, userId, r.split(':')[1]!);
  }
  return refs.length;
};

/** Checks an operation against the owner's rows and says it in words. Throws with a message Claude can act on. */
export const labelOp = (db: DB, userId: string, op: AssistantOp, today: string): string => {
  switch (op.op) {
    case 'move_session': {
      const s = sessionOf(db, userId, op.id);
      if (op.to < today) throw new Error(`Cannot move ${op.id} into the past (${op.to}).`);
      return `Move ${sessionName(s)} from ${dow(s.date)} to ${dow(op.to)}`;
    }
    case 'update_session': {
      const s = sessionOf(db, userId, op.id);
      const what = [op.title !== undefined ? `title “${op.title ?? ''}”` : null, op.type !== undefined ? `type ${op.type ?? 'none'}` : null, op.miles !== undefined ? `${op.miles ?? 0} mi` : null, op.minutes !== undefined ? `${op.minutes ?? 0} min` : null, op.details !== undefined ? 'details' : null].filter(Boolean).join(', ');
      return `Change ${sessionName(s)} on ${dow(s.date)}: ${what || 'no change'}`;
    }
    case 'add_session':
      return `Add ${sessionName({ title: op.title ?? null, type: op.type ?? null, kind: op.kind, miles: op.miles ?? null })} on ${dow(op.date)}`;
    case 'delete_session': {
      const s = sessionOf(db, userId, op.id);
      return `Remove ${sessionName(s)} from ${dow(s.date)}`;
    }
    case 'mark_session': {
      const s = sessionOf(db, userId, op.id);
      return op.mark ? `Mark ${sessionName(s)} on ${dow(s.date)} ${op.mark === 'skip' ? 'skipped' : op.mark}` : `Clear the mark on ${sessionName(s)} (${dow(s.date)})`;
    }
    case 'add_todo': {
      if (op.groupId) listOf(db, userId, op.groupId);
      return `Add to-do “${op.text}”${op.priority ? `, ${P[op.priority]}` : ''}${op.due ? `, for ${dow(op.due)}` : op.bucket === 'someday' ? ', someday' : ''}`;
    }
    case 'update_todo': {
      const t = todoOf(db, userId, op.id);
      if (op.groupId) listOf(db, userId, op.groupId);
      if (op.done) return `Check off “${t.text}”`;
      const what = [op.text ? `rename to “${op.text}”` : null, op.priority !== undefined ? P[op.priority] : null, op.due !== undefined ? (op.due ? `for ${dow(op.due)}` : 'no date') : null, op.bucket ? op.bucket : null, op.groupId !== undefined ? 'list' : null, op.done === false ? 'reopen' : null].filter(Boolean).join(', ');
      return `Change “${t.text}”: ${what || 'no change'}`;
    }
    case 'delete_todo': {
      const t = todoOf(db, userId, op.id);
      return `Delete to-do “${t.text}”`;
    }
    case 'set_goal':
      if (!goalPeriodOk(op.level, op.period)) throw new Error(`${op.period} is not a ${op.level}.`);
      return `Set the ${op.level} goal (${op.period}): “${op.text}”${op.steps?.length ? ` with ${op.steps.length} steps` : ''}`;
    case 'review_goal': {
      const g = goalOf(db, userId, op.id);
      return `Mark the ${g.level} goal “${g.text}” ${op.status}`;
    }
    case 'check_habit': {
      const h = habitOf(db, userId, op.habitId);
      if (op.date > today) throw new Error(`Cannot check a habit ahead of time (${op.date}).`);
      return `${op.done ? 'Check off' : 'Uncheck'} “${h.name}” for ${op.date === today ? 'today' : dow(op.date)}`;
    }
    case 'add_habit': {
      const dup = db.select({ id: habits.id }).from(habits).where(and(eq(habits.userId, userId), isNull(habits.archivedOn), sql`lower(${habits.name}) = ${op.name.toLowerCase()}`)).get();
      if (dup) throw new Error(`There is already a habit called “${op.name}”.`);
      return `Add habit “${op.name}”`;
    }
    case 'plan_day': {
      const b = cleanBands(op.bands);
      bandRefsOk(db, userId, b);
      return `Plan ${op.date === today ? 'today' : dow(op.date)}: ${b.morning.length} in the morning, ${b.afternoon.length} in the afternoon, ${b.evening.length} in the evening`;
    }
    case 'set_alarm':
      if (op.date < today) throw new Error(`Cannot set an alarm in the past (${op.date}).`);
      return `Set ${op.date === today ? 'today’s' : `${dow(op.date)}’s`} alarm to ${hm(op.wake)}`;
    case 'set_reminder': {
      const at = new Date(op.at);
      if (!Number.isFinite(at.getTime())) throw new Error(`${op.at} is not a time.`);
      if (at.getTime() < Date.now() - 60_000) throw new Error(`${op.at} has passed.`);
      const p = localParts(at, timezoneOf(db, userId));
      return `Remind you “${op.title}” ${dow(p.date)} at ${p.time}`;
    }
    case 'cancel_reminder': {
      const r = reminderOrThrow(db, userId, op.id);
      if (r.status !== 'pending') throw new Error(`Reminder ${op.id} is already ${r.status}.`);
      return `Cancel the reminder “${r.title}”`;
    }
    case 'apply_plan_template': {
      if (op.startDate < today) throw new Error(`A plan cannot start in the past (${op.startDate}).`);
      let t;
      try {
        t = buildTemplate({ goal: op.goal, startDate: op.startDate, runDays: op.runDays, longRunDay: op.longRunDay, weeklyMiles: op.weeklyMiles, weeks: op.weeks, raceDate: op.raceDate ?? null });
      } catch (e) {
        if (e instanceof TemplateError) throw new Error(e.message);
        throw e;
      }
      return `Write ${t.name} from ${dow(t.start)} to ${dow(t.end)} (${op.runDays.length} run days, long run ${op.longRunDay}, ${op.weeklyMiles} mi/week, ${t.sessions.length} sessions)${op.replace ? ', replacing what was only planned' : ''}`;
    }
  }
};
void GOAL_NAME;

// ---------- applying and undoing ----------

interface UndoRecord {
  sessions: SessionRow[];
  todos: TodoRow[];
  goals: GoalRow[];
  checks?: Array<{ habitId: string; date: string; prior: CheckRow | null }>;
  dayPlans?: Array<{ date: string; prior: DayPlanRow | null }>;
  alarms?: Array<{ date: string; prior: MorningDayRow | null }>;
  reminders?: Array<{ id: string; prior: 'pending' | 'cancelled' }>;
  templates?: Array<{ blockId: string; replacedIds: string[]; endedBlocks: EndedBlockRef[] }>;
  created: { sessions: string[]; todos: string[]; goals: string[]; habits?: string[] };
}

export const proposalOf = (row: typeof assistantActions.$inferSelect): AssistantProposal => {
  const ops = JSON.parse(row.ops) as AssistantOp[];
  const labels = JSON.parse(row.labels) as string[];
  return { id: row.id, summary: row.summary, changes: ops.map((op, i) => ({ op, label: labels[i] ?? op.op })), status: row.status as AssistantProposal['status'] };
};

export const actionOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(assistantActions).where(and(eq(assistantActions.userId, userId), eq(assistantActions.id, id))).get();
  if (!row) throw new ApiError(404, 'Proposal not found');
  return row;
};

/** Runs a proposal in one transaction, keeping the rows it touched as they were. Answers the months that changed. */
export const applyAction = (db: DB, userId: string, id: string, today: string) => {
  const row = actionOf(db, userId, id);
  if (row.status !== 'proposed') throw new ApiError(409, row.status === 'applied' ? 'Already applied.' : 'This proposal is closed.');
  const ops = JSON.parse(row.ops) as AssistantOp[];
  const undo: UndoRecord = { sessions: [], todos: [], goals: [], checks: [], dayPlans: [], alarms: [], reminders: [], templates: [], created: { sessions: [], todos: [], goals: [], habits: [] } };
  const months = new Set<string>();
  const now = nowISO();
  const keepSession = (s: SessionRow) => undo.sessions.some((x) => x.id === s.id) || undo.sessions.push({ ...s });
  const keepTodo = (t: TodoRow) => undo.todos.some((x) => x.id === t.id) || undo.todos.push({ ...t });
  const keepGoal = (g: GoalRow) => undo.goals.some((x) => x.id === g.id) || undo.goals.push({ ...g });
  const nextPos = (date: string) => (db.select({ m: sql<number>`coalesce(max(${trainingSessions.position}), -1)` }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date))).get()?.m ?? -1) + 1;
  const logGoal = (g: { id: string; level: string; period: string }, kind: string, text: string | null) => db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: g.id, level: g.level, period: g.period, kind, text, at: now }).run();

  try {
    db.transaction(() => {
      for (const op of ops) {
        labelOp(db, userId, op, today); // the rows may have changed since it was proposed
        switch (op.op) {
          case 'move_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date)).add(monthOf(op.to));
            const movedFrom = s.movedFrom === op.to ? null : (s.movedFrom ?? s.date);
            db.update(trainingSessions).set({ date: op.to, movedFrom, position: nextPos(op.to), updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'update_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            const set: Partial<SessionRow> = { updatedAt: now };
            if (op.type !== undefined) set.type = op.type;
            if (op.title !== undefined) set.title = op.title || null;
            if (op.details !== undefined) set.details = op.details || null;
            if (op.miles !== undefined) set.miles = op.miles && op.miles > 0 ? Math.round(op.miles * 10) / 10 : null;
            if (op.minutes !== undefined) set.minutes = op.minutes && op.minutes > 0 ? op.minutes : null;
            db.update(trainingSessions).set(set).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'add_session': {
            const sid = uid('p');
            months.add(monthOf(op.date));
            db.insert(trainingSessions)
              .values({ id: sid, userId, date: op.date, position: nextPos(op.date), kind: op.kind, type: op.type ?? null, title: op.title || null, details: op.details || null, miles: op.kind === 'run' && op.miles ? Math.round(op.miles * 10) / 10 : null, minutes: op.minutes || null, blockId: null, movedFrom: null, mark: null, deletedAt: null, createdAt: now, updatedAt: now })
              .run();
            undo.created.sessions.push(sid);
            break;
          }
          case 'delete_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            db.update(trainingSessions).set({ deletedAt: now, updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'mark_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            db.update(trainingSessions).set({ mark: op.mark, updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'add_todo': {
            const tid = uid('t');
            const pos = (db.select({ m: sql<number>`coalesce(max(${todos.position}), -1)` }).from(todos).where(eq(todos.userId, userId)).get()?.m ?? -1) + 1;
            const bucket = op.bucket ?? (op.due && op.due > today ? 'later' : 'today');
            db.insert(todos)
              .values({ id: tid, userId, text: op.text, note: null, priority: op.priority ?? 0, color: null, groupId: op.groupId ?? null, due: bucket === 'later' ? (op.due ?? shiftDays(today, 1)) : null, bucket, position: pos, createdOn: today, doneOn: null, deletedOn: null, createdAt: now })
              .run();
            undo.created.todos.push(tid);
            break;
          }
          case 'update_todo': {
            const t = todoOf(db, userId, op.id);
            keepTodo(t);
            const set: Partial<TodoRow> = {};
            if (op.text) set.text = op.text;
            if (op.priority !== undefined) set.priority = op.priority;
            if (op.groupId !== undefined) set.groupId = op.groupId;
            if (op.done !== undefined) set.doneOn = op.done ? today : null;
            const bucket = op.bucket ?? (op.due ? (op.due > today ? 'later' : 'today') : t.bucket);
            if (op.bucket !== undefined || op.due !== undefined) {
              set.bucket = bucket;
              set.due = bucket === 'later' ? (op.due ?? t.due ?? shiftDays(today, 1)) : null;
            }
            db.update(todos).set(set).where(eq(todos.id, t.id)).run();
            break;
          }
          case 'delete_todo': {
            const t = todoOf(db, userId, op.id);
            keepTodo(t);
            db.update(todos).set({ deletedOn: today }).where(eq(todos.id, t.id)).run();
            break;
          }
          case 'set_goal': {
            const steps = JSON.stringify((op.steps ?? []).map((text, i) => ({ id: `s${Date.now().toString(36)}${i}`, text, done: false })));
            const had = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.level, op.level), eq(goals.period, op.period))).get();
            if (had) {
              keepGoal(had);
              db.update(goals)
                .set({ text: op.text, original: null, why: null, updatedAt: now, deletedAt: null, ...(op.steps ? { steps } : {}), ...(had.deletedAt ? { status: 'open', closedAt: null, reflection: null } : {}) })
                .where(eq(goals.id, had.id))
                .run();
              logGoal(had, had.deletedAt ? 'set' : 'edited', op.text);
            } else {
              const gid = uid('goal');
              db.insert(goals).values({ id: gid, userId, level: op.level, period: op.period, text: op.text, original: null, why: null, status: 'open', reflection: null, steps, createdAt: now, updatedAt: now, closedAt: null, deletedAt: null }).run();
              undo.created.goals.push(gid);
              logGoal({ id: gid, level: op.level, period: op.period }, 'set', op.text);
            }
            break;
          }
          case 'review_goal': {
            const g = goalOf(db, userId, op.id);
            keepGoal(g);
            db.update(goals).set({ status: op.status, closedAt: op.status === 'open' ? null : now, updatedAt: now }).where(eq(goals.id, g.id)).run();
            logGoal(g, op.status === 'open' ? 'reopened' : op.status, g.reflection);
            break;
          }
          case 'check_habit': {
            const prior = db.select().from(habitChecks).where(and(eq(habitChecks.habitId, op.habitId), eq(habitChecks.date, op.date))).get() ?? null;
            undo.checks!.push({ habitId: op.habitId, date: op.date, prior });
            months.add(monthOf(op.date));
            db.insert(habitChecks)
              .values({ userId, habitId: op.habitId, date: op.date, done: op.done, note: prior?.note ?? null, updatedAt: now })
              .onConflictDoUpdate({ target: [habitChecks.habitId, habitChecks.date], set: { done: op.done, updatedAt: now } })
              .run();
            break;
          }
          case 'add_habit': {
            const hid = uid('h');
            const pos = (db.select({ m: sql<number>`coalesce(max(${habits.position}), -1)` }).from(habits).where(eq(habits.userId, userId)).get()?.m ?? -1) + 1;
            db.insert(habits).values({ id: hid, userId, name: op.name, position: pos, createdOn: today, archivedOn: null }).run();
            undo.created.habits!.push(hid);
            break;
          }
          case 'plan_day': {
            const prior = db.select().from(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, op.date))).get() ?? null;
            undo.dayPlans!.push({ date: op.date, prior });
            const json = JSON.stringify(cleanBands(op.bands));
            if (prior) db.update(dayPlans).set({ bands: json, updatedAt: now }).where(eq(dayPlans.id, prior.id)).run();
            else db.insert(dayPlans).values({ id: uid('dp'), userId, date: op.date, bands: json, updatedAt: now }).run();
            break;
          }
          case 'set_alarm': {
            const prior = db.select().from(morningDays).where(and(eq(morningDays.userId, userId), eq(morningDays.date, op.date))).get() ?? null;
            undo.alarms!.push({ date: op.date, prior });
            months.add(monthOf(op.date));
            db.insert(morningDays)
              .values({ userId, date: op.date, wake: op.wake, mode: prior?.mode ?? 'run', type: prior?.type ?? '', miles: prior?.miles ?? 0, minutes: prior?.minutes ?? 0 })
              .onConflictDoUpdate({ target: [morningDays.userId, morningDays.date], set: { wake: op.wake } })
              .run();
            break;
          }
          case 'set_reminder': {
            const r = createReminder(db, userId, { title: op.title, body: op.body ?? null, route: op.route ?? null, at: op.at }, { source: 'agent', assistantActionId: id });
            undo.reminders!.push({ id: r.id, prior: 'cancelled' });
            break;
          }
          case 'cancel_reminder': {
            undo.reminders!.push({ id: op.id, prior: 'pending' });
            db.update(reminders).set({ status: 'cancelled' }).where(and(eq(reminders.userId, userId), eq(reminders.id, op.id))).run();
            break;
          }
          case 'apply_plan_template': {
            const t = buildTemplate({ goal: op.goal, startDate: op.startDate, runDays: op.runDays, longRunDay: op.longRunDay, weeklyMiles: op.weeklyMiles, weeks: op.weeks, raceDate: op.raceDate ?? null });
            const applied = writeTemplate(db, userId, t, { replace: op.replace, source: 'assistant', today });
            undo.templates!.push({ blockId: applied.block.id, replacedIds: applied.replacedIds, endedBlocks: applied.endedBlocks });
            for (const m of applied.months) months.add(m);
            break;
          }
        }
      }
      db.update(assistantActions).set({ status: 'applied', undo: JSON.stringify(undo), appliedAt: now }).where(eq(assistantActions.id, id)).run();
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(409, `${e instanceof Error ? e.message : 'A change no longer applies.'} Ask again for a fresh proposal.`, 'stale_proposal');
  }
  return { proposal: proposalOf(actionOf(db, userId, id)), months: [...months].sort() };
};

/** Puts back every row an applied proposal touched, and removes what it added. */
export const undoAction = (db: DB, userId: string, id: string, today: string) => {
  const row = actionOf(db, userId, id);
  if (row.status !== 'applied' || !row.undo) throw new ApiError(409, 'Only an applied proposal can be undone.');
  const u = JSON.parse(row.undo) as UndoRecord;
  const now = nowISO();
  const months = new Set<string>();
  db.transaction(() => {
    for (const s of u.sessions) {
      const cur = db.select({ date: trainingSessions.date }).from(trainingSessions).where(eq(trainingSessions.id, s.id)).get();
      if (cur) months.add(monthOf(cur.date));
      months.add(monthOf(s.date));
      const { id: sid, userId: _u, ...rest } = s;
      db.update(trainingSessions).set({ ...rest, updatedAt: now }).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, sid))).run();
    }
    if (u.created.sessions.length) {
      for (const r of db.select({ date: trainingSessions.date }).from(trainingSessions).where(inArray(trainingSessions.id, u.created.sessions)).all()) months.add(monthOf(r.date));
      db.update(trainingSessions).set({ deletedAt: now, updatedAt: now }).where(and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, u.created.sessions))).run();
    }
    for (const t of u.todos) {
      const { id: tid, userId: _u, ...rest } = t;
      db.update(todos).set(rest).where(and(eq(todos.userId, userId), eq(todos.id, tid))).run();
    }
    if (u.created.todos.length) db.update(todos).set({ deletedOn: today }).where(and(eq(todos.userId, userId), inArray(todos.id, u.created.todos))).run();
    for (const g of u.goals) {
      const { id: gid, userId: _u, ...rest } = g;
      db.update(goals).set({ ...rest, updatedAt: now }).where(and(eq(goals.userId, userId), eq(goals.id, gid))).run();
      db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: gid, level: g.level, period: g.period, kind: 'edited', text: g.text, at: now }).run();
    }
    if (u.created.goals.length) {
      for (const g of db.select().from(goals).where(inArray(goals.id, u.created.goals)).all()) db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: g.id, level: g.level, period: g.period, kind: 'cleared', text: g.text, at: now }).run();
      db.update(goals).set({ deletedAt: now }).where(and(eq(goals.userId, userId), inArray(goals.id, u.created.goals))).run();
    }
    for (const c of u.checks ?? []) {
      months.add(monthOf(c.date));
      if (c.prior) db.update(habitChecks).set({ done: c.prior.done, note: c.prior.note, updatedAt: now }).where(and(eq(habitChecks.habitId, c.habitId), eq(habitChecks.date, c.date))).run();
      else db.delete(habitChecks).where(and(eq(habitChecks.userId, userId), eq(habitChecks.habitId, c.habitId), eq(habitChecks.date, c.date))).run();
    }
    if (u.created.habits?.length) {
      db.delete(habitChecks).where(and(eq(habitChecks.userId, userId), inArray(habitChecks.habitId, u.created.habits))).run();
      db.delete(habits).where(and(eq(habits.userId, userId), inArray(habits.id, u.created.habits))).run();
    }
    for (const d of u.dayPlans ?? []) {
      if (d.prior) db.update(dayPlans).set({ bands: d.prior.bands, updatedAt: now }).where(eq(dayPlans.id, d.prior.id)).run();
      else db.delete(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, d.date))).run();
    }
    for (const a of u.alarms ?? []) {
      months.add(monthOf(a.date));
      if (a.prior) db.update(morningDays).set({ wake: a.prior.wake }).where(and(eq(morningDays.userId, userId), eq(morningDays.date, a.date))).run();
      else db.delete(morningDays).where(and(eq(morningDays.userId, userId), eq(morningDays.date, a.date))).run();
    }
    for (const r of u.reminders ?? []) restoreReminder(db, userId, r.id, r.prior);
    for (const t of u.templates ?? []) {
      const out = undoTemplate(db, userId, { blockId: t.blockId, replacedIds: t.replacedIds, endedBlocks: t.endedBlocks });
      for (const m of out.months) months.add(m);
    }
    db.update(assistantActions).set({ status: 'undone' }).where(eq(assistantActions.id, id)).run();
  });
  return { proposal: proposalOf(actionOf(db, userId, id)), months: [...months].sort() };
};

export const dismissAction = (db: DB, userId: string, id: string) => {
  const row = actionOf(db, userId, id);
  if (row.status === 'proposed') db.update(assistantActions).set({ status: 'dismissed' }).where(eq(assistantActions.id, id)).run();
  return proposalOf(actionOf(db, userId, id));
};

export const recentActions = (db: DB, userId: string, limit = 50) =>
  db.select().from(assistantActions).where(eq(assistantActions.userId, userId)).orderBy(desc(assistantActions.createdAt)).limit(limit).all().map((r) => ({ ...proposalOf(r), ask: r.ask, createdAt: r.createdAt, appliedAt: r.appliedAt }));
