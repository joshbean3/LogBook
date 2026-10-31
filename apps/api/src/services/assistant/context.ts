import { buildMorning, clock, DEFAULT_DAY_SETTINGS, fmtDate, METERS_PER_MILE, mondayOf, morningDayFor, periodOf, sessionRef, shiftDays, stepRef, todoRef, weekTotals, zDaySettings, type AskContextInput, type DaySettings, type GoalStep, type MorningTimeline } from '@logbook/shared';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { DB } from '../../db/index.js';
import { aiVisible } from '../ai-sources.js';
import { activities, dayPlans, goals, habitChecks, habits, morningDays, planBlocks, reminders, todoGroups, todos, trainingSessions, userMemory, users } from '../../db/schema.js';
import { morningSettingsOf, readSetting } from '../../routes/core.js';
import { planOf } from '../../routes/dayplans.js';
import { snapshotFor } from '../plans.js';
import { readTrainingProfile } from '../training.js';
import { dayRefOf, dow, sessionName, todoOnDay } from './ops.js';

// ---------- what Claude is shown ----------

const sessionsBetween = (db: DB, userId: string, from: string, to: string) =>
  db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt), gte(trainingSessions.date, from), lte(trainingSessions.date, to)))
    .orderBy(asc(trainingSessions.date), asc(trainingSessions.position))
    .all();

/** Activities a model may read: never Strava's (services/ai-sources.ts). */
const activitiesBetween = (db: DB, userId: string, from: string, to: string) =>
  aiVisible(
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), isNull(activities.duplicateOf), gte(activities.date, from), lte(activities.date, to)))
      .orderBy(asc(activities.date), asc(activities.time))
      .all(),
  );

const mi = (m: number) => Math.round((m / METERS_PER_MILE) * 10) / 10;

/** One line per session, with what was logged that day, so Claude can tell done from missed. */
export const sessionLines = (db: DB, userId: string, from: string, to: string, today: string): string => {
  const rows = sessionsBetween(db, userId, from, to);
  const acts = activitiesBetween(db, userId, from, to);
  const logged = (d: string) => acts.filter((a) => a.date === d).map((a) => `${a.kind}${a.distanceM ? ` ${mi(a.distanceM)} mi` : ''}`);
  if (!rows.length) return '(nothing planned)';
  return rows
    .map((s) => {
      const l = logged(s.date);
      const state = s.mark ? `marked ${s.mark}` : s.date < today ? (l.length ? 'not marked' : 'not marked, nothing logged') : s.date === today ? 'today' : 'ahead';
      return `- ${s.id} | ${s.date} ${dow(s.date)} | ${s.kind}: ${sessionName(s)}${s.miles ? ` (${s.miles} mi)` : ''}${s.minutes ? ` (${s.minutes} min)` : ''} | ${state}${l.length ? ` | logged: ${l.join(', ')}` : ''}${s.movedFrom ? ` | moved from ${s.movedFrom}` : ''}`;
    })
    .join('\n');
};

/** One week against its plan: planned and run miles, sessions kept, and each day in a word. */
export const weekSummary = (db: DB, userId: string, mon: string, today: string): string => {
  const monday = mondayOf(mon);
  const sun = shiftDays(monday, 6);
  const snap = snapshotFor(db, userId, monday, sun, today, { forAi: true });
  const t = weekTotals(snap, monday);
  return [`WEEK of ${monday} (${fmtDate('md', monday)} to ${fmtDate('md', sun)}): planned ${Math.round(t.planned * 10) / 10} mi, ran ${t.ran} mi, ${t.hit} of ${t.sessions} sessions kept.`, sessionLines(db, userId, monday, sun, today)].join('\n');
};

