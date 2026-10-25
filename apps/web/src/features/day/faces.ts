import { dayPhase, durationWords, floorFor, floorMinutes, isSkipMark, label, mondayOf, num, shiftDays, weekSummary, type Activity, type DayPhase, type ISODate, type MorningAfterKey, type MorningSettings, type PhaseSession, type Session } from '@logbook/shared';
import { dayCaption } from '@/ui/captions';
import type { Log } from '../log/useLog';
import { isAfterKey, morningOf, routineName } from '../morning/model';
import { runTotals, shortClock } from './dayWords';
import { sessionMiles, weekMiles } from './miles';
import type { Stop } from './MiniTimeline';

/**
 * The hero's faces (docs/feel.md §3.2, §3.3), as data: which face a day shows at a minute, and the words on it. Pure, so the
 * hero only draws it and a test can read every face. Every face is 184 tall but the landed one with a route (304) and the
 * evening's Close card; only the deck's content differs between them.
 */
export type FaceKind = 'morning' | 'out' | 'open' | 'landed' | 'doneHand' | 'skipped' | 'missed' | 'rest' | 'restMorning' | 'planned' | 'evening';
export type Halo = 'done' | 'floor' | 'missed' | 'upcoming' | 'rest';

export interface NextUp {
  date: ISODate;
  session: Session;
  /** 'Tomorrow: Long 4 · out 5:55' */
  text: string;
  /** The words that always show ('Tomorrow: Long 4') and the time after them (' · out 5:55'), which below 360 wide is
   * dropped whole rather than cut mid-word (feel review 2 #8). */
  head: string;
  tail: string;
}
export interface Face {
  /** The AnimatePresence key: the face and the session it is about. */
  key: string;
  kind: FaceKind;
  eyebrow: string;
  /** A caps note at the eyebrow's right ('TOMORROW · LONG 4'). */
  aside?: string;
  /** The landed eyebrow's pace (' · 8:14 /MI'), the end of `eyebrow`: held back with the numbers through the landing. */
  eyebrowPace?: string;
  stamp: string;
  line: string;
  /** Another day's record or plan: the stamp in --ink-2 and the line in --ink-3. */
  quiet: boolean;
  /** The session the face is about (the lead: `heroSession`), null on a rest day or a run off the plan. */
  lead: PhaseSession | null;
  /** The runs that belong to the face (the lead run's, or a day's runs with nothing planned). */
  runs: Activity[];
  /** The four-stop line (morning, a rest morning, another day's morning): its tap pushes This morning. */
  stops?: Stop[];
  stopsLabel?: string;
  out?: { door: number; back: number; progress: number; sub: string | null };
  /** The open face's status line when Strava is not being checked. */
  status?: string;
  landed?: { miles: number; paceSec: number; sec: number; polyline: string | null; coach: string | null; drawKey: string };
  doneHand?: { week: string | null; adjust: boolean };
  next?: NextUp | null;
  /** The hold ring at the deck's right: open (fill to complete) or done (the check, the same node). Today's lead only. */
  ring: 'open' | 'done' | null;
  /** The landed face with a route: 304. */
  tall: boolean;
  halo: Halo;
  /** A tap opens the session sheet (or the run's). */
  pressable: boolean;
}

/** The phase of a day, with the clock passed in (the page's clock, `?at=` in dev). */
export const phaseOf = (log: Log, date: ISODate, minutes: number): DayPhase =>
  dayPhase({ date: log.today, minutes }, { date, snapshot: log.snap, settings: log.boot?.morningSettings ?? null, override: log.snap.morningOverride(date) });

/**
 * The session the hero is about on a day: the phase's lead (`heroSession`: the first run that is not skipped, else the first
 * other training session), except that a run skipped while another session is planned keeps the hero: Skip answers on the
 * card the owner acted on (`Skipped.`), and the other session stays in its compact card below (§0.2 6:30 step 8, §3.2 Skip;
 * feel review 1 #1). `secondOf` is the other one.
 */
export const heroLead = (ph: DayPhase): PhaseSession | null => {
  const lead = ph.training[0] ?? (ph.primary && ph.primary.session.kind !== 'rest' ? ph.primary : null);
  const run = ph.sessions.find((p) => p.session.kind === 'run');
  return run && lead && run !== lead && lead.session.kind !== 'run' && isSkipMark(run.session.mark) ? run : lead;
};

/** The log with one session's mark as given: the hero's face of a mark before the month carries it, and of a mark undone. */
export const withMark = (log: Log, date: ISODate, id: string, mark: Session['mark']): Log => {
  const s = log.snap;
  const snap = { ...s, sessionsOn: (d: string) => (d === date ? s.sessionsOn(d).map((x) => (x.id === id ? { ...x, mark } : x)) : s.sessionsOn(d)) };
  return { ...log, snap } as Log;
};

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

