import { dayPhase, daysBetween, durationWords, floorFor, floorMinutes, fmtDate, isSkipMark, label, mondayOf, num, shiftDays, weekSummary, type Activity, type DayPhase, type ISODate, type PhaseSession, type Session, type SessionStatus } from '@logbook/shared';
import { dayCaption } from '@/ui/captions';
import type { Log } from '../log/useLog';
import { morningOf } from '../morning/model';
import { planEndOf, runTotals, shortClock } from './dayWords';
import { sessionMiles, weekMiles } from './miles';

/**
 * The hero's words (docs/system.md §5: time of day changes words, never layout), as data. One layout for every day and
 * every hour: a caps eyebrow, the stamp, a serif sub-line, one status line, a Mark. Pure, so the card only draws it and a
 * test can read every day.
 */
export type Halo = 'done' | 'floor' | 'missed' | 'upcoming' | 'rest';

export interface Landed {
  miles: number;
  paceSec: number;
  sec: number;
  polyline: string | null;
  coach: string | null;
  /** The once-a-day key the route draws on. */
  drawKey: string;
}

export interface HeroWords {
  /** What the words are about: a key that changes when the session or its state does. */
  key: string;
  /** `TODAY'S RUN`, `SATURDAY'S LIFT`, `REST DAY`. */
  eyebrow: string;
  /** The session's name (`Easy 5`), `Rest`, or an unplanned run's name. */
  stamp: string;
  /** The plan (`5 mi · floor 20 min`), or what is next on a rest day. */
  sub: string;
  /** `Out the door in 22 min`, `Back by 8:13`, `Not logged yet`, `5.02 mi at 8:14. Logged.`, `Missed`, `Skipped`, `Done by hand`. */
  status: string | null;
  /** The status line opens This morning (the morning timeline exists and is still ahead). */
  morning: boolean;
  /** A quiet caption under the status: where the plan stops, within three days of its end. */
  caption: string | null;
  lead: PhaseSession | null;
  runs: Activity[];
  landed: Landed | null;
  /** The Mark's status; null when there is nothing to mark (a rest day). */
  mark: SessionStatus | null;
  halo: Halo;
}

/** The phase of a day, with the clock passed in (the page's clock, `?at=` in dev). */
export const phaseOf = (log: Log, date: ISODate, minutes: number): DayPhase =>
  dayPhase({ date: log.today, minutes }, { date, snapshot: log.snap, settings: log.boot?.morningSettings ?? null, override: log.snap.morningOverride(date) });

/**
 * The session the hero is about on a day: the phase's lead (`heroSession`: the first run that is not skipped, else the first
 * other training session), except that a run skipped while another session is planned keeps the hero: Skip answers on the
 * card the owner acted on (`Skipped`), and the other session stays in its row below. `secondOf` is the other one.
 */
export const heroLead = (ph: DayPhase): PhaseSession | null => {
  const lead = ph.training[0] ?? (ph.primary && ph.primary.session.kind !== 'rest' ? ph.primary : null);
  const run = ph.sessions.find((p) => p.session.kind === 'run');
  return run && lead && run !== lead && lead.session.kind !== 'run' && isSkipMark(run.session.mark) ? run : lead;
};

/** The second session of a two-session day: the first training session after the lead, skipped ones included. */
export const secondOf = (ph: DayPhase, lead: PhaseSession | null): PhaseSession | null => ph.sessions.find((p) => p.session.kind !== 'rest' && p.session.id !== lead?.session.id) ?? null;

/** Miles as the hero says them: '5.02', '4', '4.5'. */
export const milesText = (v: number) => num(v);

/** "Morning" / "Afternoon" / "Evening" / "Night" from a run's `HH:MM` start: a run off the plan's stamp. */
export const timeOfDay = (time: string | null | undefined): string => {
  const h = Number(/^(\d{1,2}):/.exec(time ?? '')?.[1] ?? NaN);
  if (!Number.isFinite(h)) return 'Bonus';
  if (h < 5) return 'Night';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
};

const haloOf = (p: PhaseSession | null, hasRuns: boolean): Halo => {
  if (!p) return hasRuns ? 'done' : 'rest';
  switch (p.key) {
    case 'done':
    case 'bonus':
      return 'done';
    case 'floor':
      return 'floor';
    case 'missed':
    case 'skipped':
      return 'missed';
    case 'rest':
      return 'rest';
    default:
      return 'upcoming';
  }
};