/** Last 14 days (or a range) of activities with distance, pace and heart rate. */
export const activityLines = (db: DB, userId: string, from: string, to: string): string => {
  const acts = activitiesBetween(db, userId, from, to);
  if (!acts.length) return '(no activities recorded)';
  return acts.map((a) => `- ${a.date} ${a.time ?? ''} | ${a.kind}: ${a.name} | ${a.distanceM ? `${mi(a.distanceM)} mi` : ''}${a.distanceM && a.movingSec ? ` at ${clock(a.movingSec / (a.distanceM / METERS_PER_MILE))}/mi` : a.movingSec ? ` ${Math.round(a.movingSec / 60)} min` : ''}${a.avgHr ? ` | avg HR ${a.avgHr}${a.maxHr ? ` (max ${a.maxHr})` : ''}` : ''} | ${a.provider}`).join('\n');
};

export const habitLines = (db: DB, userId: string, date: string): string => {
  const hs = db.select().from(habits).where(and(eq(habits.userId, userId), isNull(habits.archivedOn))).orderBy(asc(habits.position)).all();
  if (!hs.length) return '(no habits)';
  const checks = db.select().from(habitChecks).where(and(eq(habitChecks.userId, userId), eq(habitChecks.date, date))).all();
  return hs.map((h) => `- ${h.id} | ${h.name} | ${checks.find((c) => c.habitId === h.id)?.done ? 'checked' : 'not checked'} on ${date}`).join('\n');
};

export const goalLines = (db: DB, userId: string, today: string): string => {
  const gs = db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt), gte(goals.period, shiftDays(today, -14).slice(0, 4))))
    .orderBy(desc(goals.period))
    .limit(40)
    .all()
    .filter((g) => g.status === 'open' || g.period >= periodOf(g.level as 'day', shiftDays(today, -7)));
  if (!gs.length) return '(none)';
  return gs.map((g) => `- ${g.id} | ${g.level} | ${g.period} | ${g.status} | ${g.text}${g.steps && g.steps !== '[]' ? ` | steps: ${g.steps}` : ''}`).join('\n');
};

const todoLines = (db: DB, userId: string) => {
  const open = db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), isNull(todos.deletedOn), isNull(todos.doneOn)))
    .orderBy(desc(todos.priority), asc(todos.position))
    .limit(60)
    .all();
  const lists = db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), isNull(todoGroups.deletedAt))).all();
  const listName = new Map(lists.map((g) => [g.id, g.name]));
  const prio = ['', 'P3', 'P2', 'P1'];
  return {
    todos: open.length ? open.map((t) => `- ${t.id} | ${prio[t.priority] || 'none'} | ${t.bucket}${t.due ? ` ${t.due}` : ''} | ${t.groupId ? (listName.get(t.groupId) ?? '-') : '-'} | ${t.text}`).join('\n') : '(none)',
    lists: lists.length ? lists.map((g) => `${g.id} ${g.name}`).join('; ') : 'none',
    byId: new Map(open.map((t) => [t.id, t.text])),
  };
};

const hm = (m: number) => `${Math.floor(m / 60) % 24}:${String(Math.round(m) % 60).padStart(2, '0')}`;

/** The day's settings as stored, else the defaults (the same rule as `GET /me/day`). */
const daySettingsOf = (db: DB, userId: string): DaySettings => {
  const ok = zDaySettings.safeParse(readSetting(db, userId, 'day'));
  return ok.success ? ok.data : DEFAULT_DAY_SETTINGS;
};

const PRIO = ['no priority', 'P3', 'P2', 'P1'];

/**
 * The day as a timeline (docs/today-v6.md §4): the window and the work hours, the morning (from the morning timeline), the
 * workout, what is placed (every slot) and what waits in the tray (the day's to-dos and the day goal's steps with no time).
 */
