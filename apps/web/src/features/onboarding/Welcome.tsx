import { fmtDate, mondayOf, shiftDays, today as todayISO, weekdayOf, type Goal, type ISODate, type Weekday } from '@logbook/shared';
import { Check, ChevronLeft, Clock } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { FirstRunHero, type FirstRunAction } from '@/features/day/FirstRunHero';
import { useBootstrap, useHabitMutations, useMorningMutations, useOnboard } from '@/api/queries';
import { useNav } from '@/app/NavController';
import type { OnboardingAnswers } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis, POP_COMMIT_FRAC, POP_COMMIT_V } from '@/lib/gesture';
import { crossfade, fadeIn, springs } from '@/lib/motion';
import { EmptyState, Pressable, useSheet, useToast } from '@/ui';
import { DayLetters, GoalChips, HabitPicker, MilesDial, MorningTrack, RaceStrip } from './controls';
import { DEFAULT_LEAVE, DEFAULT_MILES, STARTER_HABITS, DEFAULT_PROFILE, DEFAULT_WAKE, defaultRaceDay, firstWeek, fixLongRun, goalLong, hm, MILES_MAX, MILES_MIN, previewMorning, ROUTINE_CHIPS, routineFrom, routineNames, routineSettings, routineTotal, snap5, TRACK_FROM, type TrainingProfile } from './model';
import { handOff } from './handoff';
import { StravaPrimer } from './StravaPrimer';
import { releaseVelocity } from './velocity';
import './onboarding.css';

/**
 * First run, /welcome/* (experience §5.8, research §6): about sixty seconds, value before asks.
 *
 *   /start            the promise (features/auth/Start.tsx): it comes before the account now (critic B7), so
 *   /welcome          goes straight to the first question
 *   /welcome/goal     what are you training for (chips, a race-day wheel)          not skippable, no way back
 *   /welcome/days     which days (tap letters, hold for the long run) and weekly miles
 *   /welcome/morning  when you wake and leave (two markers on a timeline), what you do before you leave (chips),
 *                     and when it is tight, a one-tap earlier alarm
 *   /welcome/habits   starter habits (chips that become orbs)
 *   /welcome/ready    the payoff: POST /me/onboarding, the first week, "Tomorrow: Easy 4. Out the door 6:50.", and
 *                     Today's first-run face where Today's hero will be; Open Today hands off to Today in place (§8)
 *
 * Every answer lives in sessionStorage per account, so a reload lands on the same step with the same answers. Back is the
 * chevron, the browser's back, or an edge swipe from the left. An account that has finished (onboardedAt set) never sees
 * this, unless it is in the middle of its own payoff.
 */

type Step = '' | 'goal' | 'days' | 'morning' | 'habits' | 'ready';
const QUESTIONS: Step[] = ['goal', 'days', 'morning', 'habits'];
const ORDER: Step[] = ['', ...QUESTIONS, 'ready'];

interface Draft {
  goal: Goal | null;
  /** undefined: the goal's default day; null: no date yet. */
  raceDate?: ISODate | null;
  runDays: Weekday[];
  longRunDay: Weekday;
  weeklyMiles: number;
  milesTouched: boolean;
  wake: number;
  leave: number;
  habits: string[];
  custom: string[];
  /** The morning step's chips (Shower, Breakfast, Pack bag, Coffee): what happens between the run and the door. */
  routine?: string[];
  /** The answers last sent, and what came back, so a reload on the payoff never sends them twice. */
  sent?: string;
  firstDay?: string | null;
}
const blank = (): Draft => ({ goal: null, runDays: DEFAULT_PROFILE.runDays, longRunDay: DEFAULT_PROFILE.longRunDay, weeklyMiles: DEFAULT_MILES.base, milesTouched: false, wake: DEFAULT_WAKE, leave: DEFAULT_LEAVE, habits: [], custom: [] });