/** Another day's eyebrow: 'YESTERDAY' / 'SUN, OCT 11' behind; 'TOMORROW' / 'IN 5 DAYS' / 'THU, OCT 29' ahead. */
export const otherEyebrow = (date: ISODate, today: ISODate): string => {
  const n = daysBetween(today, date);
  if (n === -1) return 'YESTERDAY';
  if (n === 1) return 'TOMORROW';
  if (n > 1 && n < 7) return `IN ${n} DAYS`;
  return dayCaption(date, today, 'full');
};

/** The day's possessive for the eyebrow: `TODAY’S`, `TOMORROW’S`, `YESTERDAY’S`, `SATURDAY’S`. */
export const dayPossessive = (date: ISODate, today: ISODate): string => {
  const n = daysBetween(today, date);
  const word = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : fmtDate('dowLong', date);
  return `${word}’s`.toUpperCase();
};

const kindWord = (s: Session) => (s.kind === 'lift' ? 'LIFT' : s.kind === 'run' ? 'RUN' : 'SESSION');
const paceText = (sec: number) => (sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');

/** The next session that is not rest or skipped, within a week after `date`: `Next: Easy 5, tomorrow`. */
export const nextUp = (log: Log, date: ISODate): { date: ISODate; session: Session; text: string } | null => {
  for (let i = 1; i <= 7; i++) {
    const d = shiftDays(date, i);
    const s = log.snap.sessionsOn(d).find((x) => x.kind !== 'rest' && x.mark !== 'skip' && x.mark !== 'sick');
    if (!s) continue;
    const when = i === 1 ? 'tomorrow' : fmtDate('dowLong', d);
    return { date: d, session: s, text: `Next: ${label(s)}, ${when}` };
  }
  return null;
};

/**
 * The floor as the hero says it: its minutes (`20 min`), nouns and numbers on one line; the whole description
 * (`20 min with the middle 10 steady`) is the session sheet's.
 */
export const floorShort = (s: Session): string => {
  const m = floorMinutes(s);
  return m ? `${m} min` : floorFor(s);
};

/** '4 mi · floor 20 min' / '45 min · floor 20 min'. */
export const planWords = (s: Session): string => {
  const bits: string[] = [];
  if (s.kind === 'run' && s.miles) bits.push(`${num(s.miles)} mi`);
  else if (s.minutes) bits.push(`${s.minutes} min`);
  if (floorFor(s)) bits.push(`floor ${floorShort(s)}`);
  return bits.join(' · ') || label(s);
};

/** A rest morning before work (today only): alarm and leave from the routine. Null once you have left, or with no timeline. */
export const restMorning = (log: Log, date: ISODate, now: number) => {
  if (date !== log.today) return null;
  const st = log.boot?.morningSettings;
  if (!st) return null;
  const T = morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st);
  if (now >= T.leave) return null;
  return { wake: T.day.wake, leave: T.leave };
};

/** Where the plan stops, as the hero's caption: `Banking Plan ends Sun, Nov 8` (within three days of its end). */
export const planEndCaption = (log: Log, date: ISODate): string | null => {
  const end = planEndOf(log, date);
  if (!end) return null;
  const { block, past } = end;
  const day = `${fmtDate('dowLong', block.end)}, ${fmtDate('md', block.end)}`;
  if (past) return `${block.name} ended ${day}`;
  return date === block.end ? `${block.name} ends today` : `${block.name} ends ${day}`;
};

