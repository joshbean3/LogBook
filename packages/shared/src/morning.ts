import { clock, num, type ISODate } from './dates.js';
import { label, tone, TYPES } from './sessions.js';
import type { MorningAfterKey, MorningDayOverride, MorningMode, MorningSettings, Session, Tone } from './types.js';

/** The back-home blocks in their default order, and their names on the timeline. */
export const AFTER_ORDER: readonly MorningAfterKey[] = ['shower', 'ready', 'smoothie', 'prep'];
export const AFTER_LABELS: Record<MorningAfterKey, string> = { shower: 'Shower', ready: 'Get ready', smoothie: 'Blend smoothie', prep: 'Final prep' };

/** Any stored order made whole: known keys once each, in the order given, then whatever is missing in the default order. */
export const normalizeAfterOrder = (raw: unknown): MorningAfterKey[] => {
  const given = Array.isArray(raw) ? raw.filter((k): k is MorningAfterKey => AFTER_ORDER.includes(k as MorningAfterKey)) : [];
  const seen = [...new Set(given)];
  return [...seen, ...AFTER_ORDER.filter((k) => !seen.includes(k))];
};

/** The sheet's numbers: alarm 7:20, run at 7:40 at 9:00/mi, gym after a 10-minute walk, shower 8:40, door 9:30. */
export const MORNING_DEFAULTS: MorningSettings = {
  wake: 440,
  run: { pace: 540, wakeup: 15, buffer: 5 },
  gym: { length: 40, walk: 10, wakeup: 15 },
  after: { showerMode: 'fixed', showerAt: 520, shower: 15, ready: 15, smoothie: 5, prep: 15, order: [...AFTER_ORDER] },
  focus: { word: '', quote: '', by: '' },
};
export const DEFAULT_RUN_MILES = 5;

/**
 * What a new account starts with (contract 7): nobody else's routine, just "Get ready" 30 min and "Final prep" 10 min
 * before leaving at 9:30 (the shower and the smoothie are 0, so they are not on the timeline). `GET /morning/settings`
 * and the bootstrap answer this for an account that has never saved its morning; onboarding builds on it. A morning has one
 * door (the run's "Out the door") and one Leave, so no routine block is named after either.
 */
export const NEW_ACCOUNT_MORNING: MorningSettings = {
  ...MORNING_DEFAULTS,
  after: { showerMode: 'fixed', showerAt: 530, shower: 0, ready: 30, smoothie: 0, prep: 10, order: [...AFTER_ORDER] },
};

/**
 * The name an earlier build gave a new account's last block. It read as a second door before Leave ("OUT 8:20 · LEAVE
 * 8:30"), so a stored copy of it reads as the block's default name ("Final prep").
 */
const RETIRED_NAMES: Partial<Record<MorningAfterKey, string>> = { prep: 'out the door' };

/** A back-home block's name on the timeline: the athlete's own (`after.names`), else the default (AFTER_LABELS). */
export const afterLabel = (s: Pick<MorningSettings, 'after'> | null | undefined, k: MorningAfterKey): string => {
  const own = s?.after.names?.[k]?.trim();
  return own && own.toLowerCase() !== RETIRED_NAMES[k] ? own : AFTER_LABELS[k];
};

const namesOf = (raw: unknown): Partial<Record<MorningAfterKey, string>> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<MorningAfterKey, string>> = {};
  for (const k of AFTER_ORDER) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 30);
  }
  return Object.keys(out).length ? out : undefined;
};

const n = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Fill a partial, possibly stale settings object out to a full one. */
export const normalizeMorningSettings = (raw: unknown): MorningSettings => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const D = MORNING_DEFAULTS;
  return {
    wake: n(s.wake, D.wake),
    run: { pace: n(s.run?.pace, D.run.pace), wakeup: n(s.run?.wakeup, D.run.wakeup), buffer: n(s.run?.buffer, D.run.buffer) },
    gym: { length: n(s.gym?.length, D.gym.length), walk: n(s.gym?.walk, D.gym.walk), wakeup: n(s.gym?.wakeup, D.gym.wakeup) },
    after: {
      showerMode: s.after?.showerMode === 'after' ? 'after' : 'fixed',
      showerAt: n(s.after?.showerAt, D.after.showerAt),
      shower: n(s.after?.shower, D.after.shower),
      ready: n(s.after?.ready, D.after.ready),
      smoothie: n(s.after?.smoothie, D.after.smoothie),
      prep: n(s.after?.prep, D.after.prep),
      order: normalizeAfterOrder(s.after?.order),
      ...(namesOf(s.after?.names) ? { names: namesOf(s.after?.names) } : {}),
    },
    focus: { word: String(s.focus?.word ?? ''), quote: String(s.focus?.quote ?? ''), by: String(s.focus?.by ?? '') },
  };
};

export interface MorningPlan {
  mode: MorningMode;
  type: string;
  miles: number;
  minutes: number | null;
  label: string;
}