/** Short names for the routine's blocks on the line, where four stops share the card. */
const STOP_WORD: Record<string, string> = { shower: 'Shower', ready: 'Ready', smoothie: 'Eat', prep: 'Prep' };
const stopWord = (st: MorningSettings, k: MorningAfterKey) => {
  const name = routineName(st, k);
  return /^\S{1,7}$/.test(name) ? name : STOP_WORD[k]!;
};

/** A rest morning's line: alarm, the routine's first and last block, leave. Null without a timeline. */
export const restStops = (log: Log, date: ISODate): Stop[] | null => {
  const st = log.boot?.morningSettings;
  if (!st) return null;
  const T = morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st);
  const routine = T.blocks.filter((b) => isAfterKey(b.key));
  const first = routine[0];
  const last = routine.length > 1 ? routine[routine.length - 1] : undefined;
  return [
    { key: 'wake', label: 'Alarm', at: T.day.wake },
    ...(first ? [{ key: 'first', label: stopWord(st, first.key as MorningAfterKey), at: first.start }] : []),
    ...(last ? [{ key: 'last', label: stopWord(st, last.key as MorningAfterKey), at: last.start }] : []),
    { key: 'leave', label: 'Leave', at: T.leave },
  ];
};

/** Wake · Door · Back · Leave from a run (or gym) morning's phase. Null without a door. */
export const runStops = (ph: DayPhase): Stop[] | null => {
  if (ph.doorAt == null || ph.backBy == null) return null;
  return [
    { key: 'wake', label: 'Wake', at: ph.wakeAt ?? ph.doorAt },
    { key: 'door', label: 'Door', at: ph.doorAt },
    { key: 'back', label: 'Back', at: ph.backBy },
    { key: 'leave', label: 'Leave', at: ph.leaveAt ?? ph.backBy },
  ];
};

const stopsLabel = (stops: Stop[]) => `This morning: ${stops.map((s) => `${s.label.toLowerCase()} ${shortClock(s.at)}`).join(', ')}. Open This morning`;

/** The next session that is not rest or skipped, within a week after `date`, with the words for the rest face's row. */
export const nextUp = (log: Log, date: ISODate, now: number): NextUp | null => {
  for (let i = 1; i <= 7; i++) {
    const d = shiftDays(date, i);
    const s = log.snap.sessionsOn(d).find((x) => x.kind !== 'rest' && x.mark !== 'skip' && x.mark !== 'sick');
    if (!s) continue;
    const door = phaseOf(log, d, now).doorAt;
    const when = i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
    const head = `${when}: ${label(s)}`;
    const tail = door != null ? ` · out ${shortClock(door)}` : '';
    return { date: d, session: s, text: head + tail, head, tail };
  }
  return null;
};

