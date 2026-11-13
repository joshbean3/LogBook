import { addKeepsakes, adoptSet, baselineOf, challengeSlots, daysBetween, eachDay, emptyRewards, keepsakesDue, mayOffer, mondayOf, monthOf, monthsBetween, offerChallenge, offerInto, orbsOn, parseRewards, rebuild, reconcile, RULES, settleChallenges, shiftDays, slotOf, toISO, totalOf, type ChallengeFacts, type Gained, type ISODate, type Rewards } from '@logbook/shared';
import type { QueryClient } from '@tanstack/react-query';
import { fetchGoals, fetchMonth, fetchTodos, keys } from '@/api/queries';
import type { Bootstrap } from '@/api/types';
import { fetchLearnings, learnedKeys } from '@/features/learned/queries';
import { isLeaving, isOtherAccount } from '@/lib/account';
import { fitnessOn, PREFS_EVENT } from '@/lib/prefs';
import { subscribeToday } from '@/lib/useToday';
import { orbsStart } from './devStart';
import { challengeFacts, dayFacts, factsReady, habitDaysIn, linesOf, readCaches, type Caches } from './dayFacts';
import { getIntake, onIntake, serverDayNow } from './intake';
import { getOrbs, getSwitches, onOrbsChange, openOrbs, ORBS_EVENT, orbsOwner, setOrbs, type OrbsGained } from './store';
import { startOrbsSync } from './sync';

/**
 * The reconciler, on this phone. After any change to the caches a day's facts are read from (the to-dos, the months, the
 * goals, the journal's lines, the bootstrap's habits and status), once per frame, it reads the two days that can still
 * change (today and yesterday), hands their facts to the shared `reconcile`, and keeps what comes back. Days close, weeks
 * are sealed and paid their bonus, goals and the comeback are paid, keepsakes are added, challenges are offered and
 * settled: all of it here, none of it in a tap or a mutation, so a write that is refused, a row that is renamed and a run
 * that arrives by itself are all just facts that changed.
 *
 * What was gained is published on `window` as `logbook:orbs-gained` (`OrbsGained`). Nothing is drawn here.
 *
 * A device with no store for the account (first run, after Sign out, after the error screen's Reset, a reinstall) takes
 * the account's copy when the server keeps one, and otherwise rebuilds from the account's own facts from
 * `max(RULES.startsOn, onboardedAt)` (`rebuild`: base Orbs only, every day closed).
 */

/**
 * The first reconcile after a store is opened, taken from the server or rebuilt says nothing about the days: what it finds
 * in the caches was not earned just now (the saved copy being read, a habit checked on another phone). What is paid once,
 * at this moment (a weekly bonus, a goal, a challenge), is always said.
 */
let quiet = true;
const paidOnce = (key: string) => key.startsWith('week:') || key.startsWith('challenge:') || key.startsWith('goal:week:') || key.startsWith('goal:month:') || key.startsWith('goal:year:');
let lastSig: readonly unknown[] | null = null;
let lastStore: Rewards | null = null;
let lastDay: ISODate | '' = '';
let lastEarly: boolean | null = null;
let beginning = false;
let lastBegin = -Infinity;

const sameSig = (a: readonly unknown[], b: readonly unknown[] | null) => !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const localDay = (iso: string | null | undefined): ISODate | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
};
/** Every month the open days, this week and the last four (the challenges' baseline) touch. */
const monthsFor = (today: ISODate): string[] => monthsBetween(shiftDays(mondayOf(today), -28), shiftDays(mondayOf(today), 6));

const publish = (gained: Gained[], store: Rewards, today: ISODate) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  const detail: OrbsGained = { gained, total: totalOf(store), today: orbsOn(store, today) };
  window.dispatchEvent(new CustomEvent(ORBS_EVENT, { detail }));
};

/**
 * Days with every habit done in each of the last four finished weeks, oldest first: the one part of a challenge's baseline
 * the store does not hold. Read from the months once a day (28 days of facts), not on every pass.
 */
