import { AFTER_ORDER, durationWords, fmtDate, label, MORNING_DEFAULTS, monthOf, num, relativeDay, shiftDays, type MorningSettings, type MorningTimeline, type Session } from '@logbook/shared';
import { Briefcase, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMorningMutations, useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { ChipButton, DatePager, IconButton, PushedHeader, Skeleton, SkeletonGroup, dateLine, useToast } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { DayEditor } from './DayEditor';
import { clamp, morningOf, short, takeLegacyOrder, timeParts, useNowMinutes, type DayPatch } from './model';
import { RoutineEditor } from './RoutineEditor';
import { Timeline, type BlockActions } from './Timeline';
import './morning.css';

/** Pixels a minute: the usual morning fills the screen between the header and the tab bar; never so small a 5-minute block can't be read. */
const usePx = (span: number) => {
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 844 : window.innerHeight));
  useEffect(() => {
    const f = () => setVh(window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return clamp((vh - 256) / Math.max(120, span), 3.6, 6);
};

/** The planned session a morning is built from, when there is one left to skip. */
const skippable = (sessions: Session[], T: MorningTimeline) => {
  const kind = T.day.mode === 'run' ? 'run' : T.day.mode === 'gym' ? 'lift' : T.day.plan.mode === 'run' ? 'run' : T.day.plan.mode === 'gym' ? 'lift' : null;
  return kind ? (sessions.find((s) => s.kind === kind && !s.mark) ?? null) : null;
};

/** When the routine runs past the shower: say by how much, and offer the two fixes as one-tap chips. */
const LateNote = ({ T, onFix }: { T: MorningTimeline; onFix: (p: DayPatch) => void }) => {
  if (!T.late || !T.fix) return null;
  const miles = T.fix.maxMiles != null ? Math.floor(T.fix.maxMiles * 2) / 2 : null;
  return (
    <div className="m-late" role="note">
      <p>
        Back at {short(T.back)}, {T.late} min past the {short(T.settings.after.showerAt)} routine. You leave at {short(T.leave)}.
      </p>
      <div className="m-late-fixes">
        <ChipButton
          onClick={() => {
            haptics.toggle();
            onFix({ wake: Math.floor(T.fix!.latestWake / 5) * 5 });
          }}
        >
          Wake {short(Math.floor(T.fix.latestWake / 5) * 5)}
        </ChipButton>
        {miles != null ? (
          <ChipButton
            onClick={() => {
              haptics.toggle();
              onFix(miles >= 0.5 ? { miles } : { mode: 'rest', type: 'Rest' });
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

/** One day's page inside the pager: the late note, the timeline, the leave bar. Neighbours render it inert. */
const DayPage = ({ date, log, st, px, now, interactive, actions }: { date: string; log: Log; st: MorningSettings; px: number; now: number; interactive: boolean; actions?: (T: MorningTimeline) => BlockActions }) => {
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), [log.snap, date, st]);
  const isToday = date === log.today;
  const a = interactive ? actions?.(T) : undefined;
  const before = isToday && now < T.day.wake;
  return (
    <div className={`m-day m-${T.day.mode}`}>
      {interactive ? <LateNote T={T} onFix={(p) => a?.setDay(p)} /> : null}
      {before ? (
        <p className="m-pre">
          <i className="now-dot now-pulse" aria-hidden="true" />
          Alarm in {durationWords(Math.ceil(T.day.wake - now))}
        </p>
      ) : null}
      <Timeline T={T} px={px} isToday={isToday} now={now} interactive={interactive} actions={a} footer={(TT) => <LeaveBar T={TT} isToday={isToday} now={now} onPress={a ? () => a.editRoutine('start') : undefined} />} />
    </div>
  );
};

const MorningSkeleton = () => (
  <SkeletonGroup label="Loading the morning">
    <div className="m-skel">
      {[56, 20, 170, 20, 70, 58, 58, 20, 58].map((h, i) => (
        <Skeleton key={i} h={h} r="control" />
      ))}
    </div>
  </SkeletonGroup>
);

/**
 * Morning (spec §5.2), pushed from Today. The page is the timeline: swipe it for another day, drag its grips to bend the
 * morning, hold a block for its menu, tap the routine button (or Edit routine in any menu) for the routine editor.
 */
export default function MorningView() {
  const params = useParams();
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
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const { setDay, settings } = useMorningMutations();
  const { mark } = useSessionMutations();
  // the dev clock (?at=) rides along when the day changes
  const go = (d: string) => nav(`${d === t ? '/morning' : `/morning/${d}`}${loc.search}`);
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), [log.snap, date, st]);
  const px = usePx(T.leave - Math.min(st.wake, T.day.wake));
  const ready = !!log.boot && log.loaded(date);
  // a back-home order this device kept before the server had `after.order` goes up once, unless the account already has one
  const serverOrder = log.boot?.morningSettings.after.order;
  useEffect(() => {
    if (!log.boot) return;
    const legacy = takeLegacyOrder();
    if (legacy && (!serverOrder || serverOrder.join() === AFTER_ORDER.join()) && legacy.join() !== AFTER_ORDER.join()) settings.mutate({ after: { order: legacy } });
  }, [!!log.boot]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionsFor =
    (d: string) =>
    (DT: MorningTimeline): BlockActions => {
      const sessions = log.snap.sessionsOn(d);
      const s = skippable(sessions, DT);
      const override = log.snap.morningOverride(d);
      const write = (patch: DayPatch) => {
        const x = DT.day;
        setDay.mutate({ date: d, day: { mode: x.mode, type: x.type, miles: x.miles, minutes: x.minutes, wake: x.wake, ...patch } });
      };
      const restore = () => setDay.mutate({ date: d, day: override ?? null });
      return {
        setDay: write,
        editDay: () => sheet.open({ eyebrow: `Morning · ${fmtDate('md', d)}`, title: fmtDate('dowLong', d), body: <DayEditor date={d} /> }),
        editRoutine: (focus) => sheet.open({ eyebrow: 'Every morning', title: 'Routine', detent: 'large', body: <RoutineEditor day={DT.day} settings={DT.settings} focus={focus} /> }),
        skipLabel: s ? label(s) : null,
        skip: () => {
          if (!s) return;
          const prev = s.mark;
          mark.mutate({ session: s, mark: 'skip' });
          // a morning the athlete reshaped keeps its alarm, and loses the workout with the session
          if (DT.day.own && DT.day.mode !== 'rest') write({ mode: 'rest', type: 'Rest' });
          haptics.toggle();
          toast(`${label(s)} skipped`, {
            label: 'Undo',
            fn: () => {
              mark.mutate({ session: s, mark: prev });
              if (DT.day.own) restore();
            },
          });
        },
        rest: () => {
          write({ mode: 'rest', type: 'Rest' });
          haptics.toggle();
          toast('Rest morning', { label: 'Undo', fn: restore });
        },
        backLabel: DT.day.mode === 'rest' && DT.day.own && DT.day.plan.mode !== 'rest' ? DT.day.plan.label || 'the plan' : null,
        backToPlan: () => {
          setDay.mutate({ date: d, day: null });
          haptics.toggle();
          toast(`Back to ${DT.day.plan.label || 'the plan'}`, { label: 'Undo', fn: restore });
        },
      };
    };

  // the routine editor's deep link (Settings → Morning routine): /morning?routine=1 (or /morning/routine) opens Morning with
  // the editor up; the address then drops the flag, so Back and a reload land on the page itself
  const [sp] = useSearchParams();
  const wantsRoutine = sp.get('routine') === '1' || params.date === 'routine';
  useEffect(() => {
    if (!ready || !wantsRoutine) return;
    actionsFor(date)(T).editRoutine();
    const rest = new URLSearchParams(sp);
    rest.delete('routine');
    const q = rest.toString();
    nav(`/morning${q ? `?${q}` : ''}`, { replace: true });
  }, [ready, wantsRoutine]); // eslint-disable-line react-hooks/exhaustive-deps

  const rel = relativeDay(date, t);
  const eyebrow =
    rel === 'Today' || rel === 'Tomorrow' || rel === 'Yesterday' ? (
      <>
        <span className={rel === 'Today' ? '' : 'm-rel'}>{rel} · </span>
        {dateLine(date)}
      </>
    ) : (
      dateLine(date)
    );
  return (
    <div className="page m-page">
      <PushedHeader
        title="Morning"
        eyebrow={eyebrow}
        right={
          <>
            {date !== t ? (
              <ChipButton quiet className="m-today" onClick={() => go(t)}>
                Today
              </ChipButton>
            ) : null}
            <IconButton label="Edit routine" onClick={() => actionsFor(date)(T).editRoutine()}>
              <SlidersHorizontal size={20} aria-hidden="true" />
            </IconButton>
          </>
        }
      />
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
          render={(d) => <DayPage key={d} date={d} log={log} st={st} px={px} now={now} interactive={d === date} actions={d === date ? actionsFor(d) : undefined} />}
        />
      )}
    </div>
  );
}
