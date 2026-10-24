import { AFTER_ORDER, fmtDate, label, monthOf, routineOf, shiftDays, type MorningTimeline, type Session } from '@logbook/shared';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useMorningMutations, useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { dayCaption, Pressable, PushedBar, Skeleton, SkeletonGroup, useToast } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { useNowMinutes } from '../day/useNow';
import { useLog } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { justWord, morningOf, ROUTINE_DEFAULTS, rowsOf, takeLegacyOrder } from './model';
import { NowCard } from './NowCard';
import { useOpenRoutineEditor } from './RoutineEditor';
import { Schedule, type ScheduleActions } from './Schedule';
import { fullOrder, removal, StartEditor, StepEditor, WakeEditor } from './StepSheets';
import './morning.css';

/** The planned session a morning is built from, when there is one left to skip. */
const skippable = (sessions: Session[], T: MorningTimeline) => {
  const kind = T.day.mode === 'run' ? 'run' : T.day.mode === 'gym' ? 'lift' : T.day.plan.mode === 'run' ? 'run' : T.day.plan.mode === 'gym' ? 'lift' : null;
  return kind ? (sessions.find((s) => s.kind === kind && !s.mark) ?? null) : null;
};

/** The bar's title: `This morning` on today, the day's own morning otherwise (the eyebrow carries the date). */
const titleOf = (date: string, today: string) => (date === today ? 'This morning' : date === shiftDays(today, 1) ? 'Tomorrow morning' : date === shiftDays(today, -1) ? 'Yesterday morning' : `${fmtDate('dowLong', date)} morning`);

/** Run `fn` once the next frame has been painted. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

/** An alarm being dragged: the wake laid over the day, where the drag began, and whether the finger is still on it. */
interface AlarmDrag {
  wake: number;
  from: number;
  live: boolean;
}

const MorningSkeleton = () => (
  <SkeletonGroup label="Loading the morning">
    <div className="m-skel">
      <Skeleton h={96} r="card" />
      {[60, 60, 60, 60, 60, 60, 60].map((h, i) => (
        <Skeleton key={i} h={h} r="control" />
      ))}
    </div>
  </SkeletonGroup>
);

/**
 * This morning (spec §4), pushed over Today at `/today/:date/morning`: the bar (chevron, the title with the date as its
 * eyebrow, the routine's timings behind the trailing icon), the Now card where the hero's four-stop line lands, then the
 * morning as one group of 60 px rows from the alarm to the Leave row, and `+ Add a step`. Every row opens its own editor;
 * the Wake stamp drags the alarm (every time below follows on the same frame, one write on release); a step held 450 ms
 * lifts and can be dragged into place. A past morning is read-only; a future one is as editable as today's.
 */
