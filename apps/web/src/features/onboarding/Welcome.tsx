import { fmtDate, shiftDays, today as todayISO, weekdayOf, type Goal, type ISODate, type Weekday } from '@logbook/shared';
import { Check, ChevronLeft, Clock } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useBootstrap, useMorningMutations, useOnboard } from '@/api/queries';
import type { OnboardingAnswers } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs } from '@/lib/motion';
import { LogoMark } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { DayLetters, GoalChips, HabitPicker, MilesDial, MorningTrack, RaceStrip } from './controls';
import { DEFAULT_LEAVE, DEFAULT_MILES, DEFAULT_PROFILE, DEFAULT_WAKE, defaultRaceDay, firstWeek, fixLongRun, goalLong, hm, MILES_MAX, MILES_MIN, previewMorning, ROUTINE_CHIPS, routineFrom, routineSettings, routineTotal, snap5, TRACK_FROM, type TrainingProfile } from './model';
import { StravaPrimer } from './StravaPrimer';
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
 *   /welcome/ready    the payoff: POST /me/onboarding, the first week, "Tomorrow: Easy 4. Out the door 6:50."
 *   /welcome/strava   the primer, only when this server can connect Strava and the account is not connected
 *
 * Every answer lives in sessionStorage per account, so a reload lands on the same step with the same answers. Back is the
 * chevron, the browser's back, or an edge swipe from the left. An account that has finished (onboardedAt set) never sees
 * this, unless it is in the middle of its own payoff.
 */

type Step = '' | 'goal' | 'days' | 'morning' | 'habits' | 'ready' | 'strava';
const QUESTIONS: Step[] = ['goal', 'days', 'morning', 'habits'];
const ORDER: Step[] = ['', ...QUESTIONS, 'ready', 'strava'];

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
  const ending = /^(ready|strava)/.test(params['*'] ?? '') && !!ss.get(PAYOFF_KEY);
  if (user.onboardedAt && !ending) return <Navigate to="/today" replace />;
  return <Flow uid={user.id} />;
}

