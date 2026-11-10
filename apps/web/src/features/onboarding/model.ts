import {
  buildMorning,
  buildTemplate,
  fmtDate,
  GOAL_SPECS,
  label,
  mondayOf,
  morningDayFor,
  normalizeMorningSettings,
  pad,
  shiftDays,
  tone,
  weekdayOf,
  WEEKDAYS,
  type Goal,
  type ISODate,
  type MorningSettings,
  type PlanBlock,
  type Session,
  type Template,
  type TemplateSession,
  type TrainingProfile,
  type Weekday,
} from '@logbook/shared';

/** The training answers: one shape for onboarding, Settings and the server (`zTrainingProfile`, kept on the account). */
export type { TrainingProfile };

/**
 * The first-run answers and the training profile, shared by onboarding and Settings → Training.
 * Everything here is pure: the payoff screen previews the first week with `buildTemplate` while the request runs.
 */

export const GOALS: ReadonlyArray<{ id: Goal; label: string; long: string }> = [
  { id: 'base', label: 'Just running', long: 'Just running' },
  { id: '5k', label: '5K', long: '5K' },
  { id: '10k', label: '10K', long: '10K' },
  { id: 'half', label: 'Half', long: 'Half marathon' },
  { id: 'marathon', label: 'Marathon', long: 'Marathon' },
];
/** The most habits one account holds (the server's own limit on the setup answers). */
export const HABIT_LIMIT = 12;
/** The longest name a habit typed on the habits step takes: it has to fit a tile on Today. */
export const HABIT_NAME_MAX = 40;
export const goalLong = (g: Goal) => GOALS.find((x) => x.id === g)?.long ?? 'Just running';

/** Where week one starts for most people who say this goal: a sensible volume they can hold. */
export const DEFAULT_MILES: Record<Goal, number> = { base: 12, '5k': 15, '10k': 18, half: 22, marathon: 28 };
export const MILES_MIN = 3;
export const MILES_MAX = 80;

export const DAY_LETTER: Record<Weekday, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };
export const DAY_NAME: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const DAY_SHORT: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export const sortDays = (d: Weekday[]) => WEEKDAYS.filter((w) => d.includes(w));

export const DEFAULT_PROFILE: TrainingProfile = { goal: 'base', raceDate: null, runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: DEFAULT_MILES.base };

/** Wake 6:30, leave for work 8:30: the morning most people describe. Minutes after midnight. */
export const DEFAULT_WAKE = 390;
export const DEFAULT_LEAVE = 510;
/** The timeline the markers ride on: 4:00 to 11:00. */
export const TRACK_FROM = 240;
export const TRACK_TO = 660;
/** Leave is at least an hour after the alarm (the shower, getting ready and prep alone take 50 minutes). */
export const MIN_GAP = 60;

export const STARTER_HABITS = ['Sleep 7 h', 'Stretch', 'Read 15 min', 'Protein', 'No phone in bed'] as const;
/**
 * Add a habit by name on the habits step: a starter or one already typed is picked (not duplicated), a new name joins
 * the list. At the limit nothing is added and `refused` says so, so a 13th can never reach the save.
 */
export const addHabit = (selected: string[], custom: string[], text: string): { selected: string[]; custom: string[]; refused: boolean } => {
  const same = { selected, custom, refused: false };
  const name = text.trim().replace(/\s+/g, ' ').slice(0, HABIT_NAME_MAX).trim();
  if (!name) return same;
  const dupe = [...STARTER_HABITS, ...custom].find((x) => x.toLowerCase() === name.toLowerCase());
  if (dupe && selected.includes(dupe)) return same;
  if (selected.length >= HABIT_LIMIT) return { ...same, refused: true };
  return dupe ? { selected: [...selected, dupe], custom, refused: false } : { selected: [...selected, name], custom: [...custom, name], refused: false };
};

