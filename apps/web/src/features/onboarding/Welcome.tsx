import { fmtDate, mondayOf, shiftDays, today as todayISO, weekdayOf, type Goal, type ISODate, type Weekday } from '@logbook/shared';
import { Check, ChevronLeft, ChevronRight, Clock, TriangleAlert } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { useBootstrap, useMorningMutations, useSetName } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { STRAVA_BUILT } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis } from '@/lib/gesture';
import { crossfade, fadeIn, springs } from '@/lib/motion';
import { Pressable, useSheet } from '@/ui';
import { DayLetters, GoalChips, HabitPicker, MilesDial, MorningTrack, RaceStrip } from './controls';
import { AFTER_WORK_LEAD, afternoonLine, blockShape, buildSteps, HABIT_LIMIT, morningFix, raceWarning, DEFAULT_LEAVE, DEFAULT_MILES, DEFAULT_PROFILE, DEFAULT_WAKE, defaultRaceDay, firstWeek, blockLine, fixLongRun, goalLong, hm, MILES_MAX, MILES_MIN, previewMorning, ROUTINE_CHIPS, routineFrom, routineNames, routineSettings, routineTotal, safeTemplate, verdictLine, type TrainingProfile } from './model';
import { BlockPreview, BuildBeat, NudgeChoice, SetupBar } from './beats';
import { endReplay, isReplaying } from './replay';
import { useSaveOnboarding, type OnboardingPost } from './save';
import { nudgeNext, questionsFor, type Step } from './steps';
import { DEFAULT_AFTERNOON, setAfternoon, setTrainWhenDefault } from '@/features/day/trainWhen';
import { Stepper } from '@/ui/primitives';
import { BrandIcon, FitnessIcon, HabitIcon, PlanIcon, RunIcon, TodayIcon } from '@/ui/icons';
import { setFitness } from '@/lib/prefs';
import { Tour } from './tour/Tour';
import { enableReminders, remindersSupported } from '@/features/goals/reminders';
import { useToast } from '@/ui';
import { handOff } from './handoff';
import { commitsBack, releaseVelocity } from './velocity';
import './onboarding.css';
import './beats.css';

/**
 * First run, /welcome/* (experience §5.8, research §6): about sixty seconds, value before asks.
 *
 *   /start            the promise (features/auth/Start.tsx): it comes before the account now (critic B7), so
 *   /welcome          goes straight to the first question
 *   /welcome/name     what to call you (one field, skippable): the profile's name, the coach's greeting
 *   /welcome/goal     what are you training for (chips, a race-day wheel)          not skippable
 *   /welcome/days     which days (tap letters, hold for the long run) and weekly miles
 *   /welcome/morning  when you wake and leave (two markers on a timeline), what you do before you leave (chips),
 *                     and when it is tight, a one-tap earlier alarm
 *   /welcome/habits   starter habits (chips that become orbs)
 *   /welcome/nudge    on the phone only: one nudge a morning, previewed as the notification itself, chosen before iOS asks
 *   /welcome/tour     how Logbook works: a page per part (to-dos, habits, goals, journal, learned, plan, progress, the ask
 *                     bar), each with a short looping demo of the real gestures (tour/)
 *   /welcome/ready    the plan being written, one real step a beat (BuildBeat), then the payoff: POST /me/onboarding, the first week, "Tomorrow: Easy 4. Out the door 6:50.", and
 *                     Today's first-run face where Today's hero will be; Open Today hands off to Today in place (§8)
 *
 * Onboarding v2 (docs/onboarding-research.md): a segmented bar opens with the account already filled in; the goal and
 * days questions carry a live preview of the block the answers build, read off the real template; the payoff opens on
 * the plan being written, step by step, and lands on a success haptic.
 *
 * Every answer lives in localStorage per account with the step it was on (onboarding-04), so a reload, or the app quit
 * mid-setup and opened again, lands on the same step with the same answers. Cleared on finish and at sign out. Back is the
 * chevron, the browser's back, or an edge swipe from the left. An account that has finished (onboardedAt set) never sees
 * this, unless it is in the middle of its own payoff.
 */

const ALL_STEPS: Step[] = ['name', 'fitness', 'goal', 'days', 'morning', 'habits', 'nudge', 'tour', 'ready'];