function Flow({ uid }: { uid: string }) {
  const nav = useNavigate();
  const params = useParams();
  const reduce = useReducedMotion();
  const step = ((params['*'] ?? '').split('/')[0] ?? '') as Step;
  const [d, set] = useDraft(uid);
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
    if (i <= ORDER.indexOf('goal') || step === 'ready' || step === 'strava') return;
    go(ORDER[i - 1]!, true);
  };

  // the edge swipe: a touch from the left 24px drags the step (1:1), and past 35% of the width or a fling goes back.
  // Document listeners, like PushedPage, so a horizontal move can be claimed before the browser pans.
  const x = useMotionValue(0);
  const canBack = idx > ORDER.indexOf('goal') && step !== 'ready' && step !== 'strava';
  const backRef = useRef(back);
  backRef.current = back;
  const canRef = useRef(canBack);
  canRef.current = canBack;
  useEffect(() => {
    let g: null | { x0: number; y0: number; lock: null | 'x' | 'y'; samples: Array<[number, number]> } = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      g = e.touches.length === 1 && t && t.clientX <= 24 && canRef.current && !document.querySelector('.sheet-wrap, .cm-layer') ? { x0: t.clientX, y0: t.clientY, lock: null, samples: [[t.clientX, performance.now()]] } : null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!g || !t) return;
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (!g.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        g.lock = dx > Math.abs(dy) ? 'x' : 'y';
      }
      if (g.lock !== 'x') return;
      if (e.cancelable) e.preventDefault();
      x.set(Math.max(0, dx));
      g.samples.push([t.clientX, performance.now()]);
      if (g.samples.length > 6) g.samples.shift();
    };
    const onEnd = () => {
      const st = g;
      g = null;
      if (!st || st.lock !== 'x') return;
      const [ax, at] = st.samples[0]!;
      const [bx, bt] = st.samples[st.samples.length - 1]!;
      const v = bt > at ? ((bx - ax) / (bt - at)) * 1000 : 0;
      if (x.get() > window.innerWidth * 0.35 || v > 500) {
        x.set(0);
        backRef.current();
      } else animate(x, 0, reduce ? { duration: 0 } : { ...springs.settle, velocity: v });
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [x, reduce]);

  // guards: questions need the promise first only in spirit; later steps need a goal
  if (!ORDER.includes(step) || step === '') return <Navigate to="/welcome/goal" replace />;
  if (idx > ORDER.indexOf('goal') && !d.goal) return <Navigate to="/welcome/goal" replace />;

  const qIndex = QUESTIONS.indexOf(step);
  const next = () => go(ORDER[idx + 1]!);

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
              <motion.div key="race" className="ob-race-block" initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={reduce ? fadeIn : springs.settle}>
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
      body = <Payoff uid={uid} draft={d} set={set} profile={profile} start={start} today={t} onDone={(strava) => (strava ? go('strava') : finish())} />;
      break;
    case 'strava':
      body = (
        <div className="ob-step ob-strava">
          <StravaPrimer variant="screen" onLater={() => finish()} onConnect={() => clearAll()} />
        </div>
      );
      break;
  }

  function clearAll() {
    ss.del(draftKey(uid));
    ss.del(PAYOFF_KEY);
  }
  function finish() {
    clearAll();
    nav('/today', { replace: true });
  }

  return (
    <main className="ob">
      <span className={`ob-halo ${step === 'ready' ? 'bloom' : ''}`} aria-hidden="true" />
      {qIndex >= 0 ? (
        <header className="ob-top">
          {canBack ? (
            <button type="button" className="icon-btn ob-back" aria-label="Back" onClick={back}>
              <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <span className="ob-skip-space" />
          )}
          <div className="ob-dots" role="progressbar" aria-label="Setup" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={qIndex + 1} aria-valuetext={`Step ${qIndex + 1} of ${QUESTIONS.length}`}>
            {QUESTIONS.map((q, i) => (
              <span key={q} className={`ob-dot ${i === qIndex ? 'on' : i < qIndex ? 'done' : ''}`} />
            ))}
          </div>
          {step !== 'goal' ? (
            <button type="button" className="ob-skip" onClick={next}>
              Skip
            </button>
          ) : (
            <span className="ob-skip-space" />
          )}
        </header>
      ) : null}
      <motion.div className="ob-swipe" style={{ x }}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={step}
          className="ob-stage"
          custom={dir}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: dir * -48, transition: { ...springs.page, opacity: { duration: 0.1 } } }}
          transition={reduce ? { duration: 0.15 } : { ...springs.page, opacity: { duration: 0.12 } }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
      </motion.div>
    </main>
  );
}

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
function Payoff({ uid, draft, set, profile, start, today, onDone }: { uid: string; draft: Draft; set: (p: Partial<Draft>) => void; profile: TrainingProfile; start: ISODate; today: ISODate; onDone: (strava: boolean) => void }) {
  const reduce = useReducedMotion();
  const boot = useBootstrap();
  const onboard = useOnboard();
  const heroRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
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
        haptics.success();
        // the routine the chips made (the server takes wake and leave; the blocks between are the morning's own setting)
        morning.settings.mutate({ after: { ...routine, showerMode: 'fixed', showerAt: Math.max(draft.wake, draft.leave - routineTotal(routine)) } });
        // the answers are on the account now (POST /me/onboarding stores them as the training profile)
        set({ sent: key, firstDay: r.firstDay });
      },
      onError: () => haptics.error(),
    });
  };
  useEffect(() => {
    if (!saved && !onboard.isPending) send();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strava = !!boot.data?.features.strava && !boot.data?.strava.connected;
  const done = saved || onboard.isSuccess;
  const leave = () => {
    if (!done) {
      setWaiting(true);
      return;
    }
    if (strava) return onDone(true);
    // the shared move into Today: the week falls away and the hero rises to where Today's hero sits
    const top = heroRef.current?.getBoundingClientRect().top ?? 0;
    setLeaving(reduce ? 0 : Math.min(0, 112 - top));
    setTimeout(() => onDone(false), reduce ? 120 : 340);
  };
  // pressed while the plan was still being written: go as soon as it lands
  useEffect(() => {
    if (waiting && done) {
      setWaiting(false);
      leave();
    }
  }, [waiting, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = week.first;
  const firstLong = week.template?.sessions.find((x) => /long/i.test(x.type)) ?? null;
  const m = week.morning;
  return (
    <div className="ob-step ob-payoff">
      <motion.div
        ref={heroRef}
        className="ob-pay-hero"
        animate={leaving != null ? { y: leaving, scale: 0.98 } : { y: 0, scale: 1 }}
        transition={reduce ? { duration: 0 } : springs.page}
      >
        <motion.span className="caps ob-pay-eyebrow" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fadeIn}>
          {week.template ? week.template.name : 'Your first week'}
        </motion.span>
        <motion.h1 className="ob-pay-title display" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : { ...springs.page, delay: 0.1 }}>
          {first ? `${week.firstWhen}: ${week.days.find((x) => x.session === first)?.label ?? 'Easy'}.` : 'Your week is ready.'}
        </motion.h1>
        {m ? (
          <motion.p className="ob-pay-door display" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : { ...springs.page, delay: 0.22 }}>
            Out the door {hm(m.door)}.
          </motion.p>
        ) : null}
      </motion.div>

      <motion.ol className="ob-week" aria-label="Your first week" initial={reduce ? false : { opacity: 0, y: 24 }} animate={leaving != null ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 1, y: 0 }} transition={reduce ? fadeIn : { ...springs.page, delay: 0.32 }}>
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
                  <motion.span className="ob-wbar-fill" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: bar }} transition={reduce ? { duration: 0 } : { ...springs.number, delay: 0.45 }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </motion.ol>

      <motion.div className="ob-pay-foot" animate={leaving != null ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 1 }}>
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
          <Pressable className="btn primary block ob-cta" onPress={leave} disabled={waiting}>
            {waiting ? 'One moment…' : strava ? 'Next' : 'Open Today'}
          </Pressable>
        )}
        {firstLong ? <p className="ob-pay-note">{`First long run: ${fmtDate('short', firstLong.date)}, ${firstLong.miles} mi. Everything moves with a drag in Plan.`}</p> : null}
      </motion.div>
    </div>
  );
}