export const dayBlock = (db: DB, userId: string, date: string, today: string, tl: MorningTimeline, daySessions: Array<{ id: string; kind: string; title: string | null; type: string | null; miles: number | null; mark: string | null }>): string => {
  const ds = daySettingsOf(db, userId);
  const plan = planOf(date, db.select().from(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date))).get());
  const placed = new Set<string>(plan.slots.map((s) => s.ref));
  const bandOf = new Map<string, string>();
  for (const b of ['morning', 'afternoon', 'evening'] as const) for (const r of plan.bands[b]) bandOf.set(r, b);
  const workout = tl.blocks.find((b) => b.key === 'run' || b.key === 'gym');
  const session = daySessions.find((x) => x.kind !== 'rest');
  const morning = `wake ${hm(tl.day.wake)}${workout ? ` door ${hm(workout.start)}` : ''} back ${hm(tl.back)} leave ${hm(tl.leave)}`;
  const workoutText = session ? `workout ${sessionRef(session.id)} ${sessionName(session)}${workout ? ` ${hm(workout.start)}–${hm(workout.end)}` : ''}${placed.has(sessionRef(session.id)) ? '' : ' (on the timeline at its time; never place anything over it)'}` : 'no workout';
  const head = `THE DAY ${date}${date === today ? ' (today)' : ''}: window ${hm(ds.window.start)}–${hm(ds.window.end)}, work ${hm(ds.workHours.start)}–${hm(ds.workHours.end)}, morning ${morning} (from the morning timeline), ${workoutText}.`;
  const slotLines = plan.slots.map((s) => {
    try {
      const info = dayRefOf(db, userId, s.ref, date, today);
      return `- ${s.ref} “${info.title}” ${hm(s.start)}–${hm(s.start + s.minutes)} ${s.minutes} min${info.done ? ' (done)' : ''}`;
    } catch {
      return `- ${s.ref} (gone) ${hm(s.start)} ${s.minutes} min`;
    }
  });
  const tray: string[] = [];
  const goal = db.select().from(goals).where(and(eq(goals.userId, userId), isNull(goals.deletedAt), eq(goals.level, 'day'), eq(goals.period, date))).get();
  if (goal) {
    let steps: GoalStep[] = [];
    try {
      steps = JSON.parse(goal.steps) as GoalStep[];
    } catch {
      steps = [];
    }
    for (const st of steps) {
      const ref = stepRef(goal.id, st.id);
      if (!placed.has(ref) && !st.done) tray.push(`- ${ref} “${st.text}” (goal “${goal.text}”)${bandOf.has(ref) ? ` (in the ${bandOf.get(ref)} band)` : ''}`);
    }
  }
  const dayTodos = db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), isNull(todos.deletedOn)))
    .orderBy(desc(todos.priority), asc(todos.position))
    .all()
    .filter((t) => todoOnDay(t, date, today) && !t.doneOn);
  for (const t of dayTodos) {
    const ref = todoRef(t.id);
    if (!placed.has(ref)) tray.push(`- ${ref} “${t.text}” ${PRIO[t.priority] ?? 'no priority'}${bandOf.has(ref) ? ` (in the ${bandOf.get(ref)} band)` : ''}`);
  }
  return [head, `placed (ref, what, when):`, slotLines.length ? slotLines.join('\n') : '(nothing placed yet)', `to place (ref, what; these need a slot when planning the day):`, tray.length ? tray.join('\n') : '(everything has a time)'].join('\n');
};

/** The page the owner is on, in a sentence. */
export const pageSentence = (ctx: AskContextInput | undefined, date: string, today: string, name: string | null): string => {
  const who = name ? name : 'The owner';
  const day = date === today ? 'today' : `${date} (${fmtDate('long', date)})`;
  if (!ctx) return `${who} is looking at ${day}.`;
  switch (ctx.tab) {
    case 'today':
      return `${who} is on the Today tab looking at ${day}.`;
    case 'plan':
      return `${who} is on the Plan tab looking at the week of ${mondayOf(ctx.date ?? date)}.`;
    case 'goals':
      return `${who} is on the Goals tab${ctx.level ? `, on the ${ctx.level} goal` : ''}.`;
    case 'journal':
      return `${who} is on the Journal tab looking at ${day}.`;
  }
};

export interface ProfileBlock {
  name: string | null;
  text: string;
}