/** `6:50` for a morning time; `12:10 PM` once it could be read either way. */
export const hm = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const t = `${h % 12 || 12}:${pad(m % 60)}`;
  return h >= 12 ? `${t} PM` : t;
};
/** For VoiceOver and anywhere AM matters: `6:50 AM`. */
export const hmFull = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const snap5 = (m: number) => Math.round(m / 5) * 5;
export const paceText = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))}`;

/** Keep the long run on a run day: when it is switched off, the last run day of the week (Sunday first) takes it. */
export const fixLongRun = (runDays: Weekday[], longRunDay: Weekday): Weekday => {
  if (runDays.includes(longRunDay)) return longRunDay;
  const s = sortDays(runDays);
  return s[s.length - 1] ?? 'sun';
};

// ---------- race days ----------
/** The block's first full Monday when it starts on `start`. */
const firstMonday = (start: ISODate) => (weekdayOf(start) === 'mon' ? start : shiftDays(mondayOf(start), 7));
/** Sundays a race can fall on: from four weeks into the block to 29 weeks out (the template's limit is 30). */
export const raceSundays = (start: ISODate): ISODate[] => {
  const m = firstMonday(start);
  const out: ISODate[] = [];
  for (let w = 4; w <= 29; w++) out.push(shiftDays(m, 7 * w - 1));
  return out;
};
/** The Sunday nearest the goal's usual block length. */
export const defaultRaceDay = (goal: Goal, start: ISODate): ISODate => {
  const list = raceSundays(start);
  const want = shiftDays(start, GOAL_SPECS[goal].defaultWeeks * 7);
  return list.reduce((best, d) => (Math.abs(+new Date(d) - +new Date(want)) < Math.abs(+new Date(best) - +new Date(want)) ? d : best), list[0]!);
};
export const weeksUntil = (from: ISODate, to: ISODate) => Math.round((+new Date(to) - +new Date(from)) / (7 * 864e5));

/** Under this many weeks to race day a plan cannot build to the distance, so the questions say so (they never block). */
const TIGHT_WEEKS: Record<Exclude<Goal, 'base'>, number> = { '5k': 6, '10k': 8, half: 10, marathon: 14 };
const A_RACE: Record<Exclude<Goal, 'base'>, string> = { '5k': 'A 5K', '10k': 'A 10K', half: 'A half marathon', marathon: 'A marathon' };
export interface RaceWarning {
  /** "A marathon needs about 16 weeks. This race is 5 weeks away." */
  text: string;
  /** The race Sunday nearest the goal's usual length: the one-tap way out. */
  later: ISODate;
}
/** The warning for a race day too close for its distance; null when the date is far enough, not set, or there is no race. */
export const raceWarning = (p: Pick<TrainingProfile, 'goal' | 'raceDate'>, start: ISODate): RaceWarning | null => {
  if (p.goal === 'base' || !p.raceDate) return null;
  const weeks = weeksUntil(start, p.raceDate);
  if (weeks >= TIGHT_WEEKS[p.goal]) return null;
  return { text: `${A_RACE[p.goal]} needs about ${GOAL_SPECS[p.goal].defaultWeeks} weeks. This race is ${weeks} ${weeks === 1 ? 'week' : 'weeks'} away.`, later: defaultRaceDay(p.goal, start) };
};

// ---------- previews ----------
/** "24 min", or past an hour and a half "5 h 24 min". */
export const minsText = (m: number) => {
  const v = Math.max(0, Math.round(m));
  return v > 90 ? `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60} min` : ''}` : `${v} min`;
};
/** "4 mile easy run" from a run's type and miles. */
const runWords = (run: { type: string; miles: number }) => `${Math.round(run.miles * 10) / 10} mile ${run.type.toLowerCase()} run`;
/**
 * The morning verdict under the track, in plain words: "Tight. A 4 mile easy run ends 61 min after you need to start
 * getting ready." or "A 4 mile easy run has you back by 7:31, with 24 min to spare."
 */
export const verdictLine = (pv: Pick<MorningPreview, 'late' | 'back' | 'spare'>, run: { type: string; miles: number } = { type: 'Easy', miles: 4 }) => {
  const r = runWords(run);
  if (pv.late > 0) return `Tight. A ${r} ends ${minsText(pv.late)} after you need to start getting ready.`;
  return `A ${r} has you back by ${hm(pv.back)}${pv.spare >= 5 ? `, with ${minsText(pv.spare)} to spare` : ''}.`;
};
/** After work: the run starts this long after work ends (the trip home and changing, Today's afternoon defaults). */
export const AFTER_WORK_LEAD = 40;
/** "Run after work, about 6:10 PM." */
export const afternoonLine = (offWork: number) => `Run after work, about ${hm(offWork + AFTER_WORK_LEAD)}.`;
/**
 * The one-tap fix for a tight morning: the latest wake time, in 5-minute steps down to the track's start, at which the
 * run fits; failing that, the earliest leave time that fits at the earliest wake. Searched on the real preview, so one tap
 * always clears it. Null when it already fits.
 */
