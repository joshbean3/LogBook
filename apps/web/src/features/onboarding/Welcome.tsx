import { fmtDate, shiftDays, today as todayISO, type Goal, type ISODate, type Weekday } from '@logbook/shared';
import { Check, ChevronLeft, Clock, TriangleAlert } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { useBootstrap, useMorningMutations, useSetName } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { readMinutes } from '@/features/day/useNow';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis } from '@/lib/gesture';
import { crossfade, fadeIn, springs } from '@/lib/motion';
import { Pressable } from '@/ui';
import { DayLetters, GoalPills, HabitPicker, MilesDial, MorningTrack, RaceStrip } from './controls';
import { blockShape, buildSteps, HABIT_LIMIT, morningFix, raceWarning, DEFAULT_LEAVE, DEFAULT_MILES, DEFAULT_PROFILE, DEFAULT_WAKE, defaultRaceDay, firstWeek, fixLongRun, hm, MILES_MAX, MILES_MIN, ROUTINE_CHIPS, routineFrom, routineNames, routineSettings, routineTotal, safeTemplate, templateProblem, verdictLine, type TrainingProfile } from './model';
import { BuildBeat, NudgeOptions, NudgePreview } from './beats';
import { Frame, FrameBar, QuietLink } from './Frame';
import { DayPoster, FitnessChoice, GoalPoster, HabitTiles, HelloPoster, TonightPoster, TrainingPoster } from './posters';
import { firstIdea, goalHills, habitTiles, helloPoster, morningStops, revealTiles, trainPoster } from './posterModel';
import { endReplay, isReplaying } from './replay';
import { useSaveOnboarding, type OnboardingPost } from './save';
import { nudgeNext, questionsFor, resumeStep, tourOpens, type Step } from './steps';
import { DEFAULT_AFTERNOON, setAfternoon, setTrainWhenDefault } from '@/features/day/trainWhen';
import { Stepper } from '@/ui/primitives';
import { setFitness } from '@/lib/prefs';
import { Tour } from './tour/Tour';
import { enableReminders, remindersSupported } from '@/features/goals/reminders';
import { useToast } from '@/ui';
import { handOff } from './handoff';
import { commitsBack, releaseVelocity } from './velocity';
import './onboarding.css';
import './beats.css';