const draftKey = (uid: string) => `logbook.onboarding.${uid}`;
/** Set once the answers are sent: the payoff may finish on an account that is already onboarded. Cleared on the way out. */
export const PAYOFF_KEY = 'logbook.onboarding.payoff';
const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode: the answers last as long as the page */
    }
  },
  del: (k: string) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* nothing to clear */
    }
  },
};
const useDraft = (uid: string) => {
  const [d, setD] = useState<Draft>(() => {
    try {
      const raw = ss.get(draftKey(uid));
      return raw ? { ...blank(), ...(JSON.parse(raw) as Draft) } : blank();
    } catch {
      return blank();
    }
  });
  useEffect(() => ss.set(draftKey(uid), JSON.stringify(d)), [uid, d]);
  return [d, (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }))] as const;
};

/** The block starts tomorrow, so the first week is this week: you leave onboarding looking at a real one. */
const startOf = (t: ISODate) => shiftDays(t, 1);

const profileOf = (d: Draft, start: ISODate): TrainingProfile => {
  const goal = d.goal ?? 'base';
  return { goal, raceDate: goal === 'base' ? null : d.raceDate === undefined ? defaultRaceDay(goal, start) : d.raceDate, runDays: d.runDays, longRunDay: fixLongRun(d.runDays, d.longRunDay), weeklyMiles: d.weeklyMiles };
};

export default function Welcome() {
  const boot = useBootstrap();
  const params = useParams();
  const user = boot.data?.user;
  if (!user) return null;
  // the owner, and anyone already through, goes straight to Today, unless this is the end of their own first run
  const ending = /^ready/.test(params['*'] ?? '') && !!ss.get(PAYOFF_KEY);
  if (user.onboardedAt && !ending) return <Navigate to="/today" replace />;
  return <Flow uid={user.id} />;
}

/** "Add habits" on the payoff's face, after the hand-off: the starters the questions did not pick, as one-tap adds (Today's own first-run sheet). */
const AddHabitsSheet = () => {
  const { add } = useHabitMutations();
  const boot = useBootstrap();
  const sheet = useSheet();
  const have = new Set((boot.data?.habits ?? []).filter((h) => !h.archivedOn).map((h) => h.name.toLowerCase()));
  return (
    <EmptyState starters={STARTER_HABITS.filter((n) => !have.has(n.toLowerCase()))} onStarter={(name) => add.mutateAsync(name)} verb={{ label: 'Done', onPress: () => sheet.close() }} startersLabel="Starter habits">
      Tap the ones you want to do every day. They become lights on Today.
    </EmptyState>
  );
};