export const morningFix = (wake: number, leave: number, base?: MorningSettings | null, run?: { type: string; miles: number }): { wake: number; leave: number } | null => {
  if (previewMorning(wake, leave, run, base).late <= 0) return null;
  for (let w = Math.floor((wake - 5) / 5) * 5; w >= TRACK_FROM; w -= 5) if (previewMorning(w, leave, run, base).late <= 0) return { wake: w, leave };
  for (let l = snap5(leave + 5); l <= 24 * 60 - 5; l += 5) if (previewMorning(wake, l, run, base).late <= 0) return { wake, leave: l };
  return null;
};
export const safeTemplate = (p: TrainingProfile, startDate: ISODate): Template | null => {
  try {
    return buildTemplate({ goal: p.goal, startDate, runDays: p.runDays, longRunDay: fixLongRun(p.runDays, p.longRunDay), weeklyMiles: p.weeklyMiles, raceDate: p.goal === 'base' ? null : p.raceDate });
  } catch {
    try {
      return buildTemplate({ goal: p.goal, startDate, runDays: p.runDays, longRunDay: fixLongRun(p.runDays, p.longRunDay), weeklyMiles: p.weeklyMiles, raceDate: null });
    } catch {
      return null;
    }
  }
};

/** The morning settings `/me/onboarding` will write: the alarm, and a fixed shower that lands Leave on `leave`. */
export const morningFrom = (wake: number, leave: number, base?: MorningSettings | null): MorningSettings => {
  const s = normalizeMorningSettings(base ?? {});
  const A = s.after;
  const afterShower = A.shower + A.ready + (A.smoothie || 0) + A.prep;
  return { ...s, wake, after: { ...A, showerMode: 'fixed', showerAt: Math.max(wake, leave - afterShower) } };
};

const asSession = (t: Pick<TemplateSession, 'date' | 'type' | 'miles' | 'details'>): Session => ({
  id: `preview-${t.date}`,
  date: t.date,
  position: 0,
  kind: 'run',
  type: t.type,
  title: null,
  details: t.details ?? null,
  miles: t.miles,
  minutes: null,
  blockId: null,
  movedFrom: null,
  mark: null,
});

export interface MorningPreview {
  door: number;
  back: number;
  leave: number;
  /** Minutes the run ends after the shower should start (0 = it fits). */
  late: number;
  /** Free minutes between back and the shower. */
  spare: number;
}
/** A run morning on these times: when you leave the house, get back, and whether it fits before work. */
export const previewMorning = (wake: number, leave: number, run: { type: string; miles: number } = { type: 'Easy', miles: 4 }, base?: MorningSettings | null): MorningPreview => {
  const st = morningFrom(wake, leave, base);
  const s = asSession({ date: '2000-01-01', type: run.type, miles: run.miles, details: null });
  const tl = buildMorning(morningDayFor([s], null, st), st);
  const door = tl.blocks.find((b) => b.key === 'buffer')?.start ?? wake + st.run.wakeup;
  const free = tl.blocks.find((b) => b.key === 'free');
  return { door, back: tl.back, leave: tl.leave, late: tl.late, spare: free ? free.mins : 0 };
};

export interface WeekPreviewDay {
  date: ISODate;
  session: TemplateSession | null;
  label: string;
  tone: string;
}
export interface FirstWeek {
  template: Template | null;
  days: WeekPreviewDay[];
  miles: number;
  runs: number;
  first: TemplateSession | null;
  /** "Tomorrow", or the weekday of the first run. */
  firstWhen: string;
  morning: MorningPreview | null;
}
/** The seven days from `start`, as the payoff shows them, and the first run's morning. */
export const firstWeek = (p: TrainingProfile, start: ISODate, today: ISODate, wake: number, leave: number, base?: MorningSettings | null): FirstWeek => {
  const template = safeTemplate(p, start);
  const days: WeekPreviewDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = shiftDays(start, i);
    const session = template?.sessions.find((s) => s.date === date) ?? null;
    days.push({ date, session, label: session ? label(asSession(session)) : 'Rest', tone: session ? tone({ kind: 'run', type: session.type }) : 'rest' });
  }
  const first = template?.sessions[0] ?? null;
  const firstWhen = !first ? '' : first.date === shiftDays(today, 1) ? 'Tomorrow' : first.date === today ? 'Today' : fmtDate('dowLong', first.date);
  return {
    template,
    days,
    miles: Math.round(days.reduce((s, d) => s + (d.session?.miles ?? 0), 0) * 10) / 10,
    runs: days.filter((d) => d.session).length,
    first,
    firstWhen,
    morning: first ? previewMorning(wake, leave, { type: first.type, miles: first.miles }, base) : null,
  };
};