/** Who the owner is: name, the training answers, time zone, units, and the "About you" note. Stable across turns. */
export const profileBlock = (db: DB, userId: string): ProfileBlock => {
  const u = db.select({ name: users.name, timezone: users.timezone, note: users.profileNote }).from(users).where(eq(users.id, userId)).get();
  const tp = readTrainingProfile(db, userId);
  const lines = [
    `OWNER: ${u?.name ?? 'name not given'}. Time zone: ${u?.timezone ?? 'unknown'}. Units: miles, minutes per mile, °F.`,
    tp ? `TRAINING: goal ${tp.goal}${tp.raceDate ? ` on ${tp.raceDate}` : ''}, run days ${tp.runDays.join(' ')}, long run ${tp.longRunDay}, ${tp.weeklyMiles} mi/week.` : 'TRAINING: no answers given yet.',
    u?.note ? `ABOUT: ${u.note}` : '',
  ].filter(Boolean);
  return { name: u?.name ?? null, text: lines.join('\n') };
};

/** What the assistant was told to remember, one line each, for the cached memory block. */
export const memoryBlock = (db: DB, userId: string): string => {
  const rows = db.select().from(userMemory).where(eq(userMemory.userId, userId)).orderBy(asc(userMemory.updatedAt)).limit(60).all();
  return rows.length ? `MEMORIES (what the owner asked you to remember; key | text):\n${rows.map((r) => `- ${r.key} | ${r.text}`).join('\n')}` : 'MEMORIES: none yet.';
};

/** The per-turn CONTEXT block: the day, the plan, habits, the morning, the day's plan, recent activities, to-dos, goals, reminders. */
export const contextFor = (db: DB, userId: string, today: string, date: string, ctx: AskContextInput | undefined, name: string | null): string => {
  const mon = mondayOf(today);
  const from = shiftDays(mon, -7);
  const to = shiftDays(mon, 27);
  const blocks = db
    .select()
    .from(planBlocks)
    .where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt), gte(planBlocks.end, shiftDays(today, -7))))
    .orderBy(asc(planBlocks.start))
    .all();
  const settings = morningSettingsOf(db, userId);
  const override = db.select({ wake: morningDays.wake }).from(morningDays).where(and(eq(morningDays.userId, userId), eq(morningDays.date, date))).get();
  const daySessions = sessionsBetween(db, userId, date, date).map((s) => ({ ...s, kind: s.kind as 'run', mark: s.mark as null }));
  const tl = buildMorning(morningDayFor(daySessions, override ? { wake: override.wake } : null, settings), settings);
  const out = tl.blocks.find((b) => b.key === 'run' || b.key === 'gym')?.start;
  const t = todoLines(db, userId);
  const pending = db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.status, 'pending')))
    .orderBy(asc(reminders.fireAtUtc))
    .limit(20)
    .all();
  return [
    `TODAY: ${today} (${fmtDate('long', today)}). ${pageSentence(ctx, date, today, name)} Weeks run Monday to Sunday; this week starts ${mon}.`,
    '',
    `MORNING: alarm ${hm(tl.day.wake)}${override ? ' (set for this day)' : ' (the usual)'}${out != null ? `, out the door ${hm(out)}` : ''}, back by ${hm(tl.back)}, leaves for the day at ${hm(tl.leave)}. Easy pace ${clock(settings.run.pace)}/mi.`,
    '',
    `HABITS (id | name | ${date}):`,
    habitLines(db, userId, date),
    '',
    dayBlock(db, userId, date, today, tl, daySessions),
    '',
    `PLAN BLOCKS: ${blocks.length ? blocks.map((b) => `${b.name} (${b.start} to ${b.end})`).join('; ') : 'none'}`,
    '',
    `SESSIONS ${from} to ${to} (id | date | what | state):`,
    sessionLines(db, userId, from, to, today),
    '',
    `ACTIVITIES, last 14 days (date | what | distance, pace, HR | source):`,
    activityLines(db, userId, shiftDays(today, -14), today),
    '',
    `OPEN TO-DOS (id | priority | when | list | text):`,
    t.todos,
    `TO-DO LISTS: ${t.lists}`,
    '',
    `GOALS (id | level | period | status | text):`,
    goalLines(db, userId, today),
    '',
    `REMINDERS pending (id | when (UTC) | title):`,
    pending.length ? pending.map((r) => `- ${r.id} | ${r.fireAtUtc} | ${r.title}${r.rrule ? ` (${r.rrule})` : ''}`).join('\n') : '(none)',
  ].join('\n');
};