interface Draft {
  /** "Do you want Orby to track training?": undefined until answered; false skips every training question (lib/prefs.ts). */
  fitness?: boolean;
  /** null: not answered yet; 'none': no running plan for now (onboarding-09). */
  goal: Goal | 'none' | null;
  /** The step the person was on, so the app opened again lands there (onboarding-04). */
  step?: Step;
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
  /** What to call them (the profile's name); prefilled from the account. */
  name?: string;
  /** When they usually train, and when work ends for an afternoon (Today's training card starts from these). */
  trainWhen?: 'morning' | 'afternoon';
  offWork?: number;
  /** The tour's page, so a reload lands on the same one. */
  tourPage?: number;
  /** The morning nudge: on unless turned off (the system still asks; this is only what Continue asks it for). */
  nudge?: boolean;
  /** The answers last sent, and what came back, so a reload on the payoff never sends them twice. */
  sent?: string;
  firstDay?: string | null;
}
const blank = (): Draft => ({ goal: null, runDays: DEFAULT_PROFILE.runDays, longRunDay: DEFAULT_PROFILE.longRunDay, weeklyMiles: DEFAULT_MILES.base, milesTouched: false, wake: DEFAULT_WAKE, leave: DEFAULT_LEAVE, habits: [], custom: [] });

const draftKey = (uid: string) => `logbook.onboarding.${uid}`;
/** Set once the answers are sent: the payoff may finish on an account that is already onboarded. Cleared on the way out. */
export const PAYOFF_KEY = 'logbook.onboarding.payoff';
const store = (s: () => Storage) => ({
  get: (k: string) => {
    try {
      return s().getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      s().setItem(k, v);
    } catch {
      /* private mode: the answers last as long as the page */
    }
  },
  del: (k: string) => {
    try {
      s().removeItem(k);
    } catch {
      /* nothing to clear */
    }
  },
});
/** The answers: kept on the device across a quit (a `logbook.` key, so the shell's sign-out wipe clears it). */
const ls = store(() => localStorage);
/** The payoff flag: this tab only. */
const ss = store(() => sessionStorage);
const useDraft = (uid: string) => {
  const [d, setD] = useState<Draft>(() => {
    try {
      const raw = ls.get(draftKey(uid));
      return raw ? { ...blank(), ...(JSON.parse(raw) as Draft) } : blank();
    } catch {
      return blank();
    }
  });
  useEffect(() => ls.set(draftKey(uid), JSON.stringify(d)), [uid, d]);
  return [d, (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }))] as const;
};

/** The block starts tomorrow, so the first week is this week: you leave onboarding looking at a real one. */
const startOf = (t: ISODate) => shiftDays(t, 1);

const profileOf = (d: Draft, start: ISODate): TrainingProfile => {
  // no running plan: the previews never show, and the save sends goal null
  const goal = d.goal && d.goal !== 'none' ? d.goal : 'base';
  return { goal, raceDate: goal === 'base' ? null : d.raceDate === undefined ? defaultRaceDay(goal, start) : d.raceDate, runDays: d.runDays, longRunDay: fixLongRun(d.runDays, d.longRunDay), weeklyMiles: d.weeklyMiles };
};

export default function Welcome() {
  const boot = useBootstrap();
  const params = useParams();
  const user = boot.data?.user;
  if (!user) return null;
  // the owner, and anyone already through, goes straight to Today, unless this is the end of their own first run
  const ending = /^ready/.test(params['*'] ?? '') && !!ss.get(PAYOFF_KEY);
  // Settings → Replay setup: the same flow as a preview, saving nothing
  if (user.onboardedAt && !ending && !isReplaying()) return <Navigate to="/today" replace />;
  return <Flow uid={user.id} />;
}