export default function MorningView() {
  const params = useRouteParams();
  const sheet = useSheet();
  const toast = useToast();
  const base = useLog([]);
  const today = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const months = useMemo(() => [monthOf(date)], [date]);
  const log = useLog(months);
  const now = useNowMinutes();
  const st = log.boot?.morningSettings ?? ROUTINE_DEFAULTS;
  const { setDay, settings } = useMorningMutations();
  const { mark, upsert } = useSessionMutations();
  const openSession = useOpenSession(log);
  const openRoutine = useOpenRoutineEditor();
  const rel: 'past' | 'today' | 'future' = date < today ? 'past' : date === today ? 'today' : 'future';
  const interactive = rel !== 'past';

  // ---------- the alarm drag: the day re-laid from the dragged wake on every step ----------
  const [drag, setDrag] = useState<AlarmDrag | null>(null);
  const sessions = log.snap.sessionsOn(date);
  const override = log.snap.morningOverride(date);
  const T0 = useMemo(() => morningOf(sessions, override, st), [sessions, override, st]);
  const T = useMemo(() => (drag && drag.wake !== T0.day.wake ? morningOf(sessions, override, st, { wake: drag.wake }) : T0), [drag, T0, sessions, override, st]);
  const just = justWord(date, today, shiftDays(today, 1));
  const rows = useMemo(() => rowsOf(T, just, !!drag && drag.wake !== T0.day.wake), [T, just, drag, T0]);
  // the stamps the drag has moved (against where it began): lit while it moves, fading back to ink over 400 ms on release
  const moved = useMemo(() => {
    const out = new Set<string>();
    if (!drag?.live || drag.wake === drag.from) return out;
    const B = morningOf(sessions, override, st, { wake: drag.from });
    const was = new Map(rowsOf(B, just).map((r) => [r.id, r.at]));
    for (const r of rows) if (was.get(r.id) !== r.at) out.add(r.id);
    if (B.leave !== T.leave) out.add('leave');
    return out;
  }, [drag, rows, sessions, override, st, just, T.leave]);
  // released: the day keeps the dragged alarm until the cache has it (the write is optimistic), so nothing flickers back
  useEffect(() => {
    if (drag && !drag.live && (T0.day.wake === drag.wake || drag.wake === drag.from)) setDrag(null);
  }, [drag, T0.day.wake]);
  const onStep = useCallback((wake: number, from: number) => setDrag({ wake, from, live: true }), []);
  const onCommit = useCallback(
    (wake: number, from: number) => {
      setDrag(wake === from ? null : { wake, from, live: false });
      // the release frame paints first (the stamps start fading, the row settles): the write's optimistic month patch
      // re-renders every page that reads the month, Today's under this one included, and must not hold that frame back
      if (wake !== from) afterPaint(() => setDay.mutate({ date, day: { wake } }, { onError: () => setDrag(null) }));
    },
    [date, setDay],
  );
  const [alarmDragging, setAlarmDragging] = useState(false);

  // a back-home order this device kept before the server had `after.order` goes up once, unless the account already has one
  const serverOrder = log.boot?.morningSettings.after.order;
  useEffect(() => {
    if (!log.boot) return;
    const legacy = takeLegacyOrder();
    if (legacy && (!serverOrder || serverOrder.join() === AFTER_ORDER.join()) && legacy.join() !== AFTER_ORDER.join()) settings.mutate({ after: { order: legacy } });
  }, [!!log.boot]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!log.boot && log.loaded(date);
  const dayName = rel === 'today' ? 'today' : date === shiftDays(today, 1) ? 'tomorrow' : fmtDate('dowLong', date);

  const actions = ((): ScheduleActions | undefined => {
    if (!interactive) return undefined;
    const s = skippable(sessions, T0);
    // the session the morning's workout is (spec §4.3: the session is the run), skipped or not
    const workout = s ?? sessions.find((x) => x.kind === 'run') ?? sessions.find((x) => x.kind === 'lift') ?? null;
    const run = sessions.find((x) => x.kind === 'run' && !x.mark) ?? null;
    // the day's workouts still to do, and the ones skipped from it (what "Back to the plan" un-skips)
    const open = sessions.filter((x) => (x.kind === 'run' || x.kind === 'lift') && !x.mark);
    const skipped = sessions.filter((x) => (x.kind === 'run' || x.kind === 'lift') && x.mark === 'skip');
    const remark = (list: Session[], m: Session['mark']) => list.forEach((x) => mark.mutate({ session: x, mark: m }));
    const eyebrow = `Morning · ${fmtDate('md', date)}`;
    const editWake = () => sheet.open({ eyebrow, title: 'Alarm', body: <WakeEditor settings={T0.settings} day={T0.day} date={date} dayName={dayName} /> });
    return {
      // one editor (M16): the run is the session, so the workout opens the session sheet; a morning with none, its alarm
      editDay: () => (workout ? openSession(date, workout) : editWake()),
      editWake,
      editStart: () => sheet.open({ eyebrow: 'Every morning', title: 'Routine starts', body: <StartEditor settings={T0.settings} day={T0.day} /> }),
      editStep: (k) => {
        const name = routineOf(T0.settings).find((r) => r.key === k)?.name ?? 'Step';
        sheet.open({ eyebrow: 'Your routine', title: name, body: <StepEditor settings={T0.settings} day={T0.day} stepKey={k} /> });
      },
      addStep: () => sheet.open({ eyebrow: 'Your routine', title: 'Add a step', body: <StepEditor settings={T0.settings} day={T0.day} /> }),
      removeStep: (k) => {
        const name = routineOf(T0.settings).find((r) => r.key === k)?.name ?? 'Step';
        const r = removal(T0.settings, k);
        settings.mutate({ after: r.off });
        haptics.delete();
        toast(`${name} removed`, { label: 'Undo', fn: () => settings.mutate({ after: r.undo }) });
      },
      saveOrder: (visible) => settings.mutate({ after: { order: fullOrder(T0.settings, visible) } }),
      editLeave: () => openRoutine('leave'),
      skipLabel: s ? label(s) : null,
      // the session is the run: skipping it is the one write, and the morning (its alarm included) follows. No haptic (§11.4)
      skip: () => {
        if (!s) return;
        const prev = s.mark;
        mark.mutate({ session: s, mark: 'skip' });
        // raised once the morning has been re-laid, so it sits above the Leave row's new place
        afterPaint(() => toast(`${label(s)} skipped`, { label: 'Undo', fn: () => mark.mutate({ session: s, mark: prev }) }));
      },
      // a rest day: every workout of the day skipped (Skip takes the one in the row)
      rest: () => {
        if (!open.length) return;
        remark(open, 'skip');
        afterPaint(() => toast('Rest morning', { label: 'Undo', fn: () => remark(open, null) }));
      },
      backLabel: T0.day.mode === 'rest' && skipped.length ? label(skipped[0]!) : null,
      backToPlan: () => {
        if (!skipped.length) return;
        remark(skipped, null);
        afterPaint(() => toast(`Back to ${label(skipped[0]!)}`, { label: 'Undo', fn: () => remark(skipped, 'skip') }));
      },
      late: {
        wake: (wake) => setDay.mutate({ date, day: { wake } }),
        miles: run ? (miles) => upsert.mutate({ id: run.id, date: run.date, kind: run.kind, type: run.type, title: run.title, details: run.details, miles, minutes: run.minutes }) : null,
        skipRun: run ? () => mark.mutate({ session: run, mark: 'skip' }) : null,
      },
    };
  })();

  return (
    <div className={`page m-page is-${rel}`}>
      <PushedBar
        title={titleOf(date, today)}
        eyebrow={dayCaption(date, today)}
        trailing={
          <Pressable className="icon-btn" label="Timings for every morning" onPress={() => openRoutine()}>
            <SlidersHorizontal size={22} aria-hidden="true" />
          </Pressable>
        }
      />
      {!ready ? (
        <MorningSkeleton />
      ) : (
        <>
          <NowCard T={T} date={date} now={now} rel={rel} />
          <Schedule T={T} rows={rows} rel={rel} now={now} moved={moved} actions={actions} wake={{ onStep, onCommit, onDragging: setAlarmDragging, dragging: alarmDragging }} />
          {actions ? (
            <Pressable className="m-add" press="dim" onPress={actions.addStep}>
              <Plus size={22} aria-hidden="true" />
              Add a step
            </Pressable>
          ) : null}
        </>
      )}
    </div>
  );
}
