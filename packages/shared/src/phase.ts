import { toISO, type ISODate } from './dates.js';
import { buildMorning, morningDayFor } from './morning.js';
import { counts, heroSession, isSkipMark, sessionKey, sessionStatus, STATUS_WORDS, type Snapshot, type StatusKey, type StatusWord } from './status.js';
import type { MorningDayOverride, MorningMode, MorningSettings, Session, SessionStatus } from './types.js';

/** Evening starts at 18:00 local, in minutes after midnight. */
export const EVENING_START = 18 * 60;

export type Phase = 'morning' | 'out' | 'day' | 'evening' | 'rest' | 'past' | 'future';

/** A local clock reading. Pass a `Date` (read in the runtime's local zone) or this, e.g. from the server with the client's date. */
export interface LocalNow {
  date: ISODate;
  /** Minutes after local midnight, 0..1439 (fractions allowed). */
  minutes: number;
}

export interface PhaseContext {
  /** The day being shown (the Today page's date). */
  date: ISODate;
  /** Statuses come from here; `snapshot.today` should be the same calendar day as `now`. */
  snapshot: Snapshot;
  /** The morning settings. Null/undefined (not loaded yet): no timeline, so no morning/out phases, only the clock. */
  settings?: MorningSettings | null;
  /** The day's morning override (Morning page edits), if any. */
  override?: Partial<MorningDayOverride> | null;
}

export interface PhaseSession {
  session: Session;
  status: SessionStatus;
  key: StatusKey;
  word: StatusWord;
}

export interface DayPhase {
  phase: Phase;
  date: ISODate;
  /** `now` as minutes after midnight (on `now`'s own date). */
  now: number;
  /** The morning's mode from the timeline (run / gym / rest); null without settings. */
  mode: MorningMode | null;
  /** Minutes after midnight. Present whenever the timeline is known (any phase on today, past or future). */
  wakeAt?: number;
  /** Out the door: the start of the first buffer block (run: "Out the door"; gym: "Walk to the gym"). Run/gym mornings only. */
  doorAt?: number;
  /** Home again: the end of the cool-down / walk home. Run/gym mornings only. */
  backBy?: number;
  /** Leave for work: the end of the morning timeline. */
  leaveAt?: number;
  /** Whole minutes until `doorAt` (ceil, so 0 only at the door itself, which is already `out`). Morning phase only. */
  doorIn?: number;
  /** 0..1 along door → back. Out phase only. */
  outProgress?: number;
  /** The session the hero leads with (`heroSession`), with its status and word. Null when nothing is planned. */
  primary: PhaseSession | null;
  /** Every session on the day in plan order, rest and skipped included, each with its own status and word. */
  sessions: PhaseSession[];
  /** Training sessions (not rest, not skipped) the hero can page between; `primary` first. */
  training: PhaseSession[];
  /** The hero's word: `sessionWord(primary)`, or Bonus/Rest for a day with nothing planned. */
  key: StatusKey;
  word: StatusWord;
}

const localNow = (now: Date | LocalNow): LocalNow => (now instanceof Date ? { date: toISO(now), minutes: now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 } : now);

/**
 * Where the shown day is right now, for the time-aware Today hero. Pure: the clock comes in as `now`.
 *
 * Not today: `past` or `future`. Today, in order:
 * 1. no training (nothing planned, only rest, or everything skipped): `rest` before 18:00, `evening` from 18:00;
 * 2. the primary session is already done or at the floor: `day` before 18:00, `evening` after (a run done early skips `out`);
 * 3. a run/gym morning with a timeline: `morning` while now < door; `out` while door <= now < back;
 * 4. otherwise `day` until 18:00, then `evening`.
 * A morning or out phase wins over the clock, so an evening run planned via the Morning page counts down too.
 */
export const dayPhase = (now: Date | LocalNow, ctx: PhaseContext): DayPhase => {
  const n = localNow(now);
  const snap = ctx.snapshot;
  const d = ctx.date;
  const all = snap.sessionsOn(d);
  const wrap = (s: Session): PhaseSession => {
    const status = sessionStatus(snap, d, s);
    const key = sessionKey(snap, d, s);
    return { session: s, status, key, word: STATUS_WORDS[key] };
  };
  const sessions = all.map(wrap);
  const lead = heroSession(all);
  const primary = lead ? (sessions.find((x) => x.session === lead) ?? null) : null;
  const training = sessions.filter((x) => x.session.kind !== 'rest' && !isSkipMark(x.session.mark));
  if (primary && training.includes(primary)) training.splice(training.indexOf(primary), 1), training.unshift(primary);
  const key = primary ? primary.key : sessionKey(snap, d, null);

  const out: DayPhase = { phase: 'day', date: d, now: n.minutes, mode: null, primary, sessions, training, key, word: STATUS_WORDS[key] };

  let door: number | null = null;
  let back: number | null = null;
  if (ctx.settings) {
    const T = buildMorning(morningDayFor(all, ctx.override ?? null, ctx.settings), ctx.settings);
    out.mode = T.day.mode;
    out.wakeAt = T.day.wake;
    out.leaveAt = T.leave;
    if (T.day.mode !== 'rest') {
      door = T.blocks.find((b) => b.key === 'buffer')?.start ?? T.day.wake;
      back = T.back;
      out.doorAt = door;
      out.backBy = back;
    }
  }

  if (d !== n.date) return { ...out, phase: d < n.date ? 'past' : 'future' };

  const evening = n.minutes >= EVENING_START;
  if (!training.length) return { ...out, phase: evening ? 'evening' : 'rest' };
  if (primary && counts(primary.status)) return { ...out, phase: evening ? 'evening' : 'day' };
  if (door != null && back != null) {
    if (n.minutes < door) return { ...out, phase: 'morning', doorIn: Math.ceil(door - n.minutes - 1e-9) };
    if (n.minutes < back) return { ...out, phase: 'out', outProgress: back > door ? (n.minutes - door) / (back - door) : 1 };
  }
  return { ...out, phase: evening ? 'evening' : 'day' };
};