// ---------- the morning routine, from chips (critic B9) ----------
/**
 * What happens between the run and the front door, asked as chips on the morning step. Nothing is picked for you: with
 * none, the routine is the generic "Get ready" and the last few minutes out the door (contract 7's defaults). Each chip adds
 * its minutes to one of the routine's four blocks (`after.shower`, `ready`, `smoothie`, `prep`).
 */
export const ROUTINE_CHIPS = [
  { id: 'shower', label: 'Shower', mins: 15, key: 'shower' },
  { id: 'breakfast', label: 'Breakfast', mins: 15, key: 'smoothie' },
  { id: 'bag', label: 'Pack bag', mins: 5, key: 'prep' },
  { id: 'coffee', label: 'Coffee', mins: 5, key: 'smoothie' },
] as const;
export type RoutineChip = (typeof ROUTINE_CHIPS)[number]['id'];
export interface RoutineMinutes {
  shower: number;
  ready: number;
  smoothie: number;
  prep: number;
}
/** Get ready 25 and out the door 10, plus whatever the chips add. */
export const routineFrom = (chips: readonly string[]): RoutineMinutes => {
  const r: RoutineMinutes = { shower: 0, ready: 25, smoothie: 0, prep: 10 };
  for (const c of ROUTINE_CHIPS) if (chips.includes(c.id)) r[c.key] += c.mins;
  return r;
};
export const routineTotal = (r: RoutineMinutes) => r.shower + r.ready + r.smoothie + r.prep;
/**
 * The routine's block names from the chips, said explicitly so no default stands in for them: the smoothie slot is the meal
 * the athlete picked ("Breakfast", or "Coffee" when that is all), and every other block keeps its own default name. An
 * empty string clears a stored name (an earlier build named the last block "Out the door", a second door before Leave).
 */
export const routineNames = (chips: readonly string[]): Record<'smoothie' | 'prep', string> => ({
  smoothie: chips.includes('breakfast') ? 'Breakfast' : chips.includes('coffee') ? 'Coffee' : '',
  prep: '',
});
/** Morning settings carrying this routine, for the live verdict and the timeline on the morning step. */
export const routineSettings = (chips: readonly string[]): MorningSettings => {
  const s = normalizeMorningSettings({});
  const names = Object.fromEntries(Object.entries(routineNames(chips)).filter(([, v]) => v));
  return { ...s, after: { ...s.after, ...routineFrom(chips), ...(Object.keys(names).length ? { names } : {}) } };
};

// ---------- answers an earlier build kept on this device ----------
/**
 * Before the account kept the answers (`users.training_profile`), onboarding and Settings kept them per account in
 * localStorage. Settings hands such a copy to the server once (when the account has none) and forgets it.
 */
const LEGACY_KEY = (userId: string) => `logbook.training.${userId}`;
export const takeLegacyProfile = (userId: string | undefined): (TrainingProfile & { savedAt?: string }) | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY(userId));
    if (!raw) return null;
    localStorage.removeItem(LEGACY_KEY(userId));
    const p = JSON.parse(raw) as TrainingProfile & { savedAt?: string };
    if (!p || !GOALS.some((g) => g.id === p.goal) || !Array.isArray(p.runDays) || !p.runDays.length) return null;
    return p;
  } catch {
    return null;
  }
};