/** What the training plan implies for the morning. A skipped session (skip or sick) is not on the morning. */
export const morningPlanFor = (all: Session[]): MorningPlan => {
  const sessions = all.filter((s) => s.mark !== 'skip' && s.mark !== 'sick');
  const run = sessions.find((s) => s.kind === 'run');
  const lift = sessions.find((s) => s.kind === 'lift');
  if (run) {
    const lbl = label(run);
    return {
      mode: 'run',
      type: TYPES.run.includes(run.type ?? '') ? (run.type as string) : 'Easy',
      miles: run.miles || DEFAULT_RUN_MILES,
      minutes: null,
      label: lbl + (run.miles && !lbl.includes(num(run.miles)) ? ` · ${num(run.miles)} mi` : ''),
    };
  }
  if (lift) {
    return {
      mode: 'gym',
      type: TYPES.lift.includes(lift.type ?? '') ? (lift.type as string) : 'Strength',
      miles: DEFAULT_RUN_MILES,
      minutes: lift.minutes ?? null,
      label: label(lift) + (lift.minutes ? ` · ${lift.minutes} min` : ''),
    };
  }
  // no run and no lift: a rest morning, whether the plan says rest, says nothing, or has only a cross session
  const rest = sessions.find((s) => s.kind === 'rest');
  return { mode: 'rest', type: 'Rest', miles: DEFAULT_RUN_MILES, minutes: null, label: rest ? 'Rest day' : sessions[0] ? label(sessions[0]) : all[0] ? `${label(all[0])} skipped` : '' };
};

const MODES: readonly MorningMode[] = ['run', 'gym', 'rest'];

export interface MorningDay extends MorningDayOverride {
  plan: MorningPlan;
  own: boolean;
}

export const morningDayFor = (sessions: Session[], override: Partial<MorningDayOverride> | null, settings: MorningSettings): MorningDay => {
  const plan = morningPlanFor(sessions);
  const mode: MorningMode = override && MODES.includes(override.mode as MorningMode) ? (override.mode as MorningMode) : plan.mode;
  return {
    mode,
    type: override?.type || plan.type,
    miles: n(override?.miles, plan.miles),
    minutes: n(override?.minutes, plan.minutes ?? settings.gym.length),
    wake: n(override?.wake, settings.wake),
    plan,
    own: !!override,
  };
};

export type BlockKey = 'wake' | 'buffer' | 'run' | 'gym' | 'free' | 'shower' | 'ready' | 'smoothie' | 'prep';
export interface TimelineBlock {
  key: BlockKey;
  label: string;
  start: number;
  end: number;
  mins: number;
  tone?: Tone;
  sub?: string;
}
export interface MorningTimeline {
  day: MorningDay;
  settings: MorningSettings;
  blocks: TimelineBlock[];
  back: number;
  leave: number;
  late: number;
  onTime: number | null;
  fix: { latestWake: number; maxMiles: number | null } | null;
}

/** The whole morning, from the alarm to the front door, as timed blocks. */
export const buildMorning = (day: MorningDay, st: MorningSettings): MorningTimeline => {
  const A = st.after;
  const blocks: TimelineBlock[] = [];
  let t = day.wake;
  const add = (key: BlockKey, lbl: string, mins: number, extra?: Partial<TimelineBlock>) => {
    blocks.push({ key, label: lbl, start: t, end: t + mins, mins, ...extra });
    t += mins;
  };
  if (day.mode === 'run') {
    const runMin = Math.round((day.miles * st.run.pace) / 60);
    add('wake', 'Wake up', st.run.wakeup);
    add('buffer', 'Out the door', st.run.buffer);
    add('run', `${day.type} run · ${num(day.miles)} mi`, runMin, { tone: tone({ kind: 'run', type: day.type }), sub: `${clock(st.run.pace)}/mi` });
    add('buffer', 'Cool down', st.run.buffer);
  } else if (day.mode === 'gym') {
    add('wake', 'Wake up', st.gym.wakeup);
    add('buffer', 'Walk to the gym', st.gym.walk);
    add('gym', day.type, day.minutes, { tone: 'lift' });
    add('buffer', 'Walk home', st.gym.walk);
  } else {
    // rest: no workout, no cool-down; you are home the whole time, so `back` is the alarm and the shower waits for its usual time
    add('wake', 'Wake up', st.run.wakeup);
  }
  const rest = day.mode === 'rest';
  const back = rest ? day.wake : t;
  const fixed = A.showerMode === 'fixed';
  const showerAt = fixed ? Math.max(A.showerAt, t) : t;
  // sleeping in on a rest day is not being late
  const late = fixed && !rest ? Math.max(0, t - A.showerAt) : 0;
  if (showerAt > t) add('free', 'Free', showerAt - t);
  // the back-home routine, in the athlete's order (a block set to 0, like a new account's shower and smoothie, is skipped)
  for (const k of normalizeAfterOrder(A.order)) {
    if (!(A[k] > 0)) continue;
    add(k, afterLabel(st, k), A[k]);
  }
  const leave = t;
  let fix: MorningTimeline['fix'] = null;
  if (late) {
    const before = blocks.filter((b) => b.start < back).reduce((s, b) => s + b.mins, 0);
    let maxMiles: number | null = null;
    if (day.mode === 'run') {
      const room = A.showerAt - day.wake - st.run.wakeup - 2 * st.run.buffer;
      maxMiles = room > 0 ? Math.floor(((room * 60) / st.run.pace) * 10) / 10 : 0;
    }
    fix = { latestWake: A.showerAt - before, maxMiles };
  }
  return { day, settings: st, blocks, back, leave, late, fix, onTime: fixed ? A.showerAt + A.shower + A.ready + (A.smoothie || 0) + A.prep : null };
};

export const parsePace = (v: string): number | null => {
  const x = /^\s*(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(v || '');
  if (!x) return null;
  const s = Number(x[1]) * 60 + Number(x[2] ?? 0);
  return s >= 240 && s <= 1200 ? s : null;
};

export const minutesFromTimeInput = (v: string): number | null => {
  const x = /^(\d{1,2}):(\d{2})/.exec(v || '');
  return x ? Number(x[1]) * 60 + Number(x[2]) : null;
};
export const minutesToTimeInput = (m: number): string => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

export type { ISODate };
