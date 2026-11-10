import { fmtDate, mondayOf, shiftDays, today as todayISO, weekdayOf, type Goal, type ISODate, type Weekday } from '@logbook/shared';
import { Check, ChevronLeft, Clock } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { FirstRunHero, type FirstRunAction } from '@/features/day/FirstRunHero';
import { useBootstrap, useHabitMutations, useMorningMutations, useOnboard, useSetName } from '@/api/queries';
import { useNav } from '@/app/NavController';
import type { OnboardingAnswers } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis } from '@/lib/gesture';
import { crossfade, fadeIn, springs } from '@/lib/motion';
import { EmptyState, Pressable, useSheet, useToast } from '@/ui';
import { DayLetters, GoalChips, HabitPicker, MilesDial, MorningTrack, RaceStrip } from './controls';
import { blockShape, buildSteps, DEFAULT_LEAVE, DEFAULT_MILES, STARTER_HABITS, DEFAULT_PROFILE, DEFAULT_WAKE, defaultRaceDay, firstWeek, fixLongRun, goalLong, hm, MILES_MAX, MILES_MIN, previewMorning, ROUTINE_CHIPS, routineFrom, routineNames, routineSettings, routineTotal, safeTemplate, snap5, TRACK_FROM, type TrainingProfile } from './model';
import { BlockPreview, BuildBeat, NudgeChoice, SetupBar } from './beats';
import { endReplay, isReplaying } from './replay';
import { DEFAULT_AFTERNOON, setAfternoon, setTrainWhenDefault } from '@/features/day/trainWhen';
import { Stepper } from '@/ui/primitives';
import { Tour } from './tour/Tour';
import { enableReminders, remindersSupported } from '@/features/goals/reminders';
import { handOff } from './handoff';
import { StravaPrimer } from './StravaPrimer';
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
 * Every answer lives in sessionStorage per account, so a reload lands on the same step with the same answers. Back is the
 * chevron, the browser's back, or an edge swipe from the left. An account that has finished (onboardedAt set) never sees
 * this, unless it is in the middle of its own payoff.
 */