const GOAL_FROM_NAME: Array<[RegExp, Goal]> = [
  [/^half/i, 'half'],
  [/^marathon/i, 'marathon'],
  [/^10k/i, '10k'],
  [/^5k/i, '5k'],
  [/^base/i, 'base'],
];
/** The block the profile describes: the newest one still running or ahead, written from a template if there is one. */
export const currentBlock = (blocks: PlanBlock[], today: ISODate): PlanBlock | null => {
  const live = blocks.filter((b) => b.end >= today);
  const pick = (l: PlanBlock[]) => [...l].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  return pick(live.filter((b) => b.source === 'onboarding' || b.source === 'template')) ?? pick(live);
};
/** Read the answers back out of the plan: goal and race from the block, days and volume from its first full week. */
export const deriveProfile = (block: PlanBlock | null, sessions: Session[]): TrainingProfile => {
  if (!block) return DEFAULT_PROFILE;
  const goal = GOAL_FROM_NAME.find(([re]) => re.test(block.name))?.[1] ?? 'base';
  const mine = sessions.filter((s) => s.blockId === block.id && s.kind === 'run');
  const race = mine.find((s) => /race/i.test(s.type ?? ''));
  const raceDate = goal === 'base' ? null : race?.date ?? (/weeks?$/.test(block.name) ? null : block.end);
  if (!mine.length) return { ...DEFAULT_PROFILE, goal, raceDate, weeklyMiles: DEFAULT_MILES[goal] };
  const m1 = firstMonday(block.start);
  const week1 = mine.filter((s) => s.date >= m1 && s.date <= shiftDays(m1, 6));
  const pool = week1.length ? week1 : mine;
  // the days the block runs on most weeks, not just the first (which may be a partial lead-in)
  const weeks = new Set(mine.map((s) => mondayOf(s.date))).size || 1;
  const perDay = new Map<Weekday, number>();
  for (const s of mine) perDay.set(weekdayOf(s.date), (perDay.get(weekdayOf(s.date)) ?? 0) + 1);
  const usual = sortDays([...perDay.entries()].filter(([, n]) => n >= weeks / 2).map(([d]) => d));
  const runDays = usual.length ? usual : sortDays([...new Set(pool.map((s) => weekdayOf(s.date)))]);
  const longs = mine.filter((s) => /long/i.test(s.type ?? ''));
  const count = new Map<Weekday, number>();
  for (const s of longs) count.set(weekdayOf(s.date), (count.get(weekdayOf(s.date)) ?? 0) + 1);
  const longRunDay = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? runDays[runDays.length - 1] ?? 'sun';
  const weeklyMiles = Math.max(MILES_MIN, Math.round(pool.reduce((s, x) => s + (x.miles ?? 0), 0)));
  return { goal, raceDate, runDays: runDays.length ? runDays : DEFAULT_PROFILE.runDays, longRunDay, weeklyMiles: week1.length ? weeklyMiles : DEFAULT_MILES[goal] };
};

/**
 * The block as it stands this week (critic B6): this week's planned miles, the weekdays it runs on, and its long-run day
 * (a session named Long, else the week's longest run, the later day on a tie). Before the block has started, its first
 * week. Goal and race day are read from the block as in `deriveProfile`. Never a default the plan doesn't show: with no
 * runs to read, null.
 */
export const deriveThisWeek = (block: PlanBlock | null, sessions: Session[], today: ISODate): (TrainingProfile & { week: ISODate }) | null => {
  if (!block) return null;
  const base = deriveProfile(block, sessions);
  const mine = sessions.filter((s) => s.blockId === block.id && s.kind === 'run');
  const weekOf = (m: ISODate) => mine.filter((s) => s.date >= m && s.date <= shiftDays(m, 6));
  let m = mondayOf(today < block.start ? block.start : today);
  let week = weekOf(m);
  // a week with nothing planned (between weeks of the block, or a lead-in): the next week that has runs
  for (let i = 0; !week.length && i < 8 && shiftDays(m, 7) <= block.end; i++) week = weekOf((m = shiftDays(m, 7)));
  if (!week.length) return null;
  const runDays = sortDays([...new Set(week.map((s) => weekdayOf(s.date)))]);
  const named = week.find((s) => /long/i.test(s.type ?? ''));
  const longest = [...week].sort((a, b) => (b.miles ?? 0) - (a.miles ?? 0) || (a.date < b.date ? 1 : -1))[0]!;
  const longRunDay = weekdayOf((named ?? longest).date);
  const weeklyMiles = Math.max(MILES_MIN, Math.round(week.reduce((n, s) => n + (s.miles ?? 0), 0)));
  return { goal: base.goal, raceDate: base.raceDate, runDays, longRunDay, weeklyMiles, week: m };
};

export const sameProfile =(a: TrainingProfile, b: TrainingProfile) =>
  a.goal === b.goal && (a.goal === 'base' || a.raceDate === b.raceDate) && a.longRunDay === b.longRunDay && a.weeklyMiles === b.weeklyMiles && sortDays(a.runDays).join() === sortDays(b.runDays).join();

/** "10K on Sun, Dec 27" / "Half marathon, no date yet" / "Just running". */
export const goalLine = (p: TrainingProfile) => (p.goal === 'base' ? 'Just running' : p.raceDate ? `${goalLong(p.goal)} on ${fmtDate('short', p.raceDate)}` : `${goalLong(p.goal)}, no date yet`);

