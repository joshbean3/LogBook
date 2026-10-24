import { AFTER_ORDER, durationWords, fmtDate, label, monthOf, num, routineOf, shiftDays, type MorningSettings, type MorningTimeline, type Session } from '@logbook/shared';
import { Briefcase, SlidersHorizontal } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useRouteParams } from '@/app/NavController';
import { useMorningMutations, useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { ChipButton, DatePager, DayStepper, dayCaption, Skeleton, SkeletonGroup, TabHeader, useToast } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { MiniLine } from './MiniLine';
import { morningOf, ROUTINE_DEFAULTS, short, takeLegacyOrder, timeParts, useNowMinutes } from './model';
import { RoutineEditor } from './RoutineEditor';
import { Schedule, type ScheduleActions } from './Schedule';
import { fullOrder, GapEditor, removal, StartEditor, StepEditor, WakeEditor } from './StepSheets';
import './morning.css';

/** The planned session a morning is built from, when there is one left to skip. */
const skippable = (sessions: Session[], T: MorningTimeline) => {
  const kind = T.day.mode === 'run' ? 'run' : T.day.mode === 'gym' ? 'lift' : T.day.plan.mode === 'run' ? 'run' : T.day.plan.mode === 'gym' ? 'lift' : null;
  return kind ? (sessions.find((s) => s.kind === kind && !s.mark) ?? null) : null;
};

/** The late note's three fixes (spec §4.1): the alarm is the morning's, the miles and the skip are the session's. */
interface LateFixes {
  /** `{ wake }` for this date. */
  wake: (wake: number) => void;
  /** A session upsert with these miles (null when the day has no run session). */
  miles: ((miles: number) => void) | null;
  /** The run session marked 'skip' (null when there is none). */
  skipRun: (() => void) | null;
}

/** When the routine runs past the shower: say by how much, and offer the two fixes as one-tap chips. */
const LateNote = ({ T, fix }: { T: MorningTimeline; fix: LateFixes }) => {
  if (!T.late || !T.fix) return null;
  const miles = T.fix.maxMiles != null ? Math.floor(T.fix.maxMiles * 2) / 2 : null;
  const wake = Math.floor(T.fix.latestWake / 5) * 5;
  const run = miles == null ? null : miles >= 0.5 ? (fix.miles ? () => fix.miles!(miles) : null) : fix.skipRun;
  return (
    <div className="m-late" role="note">
      <p>
        Back at {short(T.back)}, {T.late} min past the {short(T.settings.after.showerAt)} routine. You leave at {short(T.leave)}.
      </p>
      <div className="m-late-fixes">
        <ChipButton
          onClick={() => {
            haptics.toggle();
            fix.wake(wake);
          }}
        >
          Wake {short(wake)}
        </ChipButton>
        {miles != null && run ? (
          <ChipButton
            onClick={() => {
              haptics.toggle();
              run();
            }}
          >
            {miles >= 0.5 ? `Run ${num(miles)} mi` : 'Skip the run'}
          </ChipButton>
        ) : null}
      </div>
    </div>
  );
};

/** The endpoint: when you leave, stamped, pinned to the bottom of the screen until the timeline reaches it. */
const LeaveBar = ({ T, isToday, now, onPress }: { T: MorningTimeline; isToday: boolean; now: number; onPress?: () => void }) => {
  const t = timeParts(T.leave);
  const gone = isToday && now >= T.leave;
  const sub = T.late ? `${T.late} min later than your routine` : isToday && !gone ? (now >= T.day.wake - 180 ? `In ${durationWords(Math.ceil(T.leave - now))}` : null) : gone ? 'Out for the day' : `${durationWords(T.leave - T.day.wake)} after the alarm`;
  return (
    <button type="button" className={`m-leave ${gone ? 'past' : ''} ${T.late ? 'late' : ''}`} onClick={onPress} disabled={!onPress} aria-label={`Leave for work at ${t.v} ${t.u}.${sub ? ` ${sub}.` : ''}${onPress ? ' Edit the routine.' : ''}`}>
      <span className="m-leave-glow" aria-hidden="true" />
      <span className="m-leave-axis" aria-hidden="true">
        <Briefcase size={16} />
      </span>
      <span className="m-leave-text">
        <span className="m-leave-label">Leave for work</span>
        {sub ? <span className="m-leave-sub">{sub}</span> : null}
      </span>
      <span className="stamp m-leave-time">
        {t.v}
        <small>{t.u}</small>
      </span>
    </button>
  );
};

/** One day's page inside the pager: the stops at a glance, the late note, the schedule, the leave bar. Neighbours render it inert. */
const DayPage = ({ date, log, st, now, interactive, actions }: { date: string; log: Log; st: MorningSettings; now: number; interactive: boolean; actions?: (T: MorningTimeline) => ScheduleActions & { late: LateFixes } }) => {
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), [log.snap, date, st]);
  const isToday = date === log.today;
  const a = interactive ? actions?.(T) : undefined;
  const before = isToday && now < T.day.wake;
  return (
    <div className={`m-day m-${T.day.mode}`}>
      <MiniLine T={T} className="m-sum" />
      {interactive && a ? <LateNote T={T} fix={a.late} /> : null}
      {before ? (
        <p className="m-pre">
          <i className="now-dot now-pulse" aria-hidden="true" />
          Alarm in {durationWords(Math.ceil(T.day.wake - now))}
        </p>
      ) : null}
      <Schedule T={T} isToday={isToday} now={now} interactive={interactive} actions={a} />
      <LeaveBar T={T} isToday={isToday} now={now} />
    </div>
  );
};