const up = (s: string) => s.toUpperCase();
const kindEyebrow = (s: Session | undefined) => (s?.kind === 'lift' ? 'Today’s lift' : s?.kind === 'run' || !s ? 'Today’s run' : 'Today’s session');
/** Another day's eyebrow: 'YESTERDAY' / 'SUN, OCT 11' behind; 'TOMORROW' / 'IN 5 DAYS' / 'THU, OCT 29' ahead. */
export const otherEyebrow = (date: ISODate, today: ISODate): string => {
  const n = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (n === -1) return 'YESTERDAY';
  if (n === 1) return 'TOMORROW';
  if (n > 1 && n < 7) return `IN ${n} DAYS`;
  return dayCaption(date, today, 'full');
};
const paceText = (sec: number) => (sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');

/**
 * The face for `date` at `now` (minutes after midnight). `ph` is `phaseOf(log, date, now)`.
 */
export const faceOf = (log: Log, date: ISODate, ph: DayPhase): Face => {
  const today = log.today;
  const isToday = date === today;
  const past = date < today;
  const now = ph.now;
  const runs = log.snap.runsOn(date);
  const lead = heroLead(ph);
  const myRuns = !lead || lead.session.kind === 'run' ? runs : [];
  const halo = haloOf(lead, runs.length > 0);
  const base = { lead, runs: myRuns, quiet: !isToday, ring: null, tall: false, halo, pressable: !!lead || myRuns.length > 0 } as const;
  const eyebrowOther = otherEyebrow(date, today);

  if (isToday && ph.phase === 'evening') return { ...base, key: 'evening', kind: 'evening', eyebrow: 'CLOSE THE DAY', stamp: '', line: '', quiet: false, pressable: false };

  // the run landed (Strava): the route, the stamps
  if (myRuns.length && (!lead || lead.key === 'done' || lead.key === 'floor')) {
    const t = runTotals(myRuns);
    const paceSec = t.miles > 0.1 ? t.sec / t.miles : 0;
    const polyline = myRuns.find((r) => r.polyline)?.polyline ?? null;
    const pace = paceText(paceSec);
    const who = lead ? up(label(lead.session)) : up(`${timeOfDay(myRuns[0]!.time)} run`);
    const head = isToday ? (lead ? 'TODAY’S RUN' : 'BONUS') : eyebrowOther;
    return {
      ...base,
      key: `landed-${lead?.session.id ?? myRuns[0]!.id}`,
      kind: 'landed',
      eyebrow: pace ? `${up(head)} · ${pace} /MI` : up(head),
      eyebrowPace: pace ? ` · ${pace} /MI` : undefined,
      stamp: who,
      line: `${milesText(t.miles)} mi${pace ? ` at ${pace}` : ''}.${lead?.key === 'floor' ? ' Floor met.' : ''}`,
      quiet: false,
      landed: { miles: t.miles, paceSec, sec: t.sec, polyline, coach: log.snap.coachOn(date, lead ? lead.session.id : 'run'), drawKey: `route-${myRuns[0]!.id}` },
      tall: !!polyline,
      ring: null,
    };
  }

  if (lead && (lead.key === 'done' || lead.key === 'floor')) {
    // done (or the floor) by hand: the miles as planned, the week counted the same way
    const s = lead.session;
    const m = s.kind === 'run' ? sessionMiles(log.snap, date, s) : null;
    const plan = weekSummary(log.snap, mondayOf(date)).plannedMiles;
    const ran = weekMiles(log.snap, date).reduce((a, d) => a + d.miles, 0);
    const week = s.kind === 'run' && plan > 0 ? `${milesText(Math.round(ran * 10) / 10)} of ${milesText(Math.round(plan * 10) / 10)} mi ${isToday ? 'this' : 'that'} week.` : null;
    const line = lead.key === 'floor' ? 'Floor met.' : m && m.miles > 0 ? `${milesText(m.miles)} mi. Done.` : 'Done.';
    return {
      ...base,
      key: `done-${s.id}`,
      kind: 'doneHand',
      eyebrow: isToday ? up(kindEyebrow(s)) : eyebrowOther,
      stamp: up(label(s)),
      line,
      quiet: false,
      doneHand: { week, adjust: isToday && s.kind === 'run' && m?.source === 'planned' },
      ring: isToday ? 'done' : null,
    };
  }

  if (lead && lead.key === 'missed') return { ...base, key: `missed-${lead.session.id}`, kind: 'missed', eyebrow: eyebrowOther, stamp: up(label(lead.session)), line: 'Missed.' };

  if (!isToday) {
    // another day, quieter: what was, or what is coming
    const stops = lead ? runStops(ph) : restStops(log, date);
    const show = !past && stops;
    if (lead) {
      const s = lead.session;
      const skipped = lead.key === 'skipped' || s.mark === 'skip' || s.mark === 'sick';
      const line = skipped ? 'Skipped.' : ph.doorAt != null && !past ? `Out the door ${shortClock(ph.doorAt)}` : planWords(s);
      return { ...base, key: `${skipped ? 'skipped' : 'planned'}-${s.id}`, kind: skipped ? 'skipped' : 'planned', eyebrow: eyebrowOther, stamp: up(label(s)), line, stops: show ? stops! : undefined, stopsLabel: show ? stopsLabel(stops!) : undefined };
    }
    return { ...base, key: 'rest', kind: 'rest', eyebrow: eyebrowOther, stamp: 'REST', line: 'Rest day', stops: show ? stops! : undefined, stopsLabel: show ? stopsLabel(stops!) : undefined, pressable: false };
  }

  // ---------- today ----------
  if (lead && lead.key === 'today') {
    const s = lead.session;
    const stops = runStops(ph);
    if (ph.phase === 'morning' && stops) {
      const n = ph.doorIn ?? Math.max(0, Math.ceil((ph.doorAt ?? now) - now));
      return { ...base, quiet: false, key: `morning-${s.id}`, kind: 'morning', eyebrow: 'THIS MORNING', stamp: up(label(s)), line: `Out the door in ${durationWords(n)}`, stops, stopsLabel: stopsLabel(stops) };
    }
    if (ph.phase === 'out' && ph.doorAt != null && ph.backBy != null) {
      const leave = ph.leaveAt;
      return {
        ...base,
        quiet: false,
        key: `out-${s.id}`,
        kind: 'out',
        eyebrow: 'OUT',
        stamp: up(label(s)),
        line: `Back by ${shortClock(ph.backBy)}`,
        out: { door: ph.doorAt, back: ph.backBy, progress: ph.outProgress ?? 0, sub: leave != null && leave > now ? `Leave ${shortClock(leave)} · in ${durationWords(Math.ceil(leave - now))}` : null },
      };
    }
    const leave = ph.leaveAt;
    return {
      ...base,
      quiet: false,
      key: `open-${s.id}`,
      kind: 'open',
      eyebrow: up(kindEyebrow(s)),
      stamp: up(label(s)),
      line: planWords(s),
      status: leave != null && leave > now ? `Leave ${shortClock(leave)} · in ${durationWords(Math.ceil(leave - now))}` : 'Not logged yet',
      ring: 'open',
    };
  }

  // a rest day today (nothing planned, only rest, or the session skipped)
  const rm = restMorning(log, date, ph);
  const next = nextUp(log, date, now);
  if (lead && lead.key === 'skipped') {
    // the deck is the morning as it now is (the line still ends at Leave), or the next session once the morning is over. The
    // eyebrow follows the deck, never the skipped run's phase: `THIS MORNING` while the line shows (day review 1 #7), and
    // never `OUT` at the door the owner did not go through (day review 2 #2). The deck's change at Leave is a face change of
    // its own (`-am` in the key), so it waits for a touch or idle and crossfades (§5.3).
    const stops = rm?.stops ?? (ph.phase === 'morning' ? runStops(ph) : null);
    const eyebrow = stops ? 'THIS MORNING' : up(kindEyebrow(lead.session));
    return { ...base, quiet: false, key: `skipped-${lead.session.id}${stops ? '-am' : ''}`, kind: 'skipped', eyebrow, stamp: up(label(lead.session)), line: 'Skipped.', stops: stops ?? undefined, stopsLabel: stops ? stopsLabel(stops) : undefined, next: stops ? null : next };
  }
  if (rm) {
    const line = now < rm.wake ? `Alarm in ${durationWords(Math.ceil(rm.wake - now))}` : `Leave in ${durationWords(Math.ceil(rm.leave - now))}`;
    return { ...base, quiet: false, key: 'rest-morning', kind: 'restMorning', eyebrow: 'REST DAY', aside: next ? up(next.text.replace(/: /, ' · ')) : undefined, stamp: 'REST', line, stops: rm.stops, stopsLabel: stopsLabel(rm.stops), pressable: false };
  }
  return { ...base, quiet: false, key: 'rest', kind: 'rest', eyebrow: 'REST DAY', stamp: 'REST', line: 'Rest day', next, pressable: false };
};

/**
 * The floor as the hero and the Close card say it: its minutes (`20 min`), nouns and numbers on one line; the whole
 * description (`20 min with the middle 10 steady`) is the session sheet's (§3.2 *4 mi · floor 20 min*; feel review 1 #5).
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

/** A rest morning before work: the alarm-to-leave line. Null once you have left (or with no timeline). */
export const restMorning = (log: Log, date: ISODate, ph: DayPhase) => {
  if (date !== log.today) return null;
  const stops = restStops(log, date);
  if (!stops) return null;
  const wake = stops[0]!.at;
  const leave = stops[stops.length - 1]!.at;
  if (ph.now >= leave) return null;
  return { stops, wake, leave };
};

/** The second session of a two-session day (§3.4): the first training session after the lead, skipped ones included. */
export const secondOf = (ph: DayPhase, lead: PhaseSession | null): PhaseSession | null => ph.sessions.find((p) => p.session.kind !== 'rest' && p.session.id !== lead?.session.id) ?? null;

/**
 * The face the day showed before its run arrived (§6.1): the same day with that date's activities hidden. The run landing
 * shows it while it waits to be seen and through stages 1 and 2 (the open face's ring filling and becoming the check).
 */
export const preLandingFace = (log: Log, date: ISODate, minutes: number): Face => {
  const s = log.snap;
  const snap = { ...s, activitiesOn: (d: string) => (d === date ? [] : s.activitiesOn(d)), runsOn: (d: string) => (d === date ? [] : s.runsOn(d)) };
  const without = { ...log, snap } as Log;
  return faceOf(without, date, phaseOf(without, date, minutes));
};

/** The coach's read as the hero says it (§3.2): its first sentence. */
export const coachSentence = (text: string | null | undefined): string | null => {
  const t = text?.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const m = /^.+?[.!?](?=\s|$)/.exec(t);
  return m ? m[0] : t;
};