/** The hero's words for `date` at `ph` (`phaseOf(log, date, minutes)`). */
export const heroOf = (log: Log, date: ISODate, ph: DayPhase): HeroWords => {
  const today = log.today;
  const isToday = date === today;
  const past = date < today;
  const now = ph.now;
  const runs = log.snap.runsOn(date);
  const lead = heroLead(ph);
  const myRuns = !lead || lead.session.kind === 'run' ? runs : [];
  const halo = haloOf(lead, runs.length > 0);
  const caption = isToday || date > today ? planEndCaption(log, date) : null;
  const base = { lead, runs: myRuns, landed: null, morning: false, caption, halo } as const;
  const timeline = !!log.boot?.morningSettings;

  // the run landed (Strava): the numbers, the route
  if (myRuns.length && (!lead || lead.key === 'done' || lead.key === 'floor')) {
    const t = runTotals(myRuns);
    const paceSec = t.miles > 0.1 ? t.sec / t.miles : 0;
    const polyline = myRuns.find((r) => r.polyline)?.polyline ?? null;
    const pace = paceText(paceSec);
    const s = lead?.session;
    return {
      ...base,
      key: `landed-${s?.id ?? myRuns[0]!.id}`,
      eyebrow: `${dayPossessive(date, today)} RUN`,
      stamp: s ? label(s) : `${timeOfDay(myRuns[0]!.time)} run`,
      sub: s ? planWords(s) : (myRuns[0]!.name ?? 'Off the plan'),
      status: `${milesText(t.miles)} mi${pace ? ` at ${pace}` : ''}. ${lead?.key === 'floor' ? 'Floor met.' : 'Logged.'}`,
      landed: { miles: t.miles, paceSec, sec: t.sec, polyline, coach: log.snap.coachOn(date, s ? s.id : 'run'), drawKey: `route-${myRuns[0]!.id}` },
      mark: lead ? lead.status : 'done',
    };
  }

  if (lead) {
    const s = lead.session;
    const eyebrow = `${dayPossessive(date, today)} ${kindWord(s)}`;
    const head = { ...base, key: `${lead.key}-${s.id}`, eyebrow, stamp: label(s), sub: planWords(s), mark: lead.status };
    if (lead.key === 'done' || lead.key === 'floor') {
      // done (or the floor) by hand: the miles as planned, the week counted the same way
      const m = s.kind === 'run' ? sessionMiles(log.snap, date, s) : null;
      const plan = weekSummary(log.snap, mondayOf(date)).plannedMiles;
      const ran = weekMiles(log.snap, date).reduce((a, d) => a + d.miles, 0);
      const week = s.kind === 'run' && plan > 0 ? ` · ${milesText(Math.round(ran * 10) / 10)} of ${milesText(Math.round(plan * 10) / 10)} mi ${isToday ? 'this' : 'that'} week` : '';
      const status = lead.key === 'floor' ? 'Floor met' : m && m.miles > 0 ? `${milesText(m.miles)} mi · Done by hand` : 'Done by hand';
      return { ...head, status: status + week };
    }
    if (lead.key === 'missed') return { ...head, status: 'Missed' };
    if (lead.key === 'skipped' || isSkipMark(s.mark)) return { ...head, status: 'Skipped' };
    if (isToday) {
      if (ph.phase === 'morning' && ph.doorAt != null) {
        const n = ph.doorIn ?? Math.max(0, Math.ceil(ph.doorAt - now));
        return { ...head, key: `morning-${s.id}`, status: `Out the door in ${durationWords(n)}`, morning: true };
      }
      if (ph.phase === 'out' && ph.backBy != null) return { ...head, key: `out-${s.id}`, status: `Back by ${shortClock(ph.backBy)}`, morning: true };
      const leave = ph.leaveAt;
      return { ...head, status: leave != null && leave > now ? `Leave ${shortClock(leave)} · in ${durationWords(Math.ceil(leave - now))}` : 'Not logged yet', morning: timeline && leave != null && leave > now };
    }
    if (past) return { ...head, status: 'Missed' };
    // ahead: the plan, and the door when the morning is known
    return { ...head, status: ph.doorAt != null ? `Out the door ${shortClock(ph.doorAt)}` : 'Planned', morning: timeline };
  }

  // nothing planned: a rest day, with what is next
  const next = nextUp(log, date);
  const rm = isToday ? restMorning(log, date, now) : null;
  const status = rm ? (now < rm.wake ? `Alarm in ${durationWords(Math.ceil(rm.wake - now))}` : `Leave in ${durationWords(Math.ceil(rm.leave - now))}`) : null;
  return { ...base, key: 'rest', eyebrow: 'REST DAY', stamp: 'Rest', sub: next?.text ?? (past ? 'Nothing was planned' : 'Nothing planned'), status, morning: !!rm, mark: null, halo: 'rest' };
};

/** The coach's read as the hero says it: its first sentence. */
export const coachSentence = (text: string | null | undefined): string | null => {
  const t = text?.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const m = /^.+?[.!?](?=\s|$)/.exec(t);
  return m ? m[0] : t;
};