let pastMemo: { key: string; value: number[] } | null = null;
const pastHabitDays = (c: Caches, uid: string, today: ISODate): number[] => {
  const key = `${uid}:${today}:${c.fitness}`;
  if (pastMemo?.key !== key) {
    const monday = mondayOf(today);
    pastMemo = { key, value: [4, 3, 2, 1].map((w) => habitDaysIn(c, shiftDays(monday, -7 * w), shiftDays(monday, -7 * w + 6))) };
  }
  return pastMemo.value;
};

/** Offer this week's challenges that are due and not yet in the store, and settle the added ones against the facts. */
const challenges = (c: Caches, store: Rewards, uid: string, now: Date): { store: Rewards; gained: Gained[] } => {
  const today = toISO(now);
  const monday = mondayOf(today);
  let s = store;
  const covered = monthsBetween(shiftDays(monday, -28), today).every((m) => c.months[m]);
  if (covered && factsReady(c, today)) {
    for (const slot of challengeSlots(uid, today, s.set.cadence)) {
      const due = slot.kind === 'day' ? slot.date === today : daysBetween(monday, today) <= 2;
      if (!due || !mayOffer(s, slot, today)) continue;
      const offer = offerChallenge(slot, baselineOf(s, today, pastHabitDays(c, uid, today)), challengeFacts(c, s, slot, today), s.set.size);
      if (offer) s = offerInto(s, slot, offer, now);
    }
  }
  // the added ones that can still finish: today's, yesterday's until 03:00, this week's, and last week's for its floor
  const facts: Record<string, ChallengeFacts> = {};
  const yesterday = shiftDays(today, -1);
  for (const key in s.challenges) {
    if (s.challenges[key]!.state !== 'added') continue;
    const slot = slotOf(uid, key);
    const live = slot.kind === 'day' ? slot.date === today || (slot.date === yesterday && now.getHours() < RULES.close.tapHour) : slot.date === monday || slot.date === shiftDays(monday, -7);
    if (live && factsReady(c, slot.kind === 'day' ? slot.date : today)) facts[key] = challengeFacts(c, s, slot, today);
  }
  const settled = settleChallenges(s, facts, now);
  return settled;
};

/**
 * One reconcile, now (`now` is passed only by tests). Returns what was gained and published (a quiet first pass says only what was paid once). Cheap when nothing a
 * day's facts are read from has changed: the identities of the caches are compared first and nothing else runs.
 */
export const reconcileNow = (qc: QueryClient, now: Date = new Date()): Gained[] => {
  const boot = qc.getQueryData<Bootstrap>(keys.bootstrap);
  const uid = boot?.user.id;
  if (!boot || !uid || isLeaving() || isOtherAccount(uid)) return [];
  if (orbsOwner() !== uid) {
    openOrbs(uid);
    quiet = true;
    lastSig = null;
  }
  const s = getOrbs();
  if (!s) {
    void begin(qc, uid, boot);
    return [];
  }
  const today = toISO(now);
  const early = now.getHours() < RULES.close.tapHour;
  const fitness = fitnessOn();
  const c = readCaches(qc, fitness, monthsFor(today));
  if (!c) return [];
  if (s === lastStore && today === lastDay && early === lastEarly && sameSig(c.sig, lastSig)) return [];
  const yesterday = shiftDays(today, -1);
  const facts = [yesterday, today].filter((d) => factsReady(c, d)).map((d) => dayFacts(c, d, today));
  const r = reconcile(s, facts, now, { fitness, serverDay: serverDayNow(), goals: c.goals ?? undefined, startsOn: orbsStart() });
  let next = r.store;
  const gained = r.gained;
  if (next.set.on) {
    const ch = challenges(c, next, uid, now);
    next = ch.store;
    gained.push(...ch.gained);
  }
  if (next !== s || today !== lastDay) next = addKeepsakes(next, keepsakesDue(next, now, { goals: c.goals ?? [], lines: linesOf(c) }));
  lastSig = c.sig;
  lastDay = today;
  lastEarly = early;
  if (next !== s) setOrbs(next);
  lastStore = getOrbs();
  const said = quiet ? gained.filter((x) => paidOnce(x.key)) : gained;
  if (said.length) publish(said, next, today);
  // quiet until today's facts have been read once
  if (factsReady(c, today)) quiet = false;
  return said;
};

