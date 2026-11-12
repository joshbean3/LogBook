import { assess, fmtDate, heldOn, label, mi, mondayOf, num, parseISO, sessionKey, sessionWord, shiftDays, TRAINING_STATUS_INFO, type Activity, type Session, type StatusKey } from '@logbook/shared';
import type { StopState } from '@/ui/poster';
import type { Log } from '../log/useLog';
import { effortOf } from '../sessions/effortModel';
import { runIntent } from '../sessions/SessionCard';
import { isHeld } from './Held';
import { dayOrder } from './moveRule';

/**
 * The Fitness page's line of days (guide 6.5a, "Fitness"): what a shown week puts on the dotted line under its card.
 *
 * - This week: the days after today are the stops ahead. Today is the card's own. The days before today fold into one
 *   row ("Earlier this week") that opens them with their states.
 * - A week ahead: every day with something on it is a stop.
 * - A week behind: the same, each stop with what happened (done, missed, skipped).
 *
 * A day with two sessions is two stops. A planned rest day is a stop named Rest. A run with nothing planned for it is a
 * stop too, done. Pure: the same log and Monday give the same line.
 */
export interface WeekStop {
  key: string;
  date: string;
  /** The planned session, or null for a run off the plan (`runs` then holds it). */
  session: Session | null;
  runs: Activity[];
  k: StatusKey;
  /** done: the session counts (done, at its floor, or a run off the plan). ahead: everything else. */
  state: Extract<StopState, 'done' | 'ahead'>;
  /** "Tomorrow · Fri 13", "Sat 14", "Mon 9 · Done". A day's second stop says only what happened ("Missed"), or nothing. */
  caption: string;
  title: string;
  sub: string;
  /** Missed and skipped sessions keep their name with a line through it. */
  struck: boolean;
  /** What VoiceOver says for the row. */
  said: string;
}
export interface WeekStops {
  /** The stops on the line, top to bottom. */
  ahead: WeekStop[];
  /** This week's days before today (empty for any other week). */
  earlier: WeekStop[];
  /** The fold row's count: "3 sessions", "1 session", "Rest". */
  earlierWord: string;
  /** Nothing at all on the week (today's own sessions count: the card shows them). */
  empty: boolean;
  where: 'past' | 'now' | 'ahead';
}

const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));
const SETTLED: Partial<Record<StatusKey, string>> = { done: 'Done', bonus: 'Done', floor: 'Floor', missed: 'Missed', skipped: 'Skipped' };

/**
 * A stop's line under the name: what was run ("7.6 mi · 8:42 /mi"), or what is asked: the plan's own shorthand, else the
 * effort the run is graded against ("Z2, conversational"); a lift its minutes and kind. Then the effort once checked in.
 */
const detailOf = (log: Log, date: string, s: Session, name: string): string => {
  if (s.kind === 'rest') return '';
  const held = isHeld(s) && date >= log.today ? heldOn(log.boot?.user.status, date) : null;
  if (held) return `On hold · ${TRAINING_STATUS_INFO[held].label}`;
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const dist0 = s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : '';
  // a planned distance the name already says ("Easy 4", "4 mi") is not said twice
  const dist = s.kind === 'run' && s.miles && new RegExp(`\\b${num(s.miles)}\\b`).test(name) ? '' : dist0;
  const typeWord = s.type && !name.toLowerCase().includes(s.type.toLowerCase()) ? s.type : '';
  const bits: string[] = [];
  if (a) bits.push(`${mi(a.miles)} mi`, ...(a.pace ? [`${a.pace} /mi`] : []));
  else if (s.kind === 'run') bits.push(...(dist ? [dist] : []), s.details || runIntent(s.type));
  else bits.push(...(dist ? [dist] : []), ...(typeWord ? [typeWord] : []), ...(s.details ? [s.details] : []));
  const e = effortOf(s.effort);
  if (e != null) bits.push(`Effort ${e}`);
  return bits.join(' · ');
};

/** "Fri 13": the weekday and the day of the month. */
export const dayWord = (d: string) => `${fmtDate('dow', d)} ${parseISO(d).getDate()}`;

const stopsOn = (log: Log, date: string): WeekStop[] => {
  const t = log.today;
  const all = log.snap.sessionsOn(date);
  const rest = all.find((s) => s.kind === 'rest') ?? null;
  const training = dayOrder(all);
  const runs = log.snap.runsOn(date);
  const bonus = !training.some((s) => s.kind === 'run') && runs.length > 0;
  const lead = date === shiftDays(t, 1) ? 'Tomorrow · ' : '';
  const out: WeekStop[] = [];
  const push = (session: Session | null, k: StatusKey, title: string, sub: string, key: string) => {
    const word = SETTLED[k] ?? '';
    const state = k === 'done' || k === 'bonus' || k === 'floor' ? 'done' : 'ahead';
    const caption = out.length ? word : `${lead}${dayWord(date)}${word ? ` · ${word}` : ''}`;
    out.push({ key, date, session, runs: session ? [] : runs, k, state, caption, title, sub, struck: k === 'missed' || k === 'skipped', said: `${title}${sub ? `. ${sub}` : ''}. ${word ? `${word}. ` : ''}${fmtDate('dowLong', date)}. Open` });
  };
  for (const s of training) {
    const name = nameOf(s);
    push(s, sessionKey(log.snap, date, s), name, detailOf(log, date, s, name), s.id);
  }
  if (bonus) {
    const a = assess(log.zones, null, runs);
    push(null, 'bonus', runs.length === 1 ? runs[0]!.name : `${runs.length} runs`, `${mi(a.miles)} mi${a.pace ? ` · ${a.pace} /mi` : ''} · Off the plan`, `bonus-${date}`);
  }
  // a planned rest day with nothing else on it is its own stop; a day with nothing planned is not on the line
  if (!out.length && rest) push(rest, 'rest', 'Rest', '', rest.id);
  return out;
};

export const weekStops = (log: Log, mon: string): WeekStops => {
  const t = log.today;
  const now = mondayOf(t);
  const where = mon < now ? 'past' : mon > now ? 'ahead' : 'now';
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  const ahead = days.filter((d) => where !== 'now' || d > t).flatMap((d) => stopsOn(log, d));
  const earlier = where === 'now' ? days.filter((d) => d < t).flatMap((d) => stopsOn(log, d)) : [];
  const count = earlier.filter((s) => s.session?.kind !== 'rest').length;
  const earlierWord = count ? `${count} ${count === 1 ? 'session' : 'sessions'}` : earlier.length ? 'Rest' : '';
  const todays = where === 'now' ? stopsOn(log, t).length : 0;
  return { ahead, earlier, earlierWord, empty: !ahead.length && !earlier.length && !todays, where };
};