/** The first Monday after `d` (a week out on a Monday): where a rebuilt plan starts. */
export const nextMondayAfter = (d: ISODate): ISODate => (weekdayOf(d) === 'mon' ? shiftDays(d, 7) : shiftDays(mondayOf(d), 7));

/** Whether the block was written from answers (onboarding or a template), so its goal can be read from its name. */
export const isTemplateBlock = (b: PlanBlock | null) => !!b && (b.source === 'onboarding' || b.source === 'template' || GOAL_FROM_NAME.some(([re]) => re.test(b.name)));

// ---------- the block's shape: the live preview under the first questions ----------
export interface BlockShape {
  /** Weeks to race day as the race strip counts them; for a block with no race, its full weeks. */
  weeks: number;
  /** The biggest week's target, in miles. */
  peak: number;
  /** The first full week's target, where the build starts. */
  from: number;
  taperWeeks: number;
  raceDate: ISODate | null;
  /** One bar per week, lead-in included: its kind and its height as a share of the peak (0..1). */
  bars: Array<{ week: number; kind: Template['weeks'][number]['kind']; h: number }>;
}

/**
 * What the answers so far would build, read off the real template (the same `buildTemplate` the server runs), so the
 * preview never promises a number the plan won't keep. The race week's bar stands at the race's own distance share.
 */
export const blockShape = (t: Template | null): BlockShape | null => {
  if (!t || !t.weeks.length) return null;
  const full = t.weeks.filter((w) => w.week > 0);
  const vol = (w: Template['weeks'][number]) => (w.kind === 'race' ? w.miles : w.target);
  const peak = Math.max(1, ...t.weeks.map(vol));
  return {
    // counted the way the race-day strip counts them ("12 wk"), so the two never disagree
    weeks: t.raceDate ? weeksUntil(t.start, t.raceDate) : full.length,
    peak: Math.round(Math.max(...t.weeks.filter((w) => w.kind !== 'race').map((w) => w.target), 0)),
    from: Math.round((full[0] ?? t.weeks[0]!).target),
    taperWeeks: t.weeks.filter((w) => w.kind === 'taper').length,
    raceDate: t.raceDate,
    bars: t.weeks.map((w) => ({ week: w.week, kind: w.kind, h: Math.max(0.08, vol(w) / peak) })),
  };
};

/** The one line under the shape: "16 weeks. 18 to 34 mi a week, then a 2-week taper." or "16 weeks. About 80 mi a week." */
export const blockLine = (s: BlockShape) => {
  const weeks = `${s.weeks} ${s.weeks === 1 ? 'week' : 'weeks'}`;
  const range = s.peak > s.from ? `${s.from} to ${s.peak} mi a week` : `About ${s.peak} mi a week`;
  const taper = s.taperWeeks ? `, then a ${s.taperWeeks}-week taper` : '';
  return `${weeks}. ${range}${taper}.`;
};

/**
 * The plan-build beat on the payoff: the real steps the answers asked for, in the order the plan takes them. Each is
 * true of what is written (Buell & Norton 2011: visible work raises perceived value only when it's the actual work).
 */
export const buildSteps = (p: TrainingProfile | null, s: BlockShape | null, wake: number, leave: number, habits: number): string[] => {
  const out: string[] = [];
  // no running plan: the morning and the habits are all that is set up
  if (!p) {
    out.push(`Planning mornings from ${hm(wake)} to ${hm(leave)}`);
    if (habits) out.push(`Adding ${habits} ${habits === 1 ? 'habit' : 'habits'} to Today`);
    out.push('Getting Today ready');
    return out;
  }
  out.push(p.goal === 'base' ? 'Setting a steady build' : `Counting back from ${p.raceDate ? fmtDate('short', p.raceDate) : 'race day'}`);
  out.push(`Putting the long run on ${DAY_NAME[fixLongRun(p.runDays, p.longRunDay)]}`);
  if (s) out.push(s.peak > s.from ? `Building from ${s.from} to ${s.peak} mi a week` : `Holding about ${s.peak} mi a week`);
  if (s?.taperWeeks) out.push(`Easing off for ${s.taperWeeks} ${s.taperWeeks === 1 ? 'week' : 'weeks'} before the race`);
  out.push(`Fitting runs between ${hm(wake)} and ${hm(leave)}`);
  if (habits) out.push(`Adding ${habits} ${habits === 1 ? 'habit' : 'habits'} to Today`);
  return out;
};