const install = (s: Rewards) => {
  quiet = true;
  lastSig = null;
  setOrbs(adoptSet(s, getSwitches(), new Date()));
};
/**
 * This device has no store for the account. Wait for this session's first bootstrap from the network (it says whether the
 * server keeps a copy); take that copy when there is one; otherwise rebuild from the account's own facts.
 */
const begin = async (qc: QueryClient, uid: string, boot: Bootstrap) => {
  const intake = getIntake();
  if (beginning || !intake) return;
  beginning = true;
  try {
    const kept = intake.has ? parseRewards(intake.rewards, uid) : null;
    if (kept) return install(kept);
    const today = toISO(new Date());
    const born = localDay(boot.user.onboardedAt) ?? today;
    const floor = orbsStart();
    const from = born > floor ? born : floor;
    if (from >= today) return install(emptyRewards(uid, from, getSwitches(), floor));
    // at most one try in 30 s: offline, the months cannot be read and the next change to a cache asks again
    const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (t - lastBegin < 30_000) return;
    lastBegin = t;
    const months = monthsBetween(from, today);
    const fresh = 5 * 60_000;
    await Promise.all([
      ...months.map((m) => qc.fetchQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: fresh })),
      qc.fetchQuery({ queryKey: keys.todos, queryFn: fetchTodos, staleTime: fresh }),
      qc.fetchQuery({ queryKey: ['goals'], queryFn: fetchGoals, staleTime: fresh }),
      ...months.map((m) => qc.fetchInfiniteQuery({ queryKey: learnedKeys.list({ month: m }), queryFn: ({ pageParam }) => fetchLearnings({ month: m }, pageParam), initialPageParam: null as string | null, staleTime: fresh })),
    ]);
    if (orbsOwner() !== uid || getOrbs() || isLeaving()) return;
    const c = readCaches(qc, fitnessOn(), months);
    if (!c) return;
    const facts = eachDay(from, shiftDays(today, -1)).filter((d) => factsReady(c, d)).map((d) => dayFacts(c, d, d));
    install(rebuild(facts, from, today, uid, getSwitches(), floor));
  } catch {
    /* offline, or a read was refused: no store yet, and nothing is said. Tried again later. */
  } finally {
    beginning = false;
  }
};

const WATCHED = new Set(['todos', 'month', 'goals', 'learnings', 'bootstrap']);
/**
 * Start the reconciler for this page: it listens to the caches and runs once per frame after a change. Returns a function
 * that stops it. Mounted once, by `useReconcile` in the shell.
 */
export const startOrbs = (qc: QueryClient): (() => void) => {
  let pending = false;
  let stopped = false;
  const frame: (cb: () => void) => void = typeof requestAnimationFrame === 'function' ? (cb) => void requestAnimationFrame(cb) : (cb) => void setTimeout(cb, 16);
  const schedule = () => {
    if (pending || stopped) return;
    pending = true;
    frame(() => {
      pending = false;
      if (!stopped) reconcileNow(qc);
    });
  };
  startOrbsSync();
  const offs: Array<() => void> = [
    qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' ? e.action.type !== 'success' : e.type !== 'added' && e.type !== 'removed') return;
      if (WATCHED.has(String(e.query.queryKey[0]))) schedule();
    }),
    onOrbsChange(schedule),
    onIntake(schedule),
    subscribeToday(schedule),
  ];
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener(PREFS_EVENT, schedule);
    offs.push(() => window.removeEventListener(PREFS_EVENT, schedule));
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    const seen = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener('visibilitychange', seen);
    offs.push(() => document.removeEventListener('visibilitychange', seen));
  }
  schedule();
  return () => {
    stopped = true;
    for (const off of offs) off();
  };
};

/** Tests only: a clean slate. */
export const resetOrbsEngineForTest = () => {
  quiet = true;
  lastSig = null;
  lastStore = null;
  lastDay = '';
  lastEarly = null;
  beginning = false;
  lastBegin = -Infinity;
  pastMemo = null;
};