/**
 * First run, /welcome/* (the questions and the reveal). The door looks like the house: every question is one frame
 * (Frame.tsx) holding a real piece of the app (posters.tsx) that the answer changes as it is given.
 *
 *   /start            the welcome pager, then privacy and the account (features/auth): they come before this
 *   /welcome          goes straight to the first question (or the one the person was on)
 *   /welcome/name     what to call you: the assistant's greeting writes the name as it is typed
 *   /welcome/fitness  track training or not: two pictures are the two answers, the tab capsule shows four tabs or three
 *   /welcome/goal     what are you training for: the build as far hills, the race the last one     (Fitness on)
 *   /welcome/days     which days, how many miles: the training card's week horizon                 (with a plan)
 *   /welcome/morning  wake and leave: the training card's timeline row                             (with a plan)
 *   /welcome/habits   starter habits: each chip picked becomes a tile, as on Today
 *   /welcome/nudge    on the phone only: one nudge a morning, previewed as the notification itself
 *   /welcome/ready    the plan being written (BuildBeat, as long as the save really takes), then the reveal: Today as a
 *                     stack of posters made of the answers, "Open Today" (the hand-off, §8), and one quiet link,
 *                     "See how Orby works"
 *   /welcome/tour     the tour (tour/): no longer a step. The reveal's quiet link opens it and it ends on the reveal.
 *                     An old saved step of `tour`, or a link to it before setup is saved, goes on to /welcome/ready.
 *
 * The rules (which questions are asked, what is saved) are steps.ts and model.ts and did not change; what each picture
 * shows for a set of answers is posterModel.ts.
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
  const ending = /^(ready|tour)/.test(params['*'] ?? '') && !!ss.get(PAYOFF_KEY);
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

  // the first seven days the answers build, read off the real plan: the pictures of the goal, the days and the morning
  const routineKey = (d.routine ?? []).join();
  const week = useMemo(() => firstWeek(profile, start, t, d.wake, d.leave, routineSettings(d.routine ?? [])), [profile.goal, profile.raceDate, profile.runDays.join(), profile.longRunDay, profile.weeklyMiles, start, t, d.wake, d.leave, routineKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // the reveal has been seen in this visit: coming back to it from the tour does not write the plan out again
  const revealed = useRef(false);

  // direction of travel, for the slide: forward from the right, back from the left (the tour lies past the reveal)
  const idx = ORDER.indexOf(step);
  const pos = step === 'tour' ? ORDER.length : idx;
  const prevPos = useRef(pos);
  const dir = pos >= prevPos.current ? 1 : -1;
  useEffect(() => {
    prevPos.current = pos;
  }, [pos]);

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
    // the tour goes back to the reveal it was opened from
    if (step === 'tour') return go('ready', true);
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
  if (step === '') return <Navigate to={`/welcome/${resumeStep(d.step, ORDER)}`} replace />;
  // the tour is not a step any more: it opens from the reveal and ends there. Before setup is saved (an old draft that
  // was on it, a link to it) there is no reveal to come back to yet, so it goes on to the reveal's own step
  const tourOpen = step === 'tour' && tourOpens({ replaying, saved: !!d.sent || !!ss.get(PAYOFF_KEY) });
  if (step === 'tour' && !tourOpen) return <Navigate to="/welcome/ready" replace />;
  if (!ORDER.includes(step) && step !== 'tour') {
    const later = ALL_STEPS.slice(ALL_STEPS.indexOf(step) + 1).find((x) => ORDER.includes(x));
    return <Navigate to={`/welcome/${later ?? 'name'}`} replace />;
  }
  // the Fitness question is answered before anything after it; with Yes, later steps need a goal
  if (pos > ORDER.indexOf('fitness') && d.fitness === undefined) return <Navigate to="/welcome/fitness" replace />;
  if (ORDER.includes('goal') && pos > ORDER.indexOf('goal') && !d.goal) return <Navigate to="/welcome/goal" replace />;

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

  const typedName = d.name ?? boot.data?.user.name ?? '';
  const afternoon = d.trainWhen === 'afternoon';
  const offWork = d.offWork ?? DEFAULT_AFTERNOON.offWork;
  const card = trainPoster(week, profile, week.first ? null : templateProblem(profile, start));
  const firstRun = week.first ? { type: week.first.type, miles: week.first.miles } : undefined;

  const bodyFor = (step: Step): React.ReactNode => {
    switch (step) {
      case 'name': {
        const hello = helloPoster(typedName);
        return (
          <Frame
            title="What should Orby call you?"
            lede="The assistant greets you with it."
            poster={<HelloPoster line={hello} />}
            posterLabel={`The assistant will say: ${hello}`}
            // the field is already spoken as it is typed
            posterLive={false}
            // Next once the field holds a name, the account's own included; skipping is the quiet link, never the Sky button
            next={{ onPress: next, disabled: !typedName.trim() }}
            quiet={
              <div className="ob-quiets">
                {typedName.trim() ? null : <QuietLink onPress={next}>Skip for now</QuietLink>}
                {/* the way out of setup for someone who signed up by mistake, or on someone else's phone (onboarding-09) */}
                {replaying ? null : (
                  <QuietLink disabled={signingOut} onPress={() => void signOut()}>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </QuietLink>
                )}
              </div>
            }
          >
            <input
              className="in ob-name"
              value={typedName}
              onChange={(e) => set({ name: e.target.value.slice(0, 40) })}
              placeholder="First name"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-label="First name"
              onKeyDown={(e) => e.key === 'Enter' && typedName.trim() && next()}
            />
          </Frame>
        );
      }
      case 'fitness': {
        // one question, two clear choices, where the training questions begin. The answer is the Fitness switch itself
        // (lib/prefs.ts), set at once so a reload keeps it; a replay of setup is a preview and changes nothing
        const answer = (v: boolean) => {
          if (d.fitness !== v) haptics.select();
          // No: nothing about training is asked or built. Yes after a No: the goal is asked afresh
          set(v ? { fitness: true, goal: d.fitness === false ? null : d.goal } : { fitness: false, goal: 'none', raceDate: undefined });
          if (!replaying) setFitness(v);
        };
        return (
          <Frame title="Do you want Orby to track training?" lede="Runs, lifts and a plan. Or just your day." next={{ onPress: next, disabled: d.fitness === undefined }}>
            <FitnessChoice value={d.fitness} onChange={answer} label="Do you want Orby to track training?" />
          </Frame>
        );
      }
      case 'goal': {
        const picked = d.goal && d.goal !== 'none' ? d.goal : null;
        const hills = goalHills(picked ? profile : null, shape, week);
        return (
          <Frame
            title="What are you training for?"
            lede="A race gets a taper. Just running gets a steady build."
            poster={<GoalPoster hills={hills} />}
            posterLabel={hills.said}
            next={{ onPress: next, disabled: !picked }}
            // skipping is real here: setup finishes with no running plan, and the run questions are not asked (onboarding-09)
            quiet={
              <QuietLink
                onPress={() => {
                  haptics.select();
                  set({ goal: 'none', raceDate: undefined });
                  const path = questionsFor({ native: remindersSupported(), replaying, noPlan: true, fitness: true });
                  go(path[path.indexOf('goal') + 1] ?? 'ready');
                }}
              >
                No running plan for now
              </QuietLink>
            }
          >
            <GoalPills value={picked} onChange={(g) => set({ goal: g, raceDate: undefined, weeklyMiles: d.milesTouched ? d.weeklyMiles : DEFAULT_MILES[g] })} />
            <AnimatePresence initial={false}>
              {picked && picked !== 'base' ? (
                <motion.div key="race" className="card ob-card ob-race-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
                  <p className="ob-q-label">
                    Race day <span className="ob-q-value">{profile.raceDate ? fmtDate('short', profile.raceDate) : 'Not set'}</span>
                  </p>
                  <RaceStrip start={start} value={profile.raceDate} onChange={(r) => set({ raceDate: r })} />
                  {tightNote}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Frame>
        );
      }
      case 'days':
        return (
          <Frame title="Which days can you run?" lede="Tap your run days. Hold one to make it the long run." poster={<TrainingPoster name={card.name} line={card.line} scene={card.scene} />} posterLabel={card.said} next={{ onPress: next }}>
            {/* one card: the days, then under a hairline the miles; the picture above is what they make */}
            <div className="card ob-card ob-days-card">
              <DayLetters hint={false} runDays={d.runDays} longRunDay={fixLongRun(d.runDays, d.longRunDay)} onChange={(runDays, longRunDay) => set({ runDays, longRunDay })} />
              <hr className="rule" />
              <p className="ob-q-label ob-miles-label">How much do you run now?</p>
              <MilesDial value={d.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => set({ weeklyMiles: v, milesTouched: true })} />
              {tightNote}
            </div>
          </Frame>
        );
      case 'morning': {
        const chips = d.routine ?? [];
        const st = routineSettings(chips);
        const mp = morningStops({ week, wake: d.wake, leave: d.leave, afternoon: afternoon ? offWork : null });
        // tight: the latest wake time that fits, found on the real preview so one tap clears it (onboarding-10)
        const fixAt = afternoon ? null : morningFix(d.wake, d.leave, st, firstRun);
        const fix = fixAt ? { ...fixAt, text: fixAt.wake !== d.wake ? `Wake ${hm(fixAt.wake)}?` : `Leave ${hm(fixAt.leave)}?` } : null;
        return (
          <Frame
            title="When does your day start?"
            lede="Drag the two markers to set your morning."
            poster={<TrainingPoster name={card.name} line={mp.line} scene={null} stops={mp.stops} />}
            posterLabel={`${card.name}. ${mp.said}.`}
            next={{ onPress: next }}
            // only when the run does not fit: why, in plain words (the one-tap fix is the chip under the markers)
            note={mp.tight && week.morning ? <span className="ob-verdict">{verdictLine(week.morning, firstRun)}</span> : null}
          >
            {/* one card, three groups under hairlines: before or after work; the wake and leave markers, with the one-tap
                fix when the morning is too tight; what happens before you leave */}
            <div className="card ob-card ob-when">
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
                    {v === 'morning' ? 'Run before work' : 'Run after work'}
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
              <MorningTrack compact wake={d.wake} leave={d.leave} settings={st} run={firstRun} onChange={(wake, leave) => set({ wake, leave })} />
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
              {/* the third group: what happens before you leave */}
              <hr className="rule" />
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
          </Frame>
        );
      }
      case 'habits': {
        const tiles = habitTiles(d.habits);
        return (
          <Frame
            title="Pick a few daily habits."
            lede="Pick any, or none. Each becomes a tile on Today."
            poster={
              <div className="obp-well">
                <HabitTiles names={tiles} today={t} />
              </div>
            }
            posterLabel={tiles.length ? `${tiles.length === 1 ? 'One tile' : `${tiles.length} tiles`} on Today: ${tiles.join(', ')}.` : 'No habits picked yet.'}
            next={{ onPress: next }}
          >
            <div className="card ob-card">
              <HabitPicker selected={d.habits} custom={d.custom} onChange={(habits, custom) => set({ habits, custom })} />
            </div>
          </Frame>
        );
      }
      case 'nudge': {
        const on = d.nudge !== false;
        return (
          <Frame
            title="One nudge, each morning."
            lede="Only on days with no goal yet. Turn it off any time in Goals."
            poster={<NudgePreview on={on} at={d.wake + 15} />}
            posterLabel={on ? `A notification at ${hm(d.wake + 15)}: Set today’s goal. One thing that would make today a win.` : 'No notification.'}
            next={{
              // the system alert comes up here, on this screen, and the flow waits for its answer; a decline is simply off
              // (onboarding-14); "No nudges" and a replay never call into reminders (settings-39)
              onPress: () => {
                if (asking) return;
                setAsking(true);
                void nudgeNext({ on, replaying, enable: enableReminders }).then((granted) => {
                  setAsking(false);
                  if (on && !granted && !replaying) set({ nudge: false });
                  next();
                });
              },
              busy: asking,
              label: asking ? 'One moment…' : on ? 'Turn on nudges' : 'Continue without',
            }}
          >
            <NudgeOptions on={on} at={d.wake + 15} onChange={(v) => set({ nudge: v })} />
          </Frame>
        );
      }
      case 'tour':
        // opened from the reveal's quiet link; it ends where it was opened
        return <Tour page={d.tourPage ?? 0} onPage={(n) => set({ tourPage: n })} onDone={() => go('ready', true)} doneLabel="Done" fitness={d.fitness !== false} />;
      case 'ready':
        return (
          <Payoff
            draft={d}
            set={set}
            profile={d.goal === 'none' ? null : profile}
            start={start}
            today={t}
            seen={revealed}
            onOpen={openToday}
            onChange={() => go(d.fitness === false ? 'habits' : 'goal', true)}
            onTour={() => {
              set({ tourPage: 0 });
              go('tour');
            }}
          />
        );
      default:
        return null;
    }
  };
  const body = bodyFor(step);
  const skip = swapping.current;

  function clearAll() {
    ls.del(draftKey(uid));
    ss.del(draftKey(uid));
    ss.del(PAYOFF_KEY);
    endReplay();
  }
  /** The hand-off (§8): Today mounts under a still copy of this screen, the foot falls away, Today's chrome fades in. */
  function openToday() {
    const cut = () => {
      clearAll();
      nav('/today', { replace: true });
    };
    const screen = screenRef.current;
    if (!screen) return cut();
    handOff({
      screen,
      falls: '.ob-pay-foot',
      fades: '.ob-rv-head, .ob-halo',
      reduce: !!reduce,
      cut,
    });
  }

  return (
    <main className="ob" ref={screenRef} onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeUp} onPointerCancel={onEdgeUp}>
      <span className={`ob-halo ${step === 'ready' ? 'bloom' : ''}`} aria-hidden="true" />
      {qIndex >= 0 ? (
        <FrameBar steps={QUESTIONS.length} index={qIndex} canBack={canBack} onBack={back} />
      ) : step === 'tour' ? (
        // the tour has its own dots over its button, so the bar carries Back and Skip only; both end on the reveal
        <header className="ob-bar">
          <span className="ob-slot">
            <button type="button" className="icon-btn ob-back" aria-label="Back" onClick={back}>
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          </span>
          <span aria-hidden="true" />
          <span className="ob-slot end">
            <Pressable className="ob-skip" press="dim" onPress={back}>
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

// ---------- the payoff: the plan being written, then the reveal ----------
/**
 * The last step. First the build beat ("Writing your plan": it waits only as long as the save really takes), then the
 * reveal: Today as a stack of posters made of the answers. With a plan it is the training card with the first session and
 * the morning's times; with no plan (or Fitness off) the day poster with the goal Today will suggest; under it the habits
 * as tiles and tonight's Journal row. One Sky button, "Open Today" (the hand-off, `handoff.ts`), and one quiet link,
 * "See how Orby works" (the tour, which comes back here). The success haptic lands as the stack arrives; under Reduce
 * Motion it fades in.
 */
function Payoff({ draft, set, profile, start, today, seen, onOpen, onChange, onTour }: { draft: Draft; set: (p: Partial<Draft>) => void; /** null: no running plan */ profile: TrainingProfile | null; start: ISODate; today: ISODate; /** the reveal was already shown in this visit (back from the tour) */ seen: React.RefObject<boolean>; onOpen: () => void; /** Back to the questions: the way out when the server refuses an answer. */ onChange: () => void; onTour: () => void }) {
  const reduce = useReducedMotion();
  const onboard = useSaveOnboarding();
  const [waiting, setWaiting] = useState(false);
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
  const open = () => {
    if (!done) return setWaiting(true);
    onOpen();
  };
  // pressed while the plan was still being written: go as soon as it lands
  useEffect(() => {
    if (waiting && done) {
      setWaiting(false);
      onOpen();
    }
  }, [waiting, done]); // eslint-disable-line react-hooks/exhaustive-deps

  // the plan being written: once per first run (a reload after it saved, or the way back from the tour, opens straight
  // on the reveal)
  const [back] = useState(() => seen.current);
  const [phase, setPhase] = useState<'build' | 'reveal'>(saved || back ? 'reveal' : 'build');
  const shape = useMemo(() => (profile ? blockShape(safeTemplate(profile, start)) : null), [profile, start]);
  // each selected habit once: the list already holds the ones typed (onboarding-22)
  const habitCount = answers.habits.length;
  const steps = useMemo(() => buildSteps(profile, shape, draft.wake, draft.leave, habitCount), [profile, shape, draft.wake, draft.leave, habitCount]);
  const reveal = useCallback(() => {
    setPhase('reveal');
    // the one haptic of the arrival, as the stack comes in
    haptics.success();
  }, []);
  useEffect(() => {
    if (phase === 'reveal') seen.current = true;
  }, [phase, seen]);

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

  // ---------- the reveal ----------
  const card = profile ? trainPoster(week, plan) : null;
  const stops = profile ? morningStops({ week, wake: draft.wake, leave: draft.leave, afternoon }) : null;
  const minutes = readMinutes();
  const idea = firstIdea({ habits: habitCount, fitness: draft.fitness !== false, minutes });
  const tiles = revealTiles(answers.habits);
  const said = [
    card && stops ? `${card.name}, ${card.line}. ${stops.said}. ${card.said}` : `What would make today count? ${idea ? `An idea: ${idea.text}.` : 'Set today’s goal.'}`,
    habitCount ? `${habitCount === 1 ? 'One habit' : `${habitCount} habits`}: ${answers.habits.join(', ')}.` : '',
    'Tonight’s line in the Journal.',
  ]
    .filter(Boolean)
    .join(' ');
  // each part of the stack comes up in turn (transform and opacity only); back from the tour, or under Reduce Motion, no travel
  const rise = (i: number) =>
    back
      ? { initial: false as const }
      : reduce
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
        : { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { ...springs.page, delay: 0.06 + i * 0.09 } };
  return (
    <div className="ob-step ob-payoff ob-reveal">
      <header className="ob-rv-head">
        <motion.h1 className="ob-pay-title display" tabIndex={-1} {...rise(0)}>
          {profile ? 'Your first day.' : 'Today is ready.'}
        </motion.h1>
        <motion.p className="ob-lede" {...rise(0)}>
          {replay ? (draft.fitness === false ? 'A preview. Nothing was changed.' : 'A preview. Your plan and habits weren’t changed.') : profile ? 'Made from your answers. Change any of it later.' : draft.fitness === false ? 'Made from your answers. Change any of it later.' : 'No running plan for now. Add one any time from Fitness.'}
        </motion.p>
      </header>

      {/* Today, as it will be: a picture, so VoiceOver gets it in one sentence and nothing in it takes a tap */}
      <div className="ob-rv-stack" role="img" aria-label={said}>
        <div className="ob-rv-in" aria-hidden="true" inert>
          <motion.div className="ob-rv-part" {...rise(1)}>
            {card && stops ? <TrainingPoster name={card.name} line={stops.line === card.line ? card.line : [week.firstWhen, stops.line].filter(Boolean).join(' · ')} scene={card.scene} stops={stops.stops} /> : <DayPoster idea={idea} minutes={minutes} />}
          </motion.div>
          {tiles.shown.length ? (
            <motion.div className="ob-rv-part" {...rise(2)}>
              <HabitTiles names={tiles.shown} today={today} empty={null} />
              {tiles.more ? <p className="obp-more">And {tiles.more} more on Today.</p> : null}
            </motion.div>
          ) : null}
          <motion.div className="ob-rv-part" {...rise(3)}>
            <TonightPoster />
          </motion.div>
        </div>
      </div>

      <div className="ob-foot ob-pay-foot">
        {onboard.isError ? (
          <p className="ob-pay-sum" role="alert">
            <span className="ob-err">
              {draft.fitness === false ? 'Couldn’t save your answers.' : 'Couldn’t save your plan.'} {reason}
            </span>
          </p>
        ) : null}
        {onboard.isError ? (
          retry
        ) : (
          <>
            <Pressable className="btn primary block ob-cta" onPress={open} disabled={waiting}>
              {waiting ? 'One moment…' : 'Open Today'}
            </Pressable>
            <QuietLink onPress={onTour}>See how Orby works</QuietLink>
          </>
        )}
      </div>
    </div>
  );
}