const MorningSkeleton = () => (
  <SkeletonGroup label="Loading the morning">
    <div className="m-skel">
      <Skeleton h={44} r="control" />
      {[56, 44, 64, 44, 56, 56, 56, 56].map((h, i) => (
        <Skeleton key={i} h={h} r="control" />
      ))}
    </div>
  </SkeletonGroup>
);

/**
 * Morning, a tab of its own: the schedule from the alarm to the door. The fixed part (the alarm, the way out, the workout,
 * the way back) opens this morning's editors; the routine after it is yours to arrange: hold a step and drag it, tap it to
 * change it, add your own. The arrows in the corner (or a swipe) step through the days ahead; the Timings link at the
 * foot holds what every morning shares (the pace, the gym's walk, the wake-up routine for each kind of morning).
 */
export default function MorningView() {
  // the pushed entry's params (contracts §F): `/today/:date/morning`
  const params = useRouteParams();
  const nav = useNavigate();
  const loc = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [...new Set([monthOf(shiftDays(date, -1)), monthOf(date), monthOf(shiftDays(date, 1))])], [date]);
  const log = useLog(months);
  const now = useNowMinutes();
  const st = log.boot?.morningSettings ?? ROUTINE_DEFAULTS;
  const { setDay, settings } = useMorningMutations();
  const { mark, upsert } = useSessionMutations();
  const openSession = useOpenSession(log);
  // the dev clock (?at=) rides along when the day changes; a day step replaces the entry, so Back never walks the days
  const go = (d: string) => nav(`${d === t ? '/morning' : `/morning/${d}`}${loc.search}`, { replace: true });

  // Opened by pulling the Today hero down: Morning drops in from above instead of cutting in.
  const reduce = useReducedMotion();
  const enterPull = useRef((loc.state as { enter?: string } | null)?.enter === 'pull' && !reduce).current;
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), [log.snap, date, st]);
  const ready = !!log.boot && log.loaded(date);
  // a back-home order this device kept before the server had `after.order` goes up once, unless the account already has one
  const serverOrder = log.boot?.morningSettings.after.order;
  useEffect(() => {
    if (!log.boot) return;
    const legacy = takeLegacyOrder();
    if (legacy && (!serverOrder || serverOrder.join() === AFTER_ORDER.join()) && legacy.join() !== AFTER_ORDER.join()) settings.mutate({ after: { order: legacy } });
  }, [!!log.boot]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayName = (d: string) => (d === t ? 'today' : d === shiftDays(t, 1) ? 'tomorrow' : fmtDate('dowLong', d));
  const editTimings = (DT: MorningTimeline, focus?: string) => sheet.open({ eyebrow: 'Every morning', title: 'Timings', detent: 'large', body: <RoutineEditor day={DT.day} settings={DT.settings} focus={focus} /> });

  const actionsFor =
    (d: string) =>
    (DT: MorningTimeline): ScheduleActions & { late: LateFixes } => {
      const sessions = log.snap.sessionsOn(d);
      const s = skippable(sessions, DT);
      // the session the morning's workout is (spec §4.3: the session is the run), skipped or not
      const workout = s ?? sessions.find((x) => x.kind === 'run') ?? sessions.find((x) => x.kind === 'lift') ?? null;
      const run = sessions.find((x) => x.kind === 'run' && !x.mark) ?? null;
      // the day's workouts still to do, and the ones skipped from it (what "Back to the plan" un-skips)
      const open = sessions.filter((x) => (x.kind === 'run' || x.kind === 'lift') && !x.mark);
      const skipped = sessions.filter((x) => (x.kind === 'run' || x.kind === 'lift') && x.mark === 'skip');
      const remark = (list: Session[], m: Session['mark']) => list.forEach((x) => mark.mutate({ session: x, mark: m }));
      const eyebrow = `Morning · ${fmtDate('md', d)}`;
      const editWake = () => sheet.open({ eyebrow, title: 'Alarm', body: <WakeEditor settings={DT.settings} day={DT.day} date={d} dayName={dayName(d)} /> });
      return {
        // one editor (M16): the run is the session, so the workout opens the session sheet; a morning with none, its alarm
        editDay: () => (workout ? openSession(d, workout) : editWake()),
        editWake,
        editGap: () => sheet.open({ eyebrow: 'Every morning', title: DT.day.mode === 'gym' ? 'The walk' : 'Door and cool-down', body: <GapEditor settings={DT.settings} day={DT.day} /> }),
        editStart: () => sheet.open({ eyebrow: 'Every morning', title: 'Routine starts', body: <StartEditor settings={DT.settings} day={DT.day} /> }),
        editStep: (k) => {
          const name = routineOf(DT.settings).find((r) => r.key === k)?.name ?? 'Step';
          sheet.open({ eyebrow: 'Your routine', title: name, body: <StepEditor settings={DT.settings} day={DT.day} stepKey={k} /> });
        },
        addStep: () => sheet.open({ eyebrow: 'Your routine', title: 'Add a step', body: <StepEditor settings={DT.settings} day={DT.day} /> }),
        removeStep: (k) => {
          const name = routineOf(DT.settings).find((r) => r.key === k)?.name ?? 'Step';
          const r = removal(DT.settings, k);
          settings.mutate({ after: r.off });
          haptics.delete();
          toast(`${name} removed`, { label: 'Undo', fn: () => settings.mutate({ after: r.undo }) });
        },
        saveOrder: (visible) => settings.mutate({ after: { order: fullOrder(DT.settings, visible) } }),
        skipLabel: s ? label(s) : null,
        skip: () => {
          if (!s) return;
          const prev = s.mark;
          // the session is the run: skipping it is the one write, and the morning (its alarm included) follows
          mark.mutate({ session: s, mark: 'skip' });
          haptics.toggle();
          toast(`${label(s)} skipped`, { label: 'Undo', fn: () => mark.mutate({ session: s, mark: prev }) });
        },
        // a rest day: every workout of the day skipped (Skip takes the one in the row)
        rest: () => {
          if (!open.length) return;
          remark(open, 'skip');
          haptics.toggle();
          toast('Rest morning', { label: 'Undo', fn: () => remark(open, null) });
        },
        backLabel: DT.day.mode === 'rest' && skipped.length ? label(skipped[0]!) : null,
        backToPlan: () => {
          if (!skipped.length) return;
          remark(skipped, null);
          haptics.toggle();
          toast(`Back to ${label(skipped[0]!)}`, { label: 'Undo', fn: () => remark(skipped, 'skip') });
        },
        late: {
          wake: (wake) => setDay.mutate({ date: d, day: { wake } }),
          miles: run ? (miles) => upsert.mutate({ id: run.id, date: run.date, kind: run.kind, type: run.type, title: run.title, details: run.details, miles, minutes: run.minutes }) : null,
          skipRun: run ? () => mark.mutate({ session: run, mark: 'skip' }) : null,
        },
      };
    };

  // the timings' deep link (Settings → Morning routine): /morning?routine=1 (or /morning/routine) opens Morning with the
  // sheet up; the address then drops the flag, so Back and a reload land on the page itself
  const [sp] = useSearchParams();
  const wantsRoutine = sp.get('routine') === '1' || params.date === 'routine';
  useEffect(() => {
    if (!ready || !wantsRoutine) return;
    editTimings(T);
    const rest = new URLSearchParams(sp);
    rest.delete('routine');
    const q = rest.toString();
    nav(`/morning${q ? `?${q}` : ''}`, { replace: true });
  }, [ready, wantsRoutine]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div className="page m-page" initial={enterPull ? { y: -Math.round(window.innerHeight * 0.3), opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ y: springs.page, opacity: { duration: 0.12 } }}>
      <TabHeader title="Morning" date={dayCaption(date, t)} onDateStep={(dir) => go(shiftDays(date, dir))} accessory={<DayStepper date={date} today={t} onGo={go} />} />
      {!ready ? (
        <MorningSkeleton />
      ) : (
        <DatePager
          className="m-pager"
          date={date}
          onChange={go}
          label="Morning"
          prevLabel="Previous morning"
          nextLabel="Next morning"
          render={(d) => <DayPage key={d} date={d} log={log} st={st} now={now} interactive={d === date} actions={d === date ? actionsFor(d) : undefined} />}
        />
      )}
      {ready ? (
        <button type="button" className="m-timings" onClick={() => editTimings(T)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Timings for every morning
        </button>
      ) : null}
    </motion.div>
  );
}