function Flow({ uid }: { uid: string }) {
  useSplashDoneOnPaint();
  const nav = useNavigate();
  const boot = useBootstrap();
  const params = useParams();
  const reduce = useReducedMotion();
  const step = ((params['*'] ?? '').split('/')[0] ?? '') as Step;
  const [d, set] = useDraft(uid);
  const sheet = useSheet();
  const replaying = useMemo(() => isReplaying(), []);
  const QUESTIONS = questionsFor({ native: remindersSupported(), replaying, noPlan: d.goal === 'none', fitness: d.fitness !== false });
  const ORDER: Step[] = ['', ...QUESTIONS, 'ready'];
  const screenRef = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  // the nudge step is waiting for the phone's answer
  const [asking, setAsking] = useState(false);
  const t = useMemo(() => todayISO(), []);
  const start = startOf(t);
  const profile = profileOf(d, start);
  const shape = useMemo(() => blockShape(safeTemplate(profile, start)), [profile.goal, profile.raceDate, profile.runDays.join(), profile.longRunDay, profile.weeklyMiles, start]); // eslint-disable-line react-hooks/exhaustive-deps

  // direction of travel, for the slide: forward from the right, back from the left
  const prevIdx = useRef(ORDER.indexOf(step));
  const idx = ORDER.indexOf(step);
  const dir = idx >= prevIdx.current ? 1 : -1;
  useEffect(() => {
    prevIdx.current = idx;
  }, [idx]);

  // the step is kept with the answers, so the app opened again comes back to it (onboarding-04)
  useEffect(() => {
    if (step && ALL_STEPS.includes(step) && d.step !== step) set({ step });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // a step change moves focus to the new step's heading once it has slid in (a11y-10)
  useEffect(() => {
    if (!step) return;
    const id = setTimeout(() => screenRef.current?.querySelector<HTMLElement>(`.ob-swipe > .ob-stage[data-step="${step}"] h1`)?.focus({ preventScroll: true }), reduce ? 60 : 320);
    return () => clearTimeout(id);
  }, [step, reduce]);

  const go = (s: Step, replace = false) => nav(s ? `/welcome/${s}` : '/welcome', { replace });
  const back = () => {
    const i = ORDER.indexOf(step);
    if (i <= ORDER.indexOf('name') || step === 'ready') return;
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
  const canBack = idx > ORDER.indexOf('name') && step !== 'ready';
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
    // §9.3: past 35 % or a flick, and never while the finger is going back toward the edge (v ≥ 0, as PushedLayer;
    // review 3 code N3: a flick back from past 35 % springs home)
    const commit = commitsBack(x.get(), wRef.current, v, cancelled);
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

  // guards: /welcome goes to the step the person was on (or the first); a step this path skips goes on to the next one;
  // later steps need a goal
  if (step === '') return <Navigate to={`/welcome/${d.step && ORDER.includes(d.step) ? d.step : 'name'}`} replace />;
  if (!ORDER.includes(step)) {
    const later = ALL_STEPS.slice(ALL_STEPS.indexOf(step) + 1).find((x) => ORDER.includes(x));
    return <Navigate to={`/welcome/${later ?? 'name'}`} replace />;
  }
  // the Fitness question is answered before anything after it; with Yes, later steps need a goal
  if (idx > ORDER.indexOf('fitness') && d.fitness === undefined) return <Navigate to="/welcome/fitness" replace />;
  if (ORDER.includes('goal') && idx > ORDER.indexOf('goal') && !d.goal) return <Navigate to="/welcome/goal" replace />;

  const qIndex = QUESTIONS.indexOf(step);
  const next = () => go(ORDER[idx + 1]!);
  /** Sign out from the name step: the shell does the rest once the session reads signed out (Contract 2). */
  async function signOut() {
    setSigningOut(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      clearAll();
      markSignedOut(qc);
    } catch {
      haptics.error();
      toast('Couldn’t sign out. Check your connection.');
      setSigningOut(false);
    }
  }
  // a race day too close for its distance: said on the goal and days steps, with the usual date one tap away (never a block)
  const tight = raceWarning(profile, start);
  const tightNote = tight ? (
    <div className="ob-warn" role="status">
      <p className="ob-warn-text">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>{tight.text}</span>
      </p>
      <Pressable
        className="ob-chip ob-fix"
        onPress={() => {
          haptics.select();
          set({ raceDate: tight.later });
        }}
      >
        Race on {fmtDate('short', tight.later)} instead
      </Pressable>
    </div>
  ) : null;

  const bodyFor = (step: Step): React.ReactNode => {
  let body: React.ReactNode;
  switch (step) {
    case 'name':
      body = (
        <Question
          title="What should Orby call you?"
          sub="Your first name is plenty. The assistant and your mornings use it."
          onNext={next}
          // "Next" whenever the field holds a name, the account's own included (layout standard 6.6; plan O12)
          nextLabel={(d.name ?? boot.data?.user.name ?? '').trim() ? 'Next' : 'Skip for now'}
          later="You can change it in Settings."
          extra={
            // the way out of setup for someone who signed up by mistake, or on someone else's phone (onboarding-09)
            replaying ? null : (
              <Pressable className="ob-signout" press="dim" disabled={signingOut} onPress={() => void signOut()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Pressable>
            )
          }
        >
          <input
            className="in ob-name"
            value={d.name ?? boot.data?.user.name ?? ''}
            onChange={(e) => set({ name: e.target.value.slice(0, 40) })}
            placeholder="First name"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
            aria-label="First name"
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </Question>
      );
      break;
    case 'fitness': {
      // one question, two clear choices, where the training questions begin. The answer is the Fitness switch itself
      // (lib/prefs.ts), set at once so a reload keeps it; a replay of setup is a preview and changes nothing
      const answer = (v: boolean) => {
        if (d.fitness !== v) haptics.select();
        // No: nothing about training is asked or built. Yes after a No: the goal is asked afresh
        set(v ? { fitness: true, goal: d.fitness === false ? null : d.goal } : { fitness: false, goal: 'none', raceDate: undefined });
        if (!replaying) setFitness(v);
      };
      body = (
        <Question title="Do you want Orby to track training?" sub="Runs, lifts and a training plan. Say no, and Orby keeps to your day." onNext={next} nextDisabled={d.fitness === undefined}>
          <div className="group ob-goals" role="radiogroup" aria-label="Do you want Orby to track training?">
            {(
              [
                { v: true, Icon: FitnessIcon, label: 'Yes, track training', line: 'Runs, lifts, a plan' },
                { v: false, Icon: TodayIcon, label: 'No, just my day', line: 'Goals, to-dos, habits' },
              ] as const
            ).map((c) => (
              <Pressable key={String(c.v)} role="radio" aria-checked={d.fitness === c.v} className={`ob-goal ${d.fitness === c.v ? 'on' : ''}`} onPress={() => answer(c.v)}>
                <span className="icon-tile ob-goal-ic" aria-hidden="true">
                  <c.Icon size={18} />
                </span>
                <span className="ob-goal-words">
                  <span className="ob-goal-text">{c.label}</span>
                  <span className="ob-goal-line">{c.line}</span>
                </span>
                {d.fitness === c.v ? <Check size={18} className="ob-goal-check" aria-hidden="true" /> : null}
              </Pressable>
            ))}
          </div>
        </Question>
      );
      break;
    }
    case 'goal':
      body = (
        <Question title="What are you training for?" sub="Pick one. A race gets a taper; just running gets a steady build." onNext={next} nextDisabled={!d.goal}>
          <GoalChips
            value={d.goal === 'none' ? null : d.goal}
            noneOn={d.goal === 'none'}
            onNone={() => set({ goal: 'none', raceDate: undefined })}
            onChange={(g) => {
              set({ goal: g, raceDate: undefined, weeklyMiles: d.milesTouched ? d.weeklyMiles : DEFAULT_MILES[g] });
              // the answer does something at once: the screen glides to the race day and the block it builds
              setTimeout(() => screenRef.current?.querySelector('.ob-stage[data-step="goal"] .obx-block')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }), 90);
            }}
          />
          <AnimatePresence initial={false}>
            {d.goal && d.goal !== 'base' && d.goal !== 'none' ? (
              <motion.div key="race" className="card ob-card ob-race-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
                <p className="ob-q-label">
                  Race day <span className="ob-q-value">{profile.raceDate ? fmtDate('short', profile.raceDate) : 'Not set'}</span>
                </p>
                <RaceStrip start={start} value={profile.raceDate} onChange={(r) => set({ raceDate: r })} />
                {tightNote}
                <BlockPreview shape={shape} bare />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {d.goal === 'base' ? <BlockPreview shape={shape} /> : null}
        </Question>
      );
      break;
    case 'days':
      body = (
        <Question title="Which days can you run?" sub="Tap a day to run on it. Hold a run day to make it the long run." onNext={next}>
          {/* one card (plan O5): the days, then under a hairline the miles with their own group title, then one line that
              sums up the plan they make (the payoff shows the week itself) */}
          <div className="card ob-card ob-days-card">
            <DayLetters hint={false} runDays={d.runDays} longRunDay={fixLongRun(d.runDays, d.longRunDay)} onChange={(runDays, longRunDay) => set({ runDays, longRunDay })} />
            <hr className="rule" />
            <h2 className="card-title ob-miles-label">How much do you run now?</h2>
            <MilesDial value={d.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => set({ weeklyMiles: v, milesTouched: true })} />
            <p className="ob-hint" aria-live="polite">
              {d.runDays.length} {d.runDays.length === 1 ? 'run' : 'runs'} a week. {shape ? blockLine(shape) : null}
            </p>
            {tightNote}
          </div>
        </Question>
      );
      break;
    case 'morning': {
      const chips = d.routine ?? [];
      const st = routineSettings(chips);
      const pv = previewMorning(d.wake, d.leave, undefined, st);
      const afternoon = d.trainWhen === 'afternoon';
      const offWork = d.offWork ?? DEFAULT_AFTERNOON.offWork;
      // tight: the latest wake time that fits, found on the real preview so one tap clears it (onboarding-10)
      const fixAt = afternoon ? null : morningFix(d.wake, d.leave, st);
      const fix = fixAt ? { ...fixAt, text: fixAt.wake !== d.wake ? `Wake ${hm(fixAt.wake)}?` : `Leave ${hm(fixAt.leave)}?` } : null;
      body = (
        <Question
          title="When does your day start?"
          sub="Drag the two markers. Orby plans your morning around them."
          onNext={next}
          // what the answers make, said once, on the line above Next (plan O5): in place of "You can change this later"
          later={
            <span className="ob-verdict" aria-live="polite">
              <b>{afternoon ? afternoonLine(offWork) : `Out the door ${hm(pv.door)}.`}</b> <span className="ob-verdict-more">{afternoon ? `Mornings: wake ${hm(d.wake)}, leave ${hm(d.leave)}.` : verdictLine(pv)}</span>
            </span>
          }
        >
          {/* one card for when (plan O5): before or after work, then under a hairline the wake and leave markers, and the
              one-tap fix when the morning is too tight */}
          <div className="card ob-card ob-when">
            <p className="ob-q-label">You usually train</p>
            <div className="ob-when-seg" role="radiogroup" aria-label="When you usually train">
              {(['morning', 'afternoon'] as const).map((v) => (
                <Pressable
                  key={v}
                  className={`ob-chip ${(d.trainWhen ?? 'morning') === v ? 'on' : ''}`}
                  role="radio"
                  aria-checked={(d.trainWhen ?? 'morning') === v}
                  onPress={() => {
                    if ((d.trainWhen ?? 'morning') !== v) haptics.select();
                    set({ trainWhen: v });
                  }}
                >
                  {v === 'morning' ? 'Before work' : 'After work'}
                </Pressable>
              ))}
            </div>
            {afternoon ? (
              <div className="ob-offwork">
                <span>Work ends</span>
                {/* the 15-minute buttons set it; the value is read-only, so nothing typed is ever thrown away (onboarding-23) */}
                <Stepper value={offWork} onChange={(v) => set({ offWork: v })} step={15} min={11 * 60} max={21 * 60} format={(v) => hm(v)} parse={() => null} label="Work ends" inputProps={{ readOnly: true, tabIndex: -1, inputMode: 'numeric', autoComplete: 'off', size: 7 }} />
              </div>
            ) : null}
            <hr className="rule" />
            <MorningTrack wake={d.wake} leave={d.leave} settings={st} onChange={(wake, leave) => set({ wake, leave })} />
            <AnimatePresence initial={false}>
              {fix ? (
                <motion.div key="fix" className="ob-fix-row" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={reduce ? fadeIn : springs.settle}>
                  <Pressable
                    className="ob-chip ob-fix"
                    onPress={() => {
                      haptics.select();
                      set({ wake: fix.wake, leave: fix.leave });
                    }}
                  >
                    <Clock size={16} aria-hidden="true" />
                    {fix.text}
                  </Pressable>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {/* the second group: what happens before you leave */}
          <div className="card ob-card">
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
                    {on ? <Check size={18} aria-hidden="true" /> : null}
                    {c.label}
                  </Pressable>
                );
              })}
            </div>
          </div>
        </Question>
      );
      break;
    }
    case 'habits':
      body = (
        <Question title="Pick a few daily habits." sub="Pick any, or none. Each one is a tile you tap on Today when it’s done." onNext={next} nextLabel="Next" later="You can add or change habits any time.">
          <div className="card ob-card">
            <HabitPicker selected={d.habits} custom={d.custom} onChange={(habits, custom) => set({ habits, custom })} />
          </div>
        </Question>
      );
      break;
    case 'nudge': {
      const on = d.nudge !== false;
      body = (
        <Question
          title="One nudge, each morning."
          sub="One reminder each morning, only on days with no goal yet. You choose the time."
          busy={asking}
          onNext={() => {
            // the system alert comes up here, on this screen, and the flow waits for its answer; a decline is simply off
            // (onboarding-14); "No nudges" and a replay never call into reminders (settings-39)
            if (asking) return;
            setAsking(true);
            void nudgeNext({ on, replaying, enable: enableReminders }).then((granted) => {
              setAsking(false);
              if (on && !granted && !replaying) set({ nudge: false });
              next();
            });
          }}
          nextLabel={asking ? 'One moment…' : on ? 'Turn on nudges' : 'Continue without'}
          later="Turn it off any time in Goals."
        >
          <NudgeChoice on={on} at={d.wake + 15} onChange={(v) => set({ nudge: v })} />
        </Question>
      );
      break;
    }
    case 'tour':
      body = <Tour page={d.tourPage ?? 0} onPage={(n) => set({ tourPage: n })} onDone={next} doneLabel={d.goal === 'none' ? 'Finish setup' : 'Build my week'} fitness={d.fitness !== false} />;
      break;
    case 'ready':
      body = <Payoff draft={d} set={set} profile={d.goal === 'none' ? null : profile} start={start} today={t} onOpen={openToday} onChange={() => go('goal', true)} />;
      break;
  }
  return body;
  };
  const body = bodyFor(step);
  const skip = swapping.current;

  function clearAll() {
    ls.del(draftKey(uid));
    ss.del(draftKey(uid));
    ss.del(PAYOFF_KEY);
    endReplay();
  }
  /**
   * The payoff's one offer, once Today is up: the Strava primer. Only in a build that has the connection at all (a release
   * build carries none of it: the primer's module is never loaded and never bundled).
   */
  function afterHandOff() {
    if (!STRAVA_BUILT || d.fitness === false) return;
    void import('./StravaPrimer').then(({ StravaPrimer }) => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> }));
  }
  /** The hand-off (§8): Today mounts under a still copy of this screen, the week falls away, Today's chrome fades in. */
  function openToday(then?: PayoffAction) {
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
      after: then ? afterHandOff : undefined,
    });
  }

  return (
    <main className="ob" ref={screenRef} onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeUp} onPointerCancel={onEdgeUp}>
      <span className={`ob-halo ${step === 'ready' ? 'bloom' : ''}`} aria-hidden="true" />
      {qIndex >= 0 ? (
        <header className="ob-top">
          {/* the chevron and Skip stay in place and fade with the dots when a step has none (review 2 feel N11), never a
              one-frame cut; hidden, they are inert (out of the tab order, the accessibility tree and hit-testing). The fade is
              the slot's, so each keeps its own press (review 3 code N8) */}
          <span className={`ob-slot ${canBack ? '' : 'is-gone'}`} inert={!canBack}>
            <button type="button" className="icon-btn ob-back" aria-label="Back" onClick={canBack ? back : undefined}>
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          </span>
          {/* the tour has its own dots over its button: one progress mark per view, so the bar steps aside there (plan O10) */}
          {step === 'tour' ? <span aria-hidden="true" /> : <SetupBar steps={QUESTIONS.length} index={qIndex} />}
          {/* Skip only where it differs from the step's own button: the tour, which it skips whole (onboarding-17) */}
          <span className={`ob-slot end ${step === 'tour' ? '' : 'is-gone'}`} inert={step !== 'tour'}>
            <Pressable className="ob-skip" press="dim" onPress={step === 'tour' ? next : () => undefined}>
              Skip tour
            </Pressable>
          </span>
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
/**
 * One question to a screen (inspiration §2.9, §2.24): the question is the title, the button stays grey until the answer is
 * valid, and every answer here can be changed later in Settings, so the foot says so (`later`).
 */
function Question({ title, sub, children, onNext, nextDisabled, nextLabel = 'Next', later = 'You can change this later in Settings.', busy, extra }: { title: string; sub: string; children: React.ReactNode; onNext: () => void; nextDisabled?: boolean; nextLabel?: string; /** the line above Next: by default that the answer can change later; a step can say what its answers make instead */ later?: React.ReactNode; /** the button is waiting (the phone's alert is up) */ busy?: boolean; /** one quiet action under the button */ extra?: React.ReactNode }) {
  return (
    <div className="ob-step ob-question">
      {/* focus lands here on a step change (a11y-10) */}
      <h1 className="ob-title display" tabIndex={-1}>
        {title}
      </h1>
      <p className="ob-sub">{sub}</p>
      <div className="ob-body">{children}</div>
      <div className="ob-foot">
        {later ? <p className="ob-later">{later}</p> : null}
        <Pressable className="btn primary block ob-cta" disabled={nextDisabled || busy} onPress={onNext}>
          {nextLabel}
        </Pressable>
        {extra}
      </div>
    </div>
  );
}

// ---------- the payoff ----------
/**
 * The payoff (§8): the first week, written into the plan, under the headline; the hero is Today's first-run face
 * (`Made`: what the answers set up) at the resting y of Today's hero slot (157 + safe-t at 390 × 844, contracts §A.5). `Open Today` (or a
 * row of the face) is the hand-off: the week rows fall away and Today's chrome fades in around a hero that stays put
 * (`handoff.ts`), with no route cut and no leave animation.
 */
/** What a row of the payoff's card can ask for after the hand-off: the one offer, in a build that has it. */
type PayoffAction = 'connect';

/**
 * The payoff's card, where Today's hero will be: a short summary of what the answers made (the plan, the morning, the
 * habits). Nothing here asks for work that was done a minute ago. `offer` is one more row, when the build has one to make.
 */
function Made({ profile, weeks, wake, leave, habits, afternoon, offer, fitness = true }: { /** false: the answer to the Fitness question was No, so no row speaks of a plan */ fitness?: boolean; profile: TrainingProfile | null; weeks: number | null; wake: number; leave: number; habits: number; /** when work ends, for someone who runs after it */ afternoon?: number | null; offer?: React.ReactNode }) {
  return (
    // no caption over the rows: they say what was set up themselves, and the headline above already has the screen's
    // one caption line (plan O11)
    <section className="aura ob-made" aria-label="Set up for you">
      <ul className="ob-made-rows">
        {fitness ? (
          <li className="ob-made-row">
            <span className="ob-made-ic" aria-hidden="true">
              <PlanIcon size={18} />
            </span>
            <span className="ob-made-title">{!profile ? 'No running plan for now' : profile.goal === 'base' ? 'Just running' : `${goalLong(profile.goal)} plan`}</span>
            {profile && weeks ? <span className="ob-made-value">{weeks} {weeks === 1 ? 'week' : 'weeks'}</span> : null}
          </li>
        ) : null}
        <li className="ob-made-row">
          <span className="ob-made-ic" aria-hidden="true">
            <BrandIcon name="wake" size={18} />
          </span>
          <span className="ob-made-title">{afternoon != null ? `Runs after work, about ${hm(afternoon + AFTER_WORK_LEAD)}` : `Wake ${hm(wake)}, leave ${hm(leave)}`}</span>
        </li>
        <li className="ob-made-row">
          <span className="ob-made-ic" aria-hidden="true">
            <HabitIcon size={18} />
          </span>
          <span className="ob-made-title">{habits ? `${habits} ${habits === 1 ? 'habit' : 'habits'} on Today` : 'No habits yet. Add them on Today.'}</span>
        </li>
        {offer ? <li>{offer}</li> : null}
      </ul>
    </section>
  );
}

function Payoff({ draft, set, profile, start, today, onOpen, onChange }: { draft: Draft; set: (p: Partial<Draft>) => void; /** null: no running plan */ profile: TrainingProfile | null; start: ISODate; today: ISODate; onOpen: (then?: PayoffAction) => void; /** Back to the questions: the way out when the server refuses an answer. */ onChange: () => void }) {
  const boot = useBootstrap();
  const reduce = useReducedMotion();
  const onboard = useSaveOnboarding();
  const [waiting, setWaiting] = useState<{ then?: PayoffAction } | null>(null);
  const plan = profile ?? DEFAULT_PROFILE;
  const week = useMemo(() => firstWeek(plan, start, today, draft.wake, draft.leave, routineSettings(draft.routine ?? [])), [plan, start, today, draft.wake, draft.leave, draft.routine]);

  const routine = routineFrom(draft.routine ?? []);
  const afternoon = draft.trainWhen === 'afternoon' ? (draft.offWork ?? DEFAULT_AFTERNOON.offWork) : null;
  // the older follow-up writes, kept only for a server that does not yet take these answers in the one call
  const morning = useMorningMutations();
  const setName = useSetName();
  const name = (draft.name ?? '').trim();
  const routinePatch = { after: { ...routine, names: routineNames(draft.routine ?? []), showerMode: 'fixed' as const, showerAt: Math.max(draft.wake, draft.leave - routineTotal(routine)) } };
  // every answer in the one call (Contract 5, onboarding-03)
  const answers: OnboardingPost = {
    goal: profile ? profile.goal : null,
    raceDate: profile ? profile.raceDate : null,
    runDays: plan.runDays,
    longRunDay: plan.longRunDay,
    weeklyMiles: plan.weeklyMiles,
    wake: draft.wake,
    leave: draft.leave,
    // never more than the account can hold: a longer list would be refused whole
    habits: draft.habits.slice(0, HABIT_LIMIT),
    start: 'tomorrow',
    today,
    ...(name ? { name } : {}),
    routine: routinePatch,
    trainWhen: draft.trainWhen ?? 'morning',
    ...(afternoon != null ? { offWork: afternoon } : {}),
  };
  const key = JSON.stringify(answers);
  const saved = draft.sent === key;
  // a replay from Settings saves nothing: the account already has its plan
  const replay = useMemo(() => isReplaying(), []);
  const send = () => {
    if (replay) return;
    ss.set(PAYOFF_KEY, '1');
    onboard.mutate(answers, {
      onSuccess: (r) => {
        set({ sent: key, firstDay: r.firstDay });
        // a server from before Contract 5 answers without the name or the routine: only then the two older writes follow
        if (name && r.user?.name !== name) setName.mutate(name);
        if (r.morningSettings && r.morningSettings.after?.showerAt !== routinePatch.after.showerAt) morning.settings.mutate(routinePatch);
        // Today's training card reads when they train on this device too (its own preference)
        setTrainWhenDefault(draft.trainWhen ?? 'morning');
        if (afternoon != null) setAfternoon({ offWork: afternoon });
      },
      onError: () => haptics.error(),
    });
  };
  useEffect(() => {
    if (!saved && !onboard.isPending) send();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = replay || saved || onboard.isSuccess;
  // the server refused the answers themselves (not a lost connection, a signed-out session or a rate limit): sending them
  // again cannot work, so the way on is back to the questions
  const refused = onboard.error instanceof ApiError && onboard.error.status >= 400 && onboard.error.status < 500 && ![401, 408, 429].includes(onboard.error.status);
  const reason = !onboard.isError ? null : refused ? 'Orby couldn’t use one of your answers. Change them and try again.' : 'Check your connection and try again.';
  const retry = (
    <>
      {refused ? null : (
        <Pressable className="btn primary block ob-cta" onPress={send}>
          Try again
        </Pressable>
      )}
      <Pressable className={`btn ${refused ? 'primary' : 'soft'} block ob-cta`} onPress={onChange}>
        Change my answers
      </Pressable>
    </>
  );
  // The one offer under the summary: only in a build that has the connection (the whole row is compiled out of a
  // release build), on a server that can make it, for an account that has not.
  const b = boot.data;
  const offer =
    STRAVA_BUILT && !replay && !!profile && !!b?.features.strava && !b.strava.connected ? (
      <Pressable className="ob-made-row" press="surface" onPress={() => open('connect')}>
        <span className="ob-made-ic" aria-hidden="true">
          <RunIcon size={18} />
        </span>
        <span className="ob-made-title">Connect Strava</span>
        <ChevronRight size={16} className="ob-made-chev" aria-hidden="true" />
      </Pressable>
    ) : null;
  const open = (then?: PayoffAction) => {
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

  // the plan being written: once per first run (a reload after it saved opens straight on the payoff)
  const [phase, setPhase] = useState<'build' | 'reveal'>(saved ? 'reveal' : 'build');
  const shape = useMemo(() => (profile ? blockShape(safeTemplate(profile, start)) : null), [profile, start]);
  // each selected habit once: the list already holds the ones typed (onboarding-22)
  const habitCount = answers.habits.length;
  const steps = useMemo(() => buildSteps(profile, shape, draft.wake, draft.leave, habitCount), [profile, shape, draft.wake, draft.leave, habitCount]);
  const reveal = useCallback(() => {
    setPhase('reveal');
    haptics.success();
  }, []);

  const first = profile ? week.first : null;
  const m = week.morning;
  const fade = reduce ? { duration: 0.15 } : { ...springs.page };
  if (phase === 'build')
    return (
      <div className="ob-step ob-payoff is-building">
        <BuildBeat steps={steps} ready={done} failed={reason} onDone={reveal} title={profile ? undefined : { writing: 'Setting up Today', done: 'Today is ready.' }} />
        {/* the buttons' space is held from the start, so nothing moves when they show (onboarding-08); the reason is the
            build's own, under its headline */}
        <div className={`ob-pay-foot ob-build-foot ${onboard.isError ? '' : 'is-idle'}`} aria-hidden={onboard.isError ? undefined : true} inert={!onboard.isError}>
          {onboard.isError ? (
            retry
          ) : (
            <>
              <span className="btn block ob-cta ob-ghost" />
              <span className="btn block ob-cta ob-ghost" />
            </>
          )}
        </div>
      </div>
    );
  return (
    <div className="ob-step ob-payoff">
      <header className="ob-pay-head">
        <motion.span className="caps ob-pay-eyebrow" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fadeIn}>
          {!profile ? 'All set' : week.template ? week.template.name : 'Your first week'}
        </motion.span>
        <motion.h1 className="ob-pay-title display" tabIndex={-1} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fade : { ...fade, delay: 0.08 }}>
          {!profile ? 'Today is ready.' : first ? `${week.firstWhen}: ${week.days.find((x) => x.session === first)?.label ?? 'Easy'}.` : 'Your week is ready.'}
        </motion.h1>
        {afternoon != null && profile ? (
          <motion.p className="ob-pay-door display" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...fadeIn, delay: reduce ? 0 : 0.16 }}>
            {afternoonLine(afternoon)}
          </motion.p>
        ) : m && profile ? (
          <motion.p className="ob-pay-door display" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...fadeIn, delay: reduce ? 0 : 0.16 }}>
            Out the door {hm(m.door)}.
          </motion.p>
        ) : null}
      </header>

      {/* what was made, where Today's hero will be */}
      <div className="ob-pay-hero">
        <Made fitness={draft.fitness !== false} profile={profile} weeks={shape?.weeks ?? null} wake={draft.wake} leave={draft.leave} habits={habitCount} afternoon={profile ? afternoon : null} offer={offer} />
      </div>

      {profile ? (
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
                  {s ? <span className="ob-wsess">{day.label}</span> : <span className="ob-wrest">Rest</span>}
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
      ) : null}

      <div className="ob-pay-foot">
        <p className="ob-pay-sum" aria-live="polite">
          {onboard.isError ? (
            <span className="ob-err">{draft.fitness === false ? 'Couldn’t save your answers.' : 'Couldn’t save your plan.'} {reason}</span>
          ) : replay ? (
            <>
              <Check size={16} aria-hidden="true" className="ob-ok" />
              {draft.fitness === false ? 'Preview only. Nothing was changed.' : 'Preview only. Your plan and habits weren’t changed.'}
            </>
          ) : !profile ? (
            done ? (
              <>
                <Check size={16} aria-hidden="true" className="ob-ok" />
                {draft.fitness === false ? 'Saved.' : 'Saved. Add a running plan any time from Fitness.'}
              </>
            ) : (
              'Saving your answers…'
            )
          ) : done ? (
            <>
              <Check size={16} aria-hidden="true" className="ob-ok" />
              {week.miles} mi over {week.runs} {week.runs === 1 ? 'run' : 'runs'} in your first seven days. Saved to your plan.
            </>
          ) : (
            `${week.miles} mi over ${week.runs} ${week.runs === 1 ? 'run' : 'runs'} in your first seven days. Writing it into your plan…`
          )}
        </p>
        {onboard.isError ? (
          retry
        ) : (
          <Pressable className="btn primary block ob-cta" onPress={() => open()} disabled={!!waiting}>
            {waiting ? 'One moment…' : 'Open Today'}
          </Pressable>
        )}
      </div>
    </div>
  );
}
