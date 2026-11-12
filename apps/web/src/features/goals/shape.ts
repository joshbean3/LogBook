import { isISODate, shiftDays, type Aim, type GoalEvent, type GoalEventKind, type GoalLevel, type GoalStatus, type GoalStep } from '@logbook/shared';

/*
 * Goals as the app reads them, at the one place they come in (api/queries.ts: the server's answer, the copy saved on the
 * phone, every write to the cache). Whatever arrives, the screens get a list of whole goals: a row that is not a goal is
 * left out, and a field in a shape the app does not know is read as its empty value. So an older server, a newer one, or
 * a saved copy from another build can leave a goal out, and can never take a screen down. Pure.
 */

const LEVELS: readonly string[] = ['year', 'month', 'week', 'day'];
const STATUSES: readonly string[] = ['open', 'done', 'partly', 'missed'];

/** A period key its level can read: `2026`, `2026-11`, or a real date (a day, or the day a week starts). */
const periodOk = (level: GoalLevel, period: unknown): period is string => {
  if (typeof period !== 'string') return false;
  if (level === 'year') return /^\d{4}$/.test(period);
  if (level === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  // a date that is on the calendar: Feb 30 would otherwise read as Mar 2
  return isISODate(period) && shiftDays(period, 0) === period;
};

const stepOk = (s: unknown): s is GoalStep => !!s && typeof s === 'object' && typeof (s as GoalStep).id === 'string' && typeof (s as GoalStep).text === 'string' && typeof (s as GoalStep).done === 'boolean';
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Is this row a whole goal already, so it can be handed on as it is? */
const whole = (g: unknown): g is Aim => {
  if (!g || typeof g !== 'object') return false;
  const x = g as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    !!x.id &&
    LEVELS.includes(x.level as string) &&
    periodOk(x.level as GoalLevel, x.period) &&
    typeof x.text === 'string' &&
    !!x.text.trim() &&
    STATUSES.includes(x.status as string) &&
    Array.isArray(x.steps) &&
    x.steps.every(stepOk) &&
    (x.original === null || typeof x.original === 'string') &&
    (x.why === null || typeof x.why === 'string') &&
    (x.reflection === null || typeof x.reflection === 'string') &&
    (x.closedAt === null || typeof x.closedAt === 'string') &&
    typeof x.createdAt === 'string' &&
    typeof x.updatedAt === 'string'
  );
};

/** One row made whole, or null when it is not a goal (no id, no words, a level or a period the app cannot read). */
export const goalOfRow = (g: unknown): Aim | null => {
  if (whole(g)) return g;
  if (!g || typeof g !== 'object') return null;
  const x = g as Record<string, unknown>;
  if (typeof x.id !== 'string' || !x.id) return null;
  if (!LEVELS.includes(x.level as string) || !periodOk(x.level as GoalLevel, x.period)) return null;
  if (typeof x.text !== 'string' || !x.text.trim()) return null;
  const steps = Array.isArray(x.steps)
    ? x.steps.flatMap((s): GoalStep[] => {
        if (!s || typeof s !== 'object') return [];
        const r = s as Record<string, unknown>;
        return typeof r.id === 'string' && r.id && typeof r.text === 'string' && r.text.trim() ? [{ id: r.id, text: r.text, done: r.done === true }] : [];
      })
    : [];
  return {
    id: x.id,
    level: x.level as GoalLevel,
    period: x.period as string,
    text: x.text,
    original: text(x.original),
    why: text(x.why),
    status: STATUSES.includes(x.status as string) ? (x.status as GoalStatus) : 'open',
    reflection: text(x.reflection),
    steps,
    createdAt: text(x.createdAt) ?? '',
    updatedAt: text(x.updatedAt) ?? '',
    closedAt: text(x.closedAt),
  };
};

/**
 * The list of goals, whatever was handed in. A clean list comes back as the same array (so nothing re-renders for it);
 * anything else comes back repaired: not a list reads as no goals, a row that is not a goal is left out, and a second
 * goal for a period the list already has is left out too (there is one goal per level and period).
 */
export const goalsOf = (raw: unknown): Aim[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  let clean = true;
  const out: Aim[] = [];
  for (const row of raw as unknown[]) {
    const g = goalOfRow(row);
    const key = g ? `${g.level}:${g.period}` : '';
    if (!g || seen.has(key)) {
      clean = false;
      continue;
    }
    if (g !== row) clean = false;
    seen.add(key);
    out.push(g);
  }
  return clean ? (raw as Aim[]) : out;
};

// ---------- the log ----------

const KINDS: readonly string[] = ['set', 'sharpened', 'kept', 'edited', 'done', 'partly', 'missed', 'reopened', 'cleared', 'step', 'unstep'] satisfies readonly GoalEventKind[];

/** Can the log show this row: a kind and a level it has words for, a period it can name, and a time that is one? */
const eventOk = (e: unknown): e is GoalEvent => {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    !!x.id &&
    KINDS.includes(x.kind as string) &&
    LEVELS.includes(x.level as string) &&
    periodOk(x.level as GoalLevel, x.period) &&
    typeof x.at === 'string' &&
    !Number.isNaN(new Date(x.at).getTime())
  );
};

/**
 * A page of the log (`GET /goals/events`), whatever was answered. A clean page comes back as it came. Otherwise: no list
 * reads as an empty log, and an event the log has no words for (a kind from a newer server, a time that is not a time) is
 * left out, so the sheet and History draw the rest instead of falling over on one row.
 */
export const eventsOf = (raw: unknown): { events: GoalEvent[]; more: boolean } => {
  const page = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { events?: unknown; more?: unknown }) : null;
  if (!page || !Array.isArray(page.events)) return { events: [], more: false };
  const rows = page.events as unknown[];
  const clean = rows.every((e) => eventOk(e) && (e.text === null || typeof e.text === 'string')) && typeof page.more === 'boolean';
  if (clean) return page as { events: GoalEvent[]; more: boolean };
  return { events: rows.filter(eventOk).map((e) => (e.text === null || typeof e.text === 'string' ? e : { ...e, text: null })), more: page.more === true };
};