type Step = '' | 'name' | 'goal' | 'days' | 'morning' | 'habits' | 'nudge' | 'tour' | 'ready';
/** The nudge step only where a nudge can be sent (the iOS app); the web has the dot on Goals. */
const QUESTIONS: Step[] = ['name', 'goal', 'days', 'morning', 'habits', ...(remindersSupported() ? (['nudge'] as Step[]) : []), 'tour'];
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
  // Settings → Replay setup: the same flow as a preview, saving nothing
  if (user.onboardedAt && !ending && !isReplaying()) return <Navigate to="/today" replace />;
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
  useSplashDoneOnPaint();
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
  const shape = useMemo(() => blockShape(safeTemplate(profile, start)), [profile.goal, profile.raceDate, profile.runDays.join(), profile.longRunDay, profile.weeklyMiles, start]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // guards: questions need the promise first only in spirit; later steps need a goal
  if (!ORDER.includes(step) || step === '') return <Navigate to="/welcome/name" replace />;
  if (idx > ORDER.indexOf('goal') && !d.goal) return <Navigate to="/welcome/goal" replace />;

  const qIndex = QUESTIONS.indexOf(step);
  const next = () => go(ORDER[idx + 1]!);

  const bodyFor = (step: Step): React.ReactNode => {
  let body: React.ReactNode;
  switch (step) {
    case 'name':
      body = (
        <Question title="What should Logbook call you?" sub="Your first name is plenty. The coach and your mornings use it." onNext={next} nextLabel={d.name?.trim() ? 'Next' : 'Skip for now'} later="You can change it in Settings.">
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
    case 'goal':
      body = (
        <Question title="What are you training for?" sub="Pick one. A race gets a taper; just running gets a steady build." onNext={next} nextDisabled={!d.goal}>
          <GoalChips
            value={d.goal}
            onChange={(g) => {
              set({ goal: g, raceDate: undefined, weeklyMiles: d.milesTouched ? d.weeklyMiles : DEFAULT_MILES[g] });
              // the answer does something at once: the screen glides to the race day and the block it builds
              setTimeout(() => screenRef.current?.querySelector('.ob-stage[data-step="goal"] .obx-block')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }), 90);
            }}
          />
          <AnimatePresence initial={false}>
            {d.goal && d.goal !== 'base' ? (
              <motion.div key="race" className="card ob-card ob-race-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
                <p className="ob-q-label">
                  Race day <span className="ob-q-value">{profile.raceDate ? fmtDate('short', profile.raceDate) : 'Not set'}</span>
                </p>
                <RaceStrip start={start} value={profile.raceDate} onChange={(r) => set({ raceDate: r })} />
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
        <Question title="Which days can you run?" sub="Tap a day to run it. Hold one to make it the long run." onNext={next}>
          <div className="card ob-card">
            <DayLetters runDays={d.runDays} longRunDay={fixLongRun(d.runDays, d.longRunDay)} onChange={(runDays, longRunDay) => set({ runDays, longRunDay })} />
          </div>
          <div className="card ob-card ob-miles-card">
            <p className="ob-q-label ob-miles-label">About how much do you run now?</p>
            <MilesDial value={d.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => set({ weeklyMiles: v, milesTouched: true })} />
            <p className="ob-hint">
              {d.runDays.length} {d.runDays.length === 1 ? 'run' : 'runs'} a week. {d.goal && d.goal !== 'base' ? `Your ${goalLong(d.goal)} plan` : 'Your plan'} builds from here, about 10% a week.
            </p>
          </div>
          <BlockPreview shape={shape} compact />
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
        <Question title="When do you wake, and leave for work?" sub="Drag the two markers. Logbook plans your morning around them." onNext={next}>
          {/* when they usually train: Today's training card starts from it (Morning, or Afternoon from the end of work) */}
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
            {d.trainWhen === 'afternoon' ? (
              <div className="ob-offwork">
                <span>Work ends</span>
                <Stepper value={d.offWork ?? DEFAULT_AFTERNOON.offWork} onChange={(v) => set({ offWork: v })} step={15} min={11 * 60} max={21 * 60} format={(v) => hm(v)} parse={() => null} label="Work ends" />
              </div>
            ) : null}
          </div>
          <div className="card ob-card ob-track-card">
            <MorningTrack wake={d.wake} leave={d.leave} settings={st} onChange={(wake, leave) => set({ wake, leave })} />
          </div>
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
                  {on ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : null}
                  {c.label}
                </Pressable>
              );
            })}
          </div>
          </div>
          <div className="card ob-card ob-verdict" aria-live="polite">
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
        <Question title="A few lights for every day." sub="Pick any, or none. They become the lights you tap on Today." onNext={next} nextLabel={QUESTIONS.at(-1) === 'habits' ? 'Build my week' : 'Next'} later="You can add or change habits any time.">
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
          sub="People who pick a time to be reminded stick with it longer. Logbook sends one, only on days with no goal yet."
          onNext={() => {
            // the system alert comes from Continue, after the choice was made here; a "No nudges" never sees it
            if (on) void enableReminders().catch(() => undefined);
            next();
          }}
          nextLabel="Next"
          later="Turn it off any time in Goals."
        >
          <NudgeChoice on={on} at={d.wake + 15} onChange={(v) => set({ nudge: v })} />
        </Question>
      );
      break;
    }
    case 'tour':
      body = <Tour page={d.tourPage ?? 0} onPage={(n) => set({ tourPage: n })} onDone={next} />;
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
    endReplay();
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
              one-frame cut; hidden, they are inert (out of the tab order, the accessibility tree and hit-testing). The fade is
              the slot's, so each keeps its own press (review 3 code N8) */}
          <span className={`ob-slot ${canBack ? '' : 'is-gone'}`} inert={!canBack}>
            <button type="button" className="icon-btn ob-back" aria-label="Back" onClick={canBack ? back : undefined}>
              <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </span>
          <SetupBar steps={QUESTIONS.length} index={qIndex} />
          <span className={`ob-slot end ${step !== 'goal' ? '' : 'is-gone'}`} inert={step === 'goal'}>
            <Pressable className="ob-skip" press="dim" onPress={step !== 'goal' ? next : () => undefined}>
              Skip
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
function Question({ title, sub, children, onNext, nextDisabled, nextLabel = 'Next', later = 'You can change this later in Settings.' }: { title: string; sub: string; children: React.ReactNode; onNext: () => void; nextDisabled?: boolean; nextLabel?: string; later?: string | null }) {
  return (
    <div className="ob-step ob-question">
      <h1 className="ob-title display">{title}</h1>
      <p className="ob-sub">{sub}</p>
      <div className="ob-body">{children}</div>
      <div className="ob-foot">
        {later ? <p className="ob-later">{later}</p> : null}
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
  const setName = useSetName();
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
  // a replay from Settings saves nothing: the account already has its plan
  const replay = useMemo(() => isReplaying(), []);
  const send = () => {
    if (replay) return;
    ss.set(PAYOFF_KEY, '1');
    onboard.mutate(answers, {
      onSuccess: (r) => {
        // the routine the chips made (the server takes wake and leave; the blocks between are the morning's own setting)
        morning.settings.mutate({ after: { ...routine, names: routineNames(draft.routine ?? []), showerMode: 'fixed', showerAt: Math.max(draft.wake, draft.leave - routineTotal(routine)) } });
        // the answers are on the account now (POST /me/onboarding stores them as the training profile)
        set({ sent: key, firstDay: r.firstDay });
        // the rest of the profile: the name, and when they train (Today's training card starts from it)
        const name = (draft.name ?? '').trim();
        if (name) setName.mutate(name);
        setTrainWhenDefault(draft.trainWhen ?? 'morning');
        if (draft.trainWhen === 'afternoon') setAfternoon({ offWork: draft.offWork ?? DEFAULT_AFTERNOON.offWork });
      },
      onError: () => haptics.error(),
    });
  };
  useEffect(() => {
    if (!saved && !onboard.isPending) send();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = replay || saved || onboard.isSuccess;
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

  // the plan being written: once per first run (a reload after it saved opens straight on the payoff)
  const [phase, setPhase] = useState<'build' | 'reveal'>(saved ? 'reveal' : 'build');
  const shape = useMemo(() => blockShape(safeTemplate(profile, start)), [profile, start]);
  const steps = useMemo(() => buildSteps(profile, shape, draft.wake, draft.leave, draft.habits.length + draft.custom.length), [profile, shape, draft.wake, draft.leave, draft.habits.length, draft.custom.length]);
  const reveal = useCallback(() => {
    setPhase('reveal');
    haptics.success();
  }, []);

  const first = week.first;
  const m = week.morning;
  const fade = reduce ? { duration: 0.15 } : { ...springs.page };
  if (phase === 'build')
    return (
      <div className="ob-step ob-payoff is-building">
        <BuildBeat steps={steps} ready={done} failed={onboard.isError} onDone={reveal} />
        {onboard.isError ? (
          <div className="ob-pay-foot">
            <Pressable className="btn primary block ob-cta" onPress={send}>
              Try again
            </Pressable>
          </div>
        ) : null}
      </div>
    );
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
          ) : replay ? (
            <>
              <Check size={16} strokeWidth={2.6} aria-hidden="true" className="ob-ok" />
              Preview only. Your plan and habits weren’t changed.
            </>
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