function Flow({ uid }: { uid: string }) {
  const nav = useNavigate();
  const framed = useNav();
  const toast = useToast();
  const boot = useBootstrap();
  const params = useParams();
  const reduce = useReducedMotion();
  const step = ((params['*'] ?? '').split('/')[0] ?? '') as Step;
  const [d, set] = useDraft(uid);
  const sheet = useSheet();
  const screenRef = useRef<HTMLElement>(null);
  const t = useMemo(() => todayISO(), []);
  const start = startOf(t);
  const profile = profileOf(d, start);

  // direction of travel, for the slide: forward from the right, back from the left
  const prevIdx = useRef(ORDER.indexOf(step));
  const idx = ORDER.indexOf(step);
  const dir = idx >= prevIdx.current ? 1 : -1;
  useEffect(() => {
    prevIdx.current = idx;
  }, [idx]);

  const go = (s: Step, replace = false) => nav(s ? `/welcome/${s}` : '/welcome', { replace });
  const back = () => {
    const i = ORDER.indexOf(step);
    if (i <= ORDER.indexOf('goal') || step === 'ready') return;
    go(ORDER[i - 1]!, true);
  };

  // the edge swipe (§1.4, §9.3's numbers): a pointer that goes down within 24 px of the left edge and locks horizontally
  // drags the step 1:1, like a pushed page (review feel F3): the step being left becomes an opaque page carrying its own
  // copy of the halo, and the step before it is drawn under it at −30 % (−0.3 × (W − x)) under a scrim that lifts as it
  // comes. Past 35 % of the width or a 300 px/s release, the step slides off on `page` (`pageFlick` for a flick) with the
  // release velocity, and the route goes back once it has gone: the step under it is already where it belongs, so the
  // swap shows nothing (no enter or exit animation, no frame of either step twice). Short of it, it springs home.
  // Pointer events on the screen itself (`touch-action: pan-y`), never a touchmove listener on the document (§12).
  const x = useMotionValue(0);
  const wRef = useRef(390);
  const underX = useTransform(x, (v) => -0.3 * (wRef.current - v));
  const scrimO = useTransform(x, (v) => 0.3 * (1 - v / wRef.current));
  const [under, setUnder] = useState<Step | null>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const underBox = useRef({ top: 0, h: 0, vTop: 0 });
  // the route changed under a committed edge swipe: the new step shows at rest, without its entrance
  const swapping = useRef(false);
  const canBack = idx > ORDER.indexOf('goal') && step !== 'ready';
  const edge = useRef<null | { id: number; x0: number; y0: number; lock: 'x' | null; samples: Array<[number, number]> }>(null);
  const onEdgeDown = (e: React.PointerEvent<HTMLElement>) => {
    edge.current = e.isPrimary && canBack && !swapping.current && e.clientX <= EDGE_PX && !document.querySelector('.sheet-wrap, .cm-layer') ? { id: e.pointerId, x0: e.clientX, y0: e.clientY, lock: null, samples: [[e.clientX, e.timeStamp]] } : null;
  };
  const onEdgeMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = edge.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.lock) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      if (lockAxis(dx, dy) !== 'x' || dx < 0) {
        edge.current = null;
        return;
      }
      g.lock = 'x';
      e.currentTarget.setPointerCapture(e.pointerId);
      wRef.current = e.currentTarget.clientWidth || window.innerWidth;
      const sw = swipeRef.current;
      underBox.current = { top: sw?.offsetTop ?? 0, h: sw?.offsetHeight ?? 0, vTop: sw?.getBoundingClientRect().top ?? 0 };
      x.stop();
      setUnder(ORDER[idx - 1] ?? null);
    }
    x.set(Math.max(0, dx));
    g.samples.push([e.clientX, e.timeStamp]);
    if (g.samples.length > 8) g.samples.shift();
  };
  const onEdgeUp = (e: React.PointerEvent<HTMLElement>) => {
    const g = edge.current;
    edge.current = null;
    if (!g || e.pointerId !== g.id || !g.lock) return;
    // the release velocity (review 2 code N3): only the moves of the last 150 ms before the release count, by the events'
    // own timestamps (not when a busy main thread got to them), and a finger that has been still for 80 ms has none, so a
    // drag that stopped is not a flick; a system cancel is velocity 0 and never commits (as PushedLayer and SwipeRow treat it)
    const cancelled = e.type === 'pointercancel';
    const v = cancelled ? 0 : releaseVelocity(g.samples, e.timeStamp);
    const commit = !cancelled && (x.get() > wRef.current * POP_COMMIT_FRAC || v > POP_COMMIT_V);
    if (reduce) {
      // reduced motion: tracking stayed 1:1; the change itself is the step's 150 ms fade
      x.jump(0);
      setUnder(null);
      if (commit) back();
      return;
    }
    const spring = Math.abs(v) >= FLICK_V ? springs.pageFlick : springs.page;
    if (commit)
      animate(x, wRef.current, {
        ...spring,
        velocity: Math.max(0, v),
        onComplete: () => {
          swapping.current = true;
          back();
        },
      });
    else animate(x, 0, { ...spring, velocity: v, onComplete: () => setUnder(null) });
  };
  // the swap: the step that was under is now the step; the dragged one (gone off screen) and the layer under it go on the
  // same frame, before paint
  useLayoutEffect(() => {
    if (!swapping.current) return;
    swapping.current = false;
    const sw = swipeRef.current;
    if (sw) {
      for (const el of sw.querySelectorAll<HTMLElement>(':scope > .ob-stage')) if (el.dataset.step !== step) el.style.visibility = 'hidden';
      sw.style.transform = 'none';
    }
    x.jump(0);
    setUnder(null);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // guards: questions need the promise first only in spirit; later steps need a goal
  if (!ORDER.includes(step) || step === '') return <Navigate to="/welcome/goal" replace />;
  if (idx > ORDER.indexOf('goal') && !d.goal) return <Navigate to="/welcome/goal" replace />;

  const qIndex = QUESTIONS.indexOf(step);
  const next = () => go(ORDER[idx + 1]!);

  const bodyFor = (step: Step): React.ReactNode => {
  let body: React.ReactNode;
  switch (step) {
    case 'goal':
      body = (
        <Question title="What are you training for?" sub="Pick one. A race gets a taper; just running gets a steady build." onNext={next} nextDisabled={!d.goal}>
          <GoalChips
            value={d.goal}
            onChange={(g) => set({ goal: g, raceDate: undefined, weeklyMiles: d.milesTouched ? d.weeklyMiles : DEFAULT_MILES[g] })}
          />
          <AnimatePresence initial={false}>
            {d.goal && d.goal !== 'base' ? (
              <motion.div key="race" className="ob-race-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
                <p className="ob-q-label">
                  Race day <span className="ob-q-value">{profile.raceDate ? fmtDate('short', profile.raceDate) : 'Not set'}</span>
                </p>
                <RaceStrip start={start} value={profile.raceDate} onChange={(r) => set({ raceDate: r })} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Question>
      );
      break;
    case 'days':
      body = (
        <Question title="Which days can you run?" sub="Tap a day to run it. Hold one to make it the long run." onNext={next}>
          <DayLetters runDays={d.runDays} longRunDay={fixLongRun(d.runDays, d.longRunDay)} onChange={(runDays, longRunDay) => set({ runDays, longRunDay })} />
          <p className="ob-q-label ob-miles-label">About how much do you run now?</p>
          <MilesDial value={d.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => set({ weeklyMiles: v, milesTouched: true })} />
          <p className="ob-hint">
            {d.runDays.length} {d.runDays.length === 1 ? 'run' : 'runs'} a week. {d.goal && d.goal !== 'base' ? `Your ${goalLong(d.goal)} plan` : 'Your plan'} builds from {d.weeklyMiles} mi, about 10% a week.
          </p>
        </Question>
      );
      break;
    case 'morning': {
      const chips = d.routine ?? [];
      const st = routineSettings(chips);
      const pv = previewMorning(d.wake, d.leave, undefined, st);
      // tight: the alarm that fits (5-minute steps), or, before 4:00, a later leave
      const earlier = pv.late > 0 ? Math.floor((d.wake - pv.late) / 5) * 5 : null;
      const fix = earlier == null ? null : earlier >= TRACK_FROM ? { wake: earlier, leave: d.leave, text: `Wake ${hm(earlier)}?` } : { wake: d.wake, leave: snap5(d.leave + pv.late + 2), text: `Leave ${hm(snap5(d.leave + pv.late + 2))}?` };
      body = (
        <Question title="When do you wake, and leave for work?" sub="Drag the two markers. Logbook plans the run in between." onNext={next}>
          <MorningTrack wake={d.wake} leave={d.leave} settings={st} onChange={(wake, leave) => set({ wake, leave })} />
          <p className="ob-q-label ob-routine-label">
            Before you leave <span className="ob-q-value">{routineTotal(routineFrom(chips))} min</span>
          </p>
          <div className="ob-chips ob-routine" role="group" aria-label="Before you leave">
            {ROUTINE_CHIPS.map((c) => {
              const on = chips.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  className={`ob-chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  label={`${c.label}, ${c.mins} minutes`}
                  onPress={() => {
                    haptics.select();
                    set({ routine: on ? chips.filter((x) => x !== c.id) : [...chips, c.id] });
                  }}
                >
                  {on ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : null}
                  {c.label}
                </Pressable>
              );
            })}
          </div>
          <div className="ob-verdict" aria-live="polite">
            <p className="ob-verdict-big display">Out the door {hm(pv.door)}.</p>
            <p className="ob-verdict-sub">{pv.late > 0 ? `Tight: an easy 4 runs ${pv.late} min into getting ready.` : `An easy 4 has you back by ${hm(pv.back)}${pv.spare >= 5 ? `, with ${pv.spare} min to spare` : ''}.`}</p>
            <AnimatePresence initial={false}>
              {fix ? (
                <motion.div key="fix" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={reduce ? fadeIn : springs.settle}>
                  <Pressable
                    className="ob-chip ob-fix"
                    onPress={() => {
                      haptics.select();
                      set({ wake: fix.wake, leave: fix.leave });
                    }}
                  >
                    <Clock size={16} strokeWidth={2.4} aria-hidden="true" />
                    {fix.text}
                  </Pressable>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Question>
      );
      break;
    }
    case 'habits':
      body = (
        <Question title="A few lights for every day." sub="Pick any. They become the orbs you tap on Today." onNext={next} nextLabel="Build my week">
          <HabitPicker selected={d.habits} custom={d.custom} onChange={(habits, custom) => set({ habits, custom })} />
        </Question>
      );
      break;
    case 'ready':
      body = <Payoff draft={d} set={set} profile={profile} start={start} today={t} onOpen={openToday} />;
      break;
  }
  return body;
  };
  const body = bodyFor(step);
  const skip = swapping.current;

  function clearAll() {
    ss.del(draftKey(uid));
    ss.del(PAYOFF_KEY);
  }
  /**
   * A row of the payoff's face, once Today is up (review code F2, F7): each does what it says, the way Today's own first-run
   * face does. Add habits: the starters sheet. Plan a week: the week just written, in Plan (a jump). Connect Strava: the
   * primer, only on a server that can connect it and an account that has not (else an error says why, in place of a page
   * of raw JSON from /api/strava/connect).
   */
  function afterHandOff(then: FirstRunAction) {
    if (then === 'habits') sheet.open({ title: 'Add habits', body: <AddHabitsSheet /> });
    else if (then === 'plan') framed.go(`/plan/week/${mondayOf(start)}`);
    else {
      const b = boot.data;
      if (b?.features.strava && !b.strava.connected) sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });
      else if (!b?.features.strava) toast('Strava isn’t set up on this server yet.');
    }
  }
  /** The hand-off (§8): Today mounts under a still copy of this screen, the week falls away, Today's chrome fades in. */
  function openToday(then?: FirstRunAction) {
    const cut = () => {
      clearAll();
      nav('/today', { replace: true });
    };
    const screen = screenRef.current;
    if (!screen) return cut();
    handOff({
      screen,
      falls: '.ob-week, .ob-pay-foot',
      fades: '.ob-pay-head, .ob-halo',
      reduce: !!reduce,
      cut,
      after: then ? () => afterHandOff(then) : undefined,
    });
  }

  return (
    <main className="ob" ref={screenRef} onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeUp} onPointerCancel={onEdgeUp}>
      <span className={`ob-halo ${step === 'ready' ? 'bloom' : ''}`} aria-hidden="true" />
      {qIndex >= 0 ? (
        <header className="ob-top">
          {/* the chevron and Skip stay in place and fade with the dots when a step has none (review 2 feel N11), never a
              one-frame cut; hidden, they are inert (out of the tab order, the accessibility tree and hit-testing) */}
          <button type="button" className={`icon-btn ob-back ${canBack ? '' : 'is-gone'}`} aria-label="Back" onClick={canBack ? back : undefined} inert={!canBack}>
            <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <div className="ob-dots" role="progressbar" aria-label="Setup" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={qIndex + 1} aria-valuetext={`Step ${qIndex + 1} of ${QUESTIONS.length}`}>
            {QUESTIONS.map((q, i) => (
              <span key={q} className={`ob-dot ${i === qIndex ? 'on' : i < qIndex ? 'done' : ''}`} />
            ))}
          </div>
          <Pressable className={`ob-skip ${step !== 'goal' ? '' : 'is-gone'}`} press="dim" inert={step === 'goal'} onPress={step !== 'goal' ? next : () => undefined}>
            Skip
          </Pressable>
        </header>
      ) : null}
      {under ? (
        <motion.div className="ob-under" style={{ x: underX, top: underBox.current.top, height: underBox.current.h }} aria-hidden="true">
          <div className="ob-stage">{bodyFor(under)}</div>
          <motion.span className="ob-under-scrim" style={{ opacity: scrimO }} />
        </motion.div>
      ) : null}
      <motion.div ref={swipeRef} className={`ob-swipe ${under ? 'is-edge' : ''}`} style={{ x }}>
      {under ? <span className="ob-halo ob-halo-copy" aria-hidden="true" style={{ top: -underBox.current.vTop, height: window.innerHeight }} /> : null}
      <AnimatePresence mode="popLayout" initial={false} custom={{ dir, skip }}>
        <motion.div
          key={step}
          className="ob-stage"
          data-step={step}
          custom={{ dir, skip }}
          variants={stageVariants(!!reduce)}
          initial={skip ? false : 'enter'}
          animate="center"
          exit="exit"
          transition={reduce ? { duration: 0.15 } : { ...springs.page, opacity: { duration: 0.12 } }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
      </motion.div>
    </main>
  );
}

/** A step comes in from the side it is ahead or behind; after a committed edge swipe (`skip`) it neither enters nor exits. */
const stageVariants = (reduce: boolean) => ({
  enter: ({ dir }: { dir: number; skip: boolean }) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: ({ dir, skip }: { dir: number; skip: boolean }) =>
    skip ? { opacity: 0, transition: { duration: 0 } } : reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: dir * -48, transition: { ...springs.page, opacity: { duration: 0.1 } } },
});

// ---------- a question ----------
function Question({ title, sub, children, onNext, nextDisabled, nextLabel = 'Next' }: { title: string; sub: string; children: React.ReactNode; onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="ob-step ob-question">
      <h1 className="ob-title display">{title}</h1>
      <p className="ob-sub">{sub}</p>
      <div className="ob-body">{children}</div>
      <div className="ob-foot">
        <Pressable className="btn primary block ob-cta" disabled={nextDisabled} onPress={onNext}>
          {nextLabel}
        </Pressable>
      </div>
    </div>
  );
}

// ---------- the payoff ----------
/**
 * The payoff (§8): the first week, written into the plan, under the headline; the hero is Today's first-run face
 * (`FirstRunHero`, WP2) at the resting y of Today's hero slot (157 + safe-t at 390 × 844, contracts §A.5). `Open Today` (or a
 * row of the face) is the hand-off: the week rows fall away and Today's chrome fades in around a hero that stays put
 * (`handoff.ts`), with no route cut and no leave animation.
 */
function Payoff({ draft, set, profile, start, today, onOpen }: { draft: Draft; set: (p: Partial<Draft>) => void; profile: TrainingProfile; start: ISODate; today: ISODate; onOpen: (then?: FirstRunAction) => void }) {
  const reduce = useReducedMotion();
  const onboard = useOnboard();
  const [waiting, setWaiting] = useState<{ then?: FirstRunAction } | null>(null);
  const week = useMemo(() => firstWeek(profile, start, today, draft.wake, draft.leave, routineSettings(draft.routine ?? [])), [profile, start, today, draft.wake, draft.leave, draft.routine]);

  const routine = routineFrom(draft.routine ?? []);
  const morning = useMorningMutations();
  const answers: OnboardingAnswers = {
    routine,
    goal: profile.goal,
    raceDate: profile.raceDate,
    runDays: profile.runDays,
    longRunDay: profile.longRunDay,
    weeklyMiles: profile.weeklyMiles,
    wake: draft.wake,
    leave: draft.leave,
    habits: draft.habits,
    start: 'tomorrow',
    today,
  };
  const key = JSON.stringify(answers);
  const saved = draft.sent === key;
  const send = () => {
    ss.set(PAYOFF_KEY, '1');
    onboard.mutate(answers, {
      onSuccess: (r) => {
        // the routine the chips made (the server takes wake and leave; the blocks between are the morning's own setting)
        morning.settings.mutate({ after: { ...routine, names: routineNames(draft.routine ?? []), showerMode: 'fixed', showerAt: Math.max(draft.wake, draft.leave - routineTotal(routine)) } });
        // the answers are on the account now (POST /me/onboarding stores them as the training profile)
        set({ sent: key, firstDay: r.firstDay });
      },
      onError: () => haptics.error(),
    });
  };
  useEffect(() => {
    if (!saved && !onboard.isPending) send();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = saved || onboard.isSuccess;
  const open = (then?: FirstRunAction) => {
    if (!done) return setWaiting({ then });
    onOpen(then);
  };
  // pressed while the plan was still being written: go as soon as it lands
  useEffect(() => {
    if (waiting && done) {
      const w = waiting;
      setWaiting(null);
      onOpen(w.then);
    }
  }, [waiting, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = week.first;
  const m = week.morning;
  const fade = reduce ? { duration: 0.15 } : { ...springs.page };
  return (
    <div className="ob-step ob-payoff">
      <header className="ob-pay-head">
        <motion.span className="caps ob-pay-eyebrow" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fadeIn}>
          {week.template ? week.template.name : 'Your first week'}
        </motion.span>
        <motion.h1 className="ob-pay-title display" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fade : { ...fade, delay: 0.08 }}>
          {first ? `${week.firstWhen}: ${week.days.find((x) => x.session === first)?.label ?? 'Easy'}.` : 'Your week is ready.'}
        </motion.h1>
        {m ? (
          <motion.p className="ob-pay-door display" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...fadeIn, delay: reduce ? 0 : 0.16 }}>
            Out the door {hm(m.door)}.
          </motion.p>
        ) : null}
      </header>

      {/* Today's first-run face, where Today's hero will be: it does not move on the way in */}
      <div className="ob-pay-hero">
        <FirstRunHero onAction={(k) => open(k)} />
      </div>

      <motion.ol className="ob-week" aria-label="Your first week" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fade : { ...fade, delay: 0.24 }}>
        {week.days.map((day) => {
          const s = day.session;
          const bar = s ? Math.max(0.12, Math.min(1, (s.miles ?? 0) / Math.max(1, ...week.days.map((x) => x.session?.miles ?? 0)))) : 0;
          const long = !!s && (/long/i.test(s.type) || weekdayOf(day.date) === profile.longRunDay);
          return (
            <li key={day.date} className={`ob-wrow ${s ? `t-${day.tone}` : 'rest'} ${long ? 'is-long' : ''}`}>
              <span className="ob-wday">
                <span className="caps">{fmtDate('dow', day.date)}</span>
                <span className="ob-wdate">{Number(day.date.slice(8))}</span>
              </span>
              <span className="ob-wtone" aria-hidden="true" />
              <span className="ob-wname">
                {s ? <span className="stamp">{day.label}</span> : <span className="ob-wrest">Rest</span>}
                {long && !/^long/i.test(day.label) ? <span className="caps ob-wlong">Long</span> : null}
              </span>
              {s ? (
                <span className="ob-wbar" aria-hidden="true">
                  <motion.span className="ob-wbar-fill" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: bar }} transition={reduce ? { duration: 0 } : { ...springs.number, delay: 0.4 }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </motion.ol>

      <div className="ob-pay-foot">
        <p className="ob-pay-sum" aria-live="polite">
          {onboard.isError ? (
            <span className="ob-err">Couldn’t save your plan. Check your connection and try again.</span>
          ) : done ? (
            <>
              <Check size={16} strokeWidth={2.6} aria-hidden="true" className="ob-ok" />
              {week.miles} mi over {week.runs} {week.runs === 1 ? 'run' : 'runs'} in your first seven days. Saved to your plan.
            </>
          ) : (
            `${week.miles} mi over ${week.runs} ${week.runs === 1 ? 'run' : 'runs'} in your first seven days. Writing it into your plan…`
          )}
        </p>
        {onboard.isError ? (
          <Pressable className="btn primary block ob-cta" onPress={send}>
            Try again
          </Pressable>
        ) : (
          <Pressable className="btn primary block ob-cta" onPress={() => open()} disabled={!!waiting}>
            {waiting ? 'One moment…' : 'Open Today'}
          </Pressable>
        )}
      </div>
    </div>
  );
}
