import { fmtDate, mi, mondayOf, monthsBetween, shiftDays, weekSummary, type Activity } from '@logbook/shared';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNav } from '@/app/NavController';
import { useAllLifts } from '@/api/queries';
import { EmptyState, Pressable, SkeletonRows, Ticker, useSheet, WeekRing } from '@/ui';
import { ringDays, streakLine } from '../day/dayWords';
import { useLog, type Log } from '../log/useLog';
import { useMonthsFailed } from '../plan/LoadFail';
import { weekMiles } from '../sessions/miles';
import { sessionSheetTitle, UnplannedSheet, usePushSession } from '../sessions/SessionCard';
import { LineChart, Spark } from './charts';
import { easyPace, liftGroups, liftValue, paceText, plural, setWords, signedPct, weekTitle, type EasyPace, type LiftGroup, type Range, rangePhrase } from './data';
import { miShort } from './hero';
import { dayRange } from '@/ui/charts/range';

const up = (s: string) => s.toUpperCase();
const md = (d: string) => fmtDate('md', d);

/** A caps label over a stamped number: the sheets' stat. */
export const Stamp = ({ label: l, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: ReactNode }) => (
  <div className="pg-stamp">
    <span className="caps">{l}</span>
    <span className="pg-stamp-num">
      {value}
      {unit ? <small>{unit}</small> : null}
    </span>
    {note ? <span className="pg-stamp-note">{note}</span> : null}
  </div>
);

/** One row of an edge-to-edge list inside a sheet: the whole row is the button. */
const SheetRow = ({ lead, title, sub, right, onPress, label: l }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onPress?: () => void; label?: string }) => {
  const body = (
    <>
      {lead}
      <span className="pg-srow-main">
        <span className="pg-srow-title">{title}</span>
        {sub ? <span className="pg-srow-sub">{sub}</span> : null}
      </span>
      {right ? <span className="pg-srow-right">{right}</span> : null}
      {onPress ? <ChevronRight size={16} className="pg-chev" aria-hidden="true" /> : null}
    </>
  );
  return onPress ? (
    <Pressable className="pg-srow" press="surface" onPress={onPress} label={l}>
      {body}
    </Pressable>
  ) : (
    <div className="pg-srow quiet">{body}</div>
  );
};

/** Open whatever a run belongs to: its planned session's sheet, or the run on its own, pushed inside this sheet. */
const useOpenRun = (log: Log) => {
  const sheet = useSheet();
  const openSession = usePushSession(log);
  return (a: Pick<Activity, 'date'>) => {
    const s = log.snap.sessionsOn(a.date).find((x) => x.kind === 'run');
    if (s) openSession(a.date, s);
    else sheet.push({ title: sessionSheetTitle(a.date), body: <UnplannedSheet date={a.date} runs={log.snap.runsOn(a.date)} log={log} />, wide: true });
  };
};

// ---------- the week ----------
/**
 * The week: the app's one week sheet, behind a week on the chart here and the week ring on Today. The ring, miles and runs
 * against the plan (zeros included for a week that had one), the streak in weeks ("You kept 7 of the last 8 weeks.") on this week, and one row that opens the week in Plan (the day
 * list lives there, so the sheet never repeats it).
 */
export const WeekSheet = ({ w, today, onGone }: { w: string; today: string; onGone?: () => void }) => {
  const gone = useRef(onGone);
  useEffect(() => () => gone.current?.(), []);
  const current = w === mondayOf(today);
  // this week's streak looks back eight weeks: load those months too
  const months = useMemo(() => monthsBetween(current ? shiftDays(w, -7 * 8) : w, shiftDays(w, 6)), [w, current]);
  const log = useLog(months);
  const nav = useNav();
  const sheet = useSheet();
  const sum = weekSummary(log.snap, w);
  // miles run count a run marked Done without Strava at its planned miles (contract 5)
  const ran = weekMiles(log.snap, w, today);
  // "You kept 7 of the last 8 weeks.": the count gets its subject (the shared line is the bare count)
  const streak = current ? (streakLine(log.snap, today)?.replace(/^(\d+ of the last \d+ weeks\.)$/, 'You kept $1') ?? null) : null;
  const future = w > mondayOf(today);
  const training = sum.days.reduce((n, d) => n + log.snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest').length, 0);
  // a week ahead with nothing in it is an invitation, never "0 runs planned / 0 mi"
  if ((future || current) && !training && ran.runs === 0)
    return (
      <div className="pg-sheet">
        <EmptyState
          verb={{
            label: 'Plan a week',
            primary: true,
            // a jump closes the sheet itself (nav.go closes overlays first) and cuts to Plan at that week
            onPress: () => nav.go(`/plan/week/${w}`),
          }}
        >
          Nothing planned yet. Lay out the runs and this week fills in as you do them.
        </EmptyState>
      </div>
    );
  // a past week with nothing planned and nothing run has nothing to grade: say so, plainly
  if (!future && !current && !training && ran.runs === 0 && ran.miles === 0)
    return (
      <div className="pg-sheet">
        <EmptyState>Nothing planned or logged this week.</EmptyState>
      </div>
    );
  // a week with nothing run yet leads with its plan, never with a zero
  const ahead = future || (current && ran.miles === 0 && ran.runs === 0 && sum.plannedMiles > 0);
  const ti = current ? sum.days.findIndex((d) => d.date === today) : undefined;
  const keptLine = future
    ? sum.runsPlanned
      ? `${sum.runsPlanned} ${plural(sum.runsPlanned, 'run')} planned.`
      : `${training} ${plural(training, 'session')} planned.`
    : sum.kept
      ? 'The week counts.'
      : current
        ? `${Math.max(0, sum.target - sum.keptSessions)} more ${plural(sum.target - sum.keptSessions, 'session')} for the week to count.`
        : `${sum.keptSessions} of ${sum.target} ${plural(sum.target, 'session')} done. ${sum.target} ${plural(sum.target, 'makes', 'make')} the week count.`;
  // the seven days live in Plan (the same list, with drag and swipe): one row takes you there instead of repeating it
  // §1.3: a 0 ms cut to Plan already at that week; one Back returns to Progress with the sheet closed
  const openInPlan = () => nav.go(`/plan/week/${w}`);
  return (
    <div className="pg-sheet">
      <div className="pg-week-top">
        {/* the numeral is the sentence's number (review 2 feel N4): the sessions that keep the week, never the runs (the
            Runs stamp says those), so the ring and the words beside it agree */}
        <WeekRing days={ringDays(sum, today)} size={64} today={ti != null && ti >= 0 ? ti : undefined} onceADay={null}>
          {future ? '' : sum.keptSessions || ''}
        </WeekRing>
        <div className="pg-week-words">
          <p className="pg-week-line">{keptLine}</p>
          {streak ? <p className="pg-week-streak">{streak}</p> : null}
          <div className="pg-stamps two">
            {ahead ? (
              <>
                {sum.plannedMiles ? <Stamp label="Planned" value={miShort(sum.plannedMiles)} unit="mi" note={current ? 'None run yet' : undefined} /> : null}
                {sum.runsPlanned ? <Stamp label="Runs" value={sum.runsPlanned} note={current ? 'Planned' : undefined} /> : null}
              </>
            ) : ran.miles > 0 || ran.runs || sum.plannedMiles > 0 || sum.runsPlanned ? (
              // a week with a plan always shows both numbers, zeros included (`0 mi of 18.8 planned`, `0 of 4 planned`)
              <>
                <Stamp label="Miles" value={miShort(ran.miles)} unit="mi" note={sum.plannedMiles ? `of ${miShort(sum.plannedMiles)} planned` : ran.logged ? 'Logged by hand' : undefined} />
                <Stamp label="Runs" value={sum.runsPlanned ? sum.runsDone : ran.runs} note={sum.runsPlanned ? `of ${sum.runsPlanned} planned` : undefined} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="list-edge pg-list">
        <SheetRow lead={<CalendarDays size={18} className="pg-srow-icon" aria-hidden="true" />} title="Open this week in Fitness" onPress={openInPlan} label="Open this week in Fitness" />
      </div>
    </div>
  );
};

/** Open the week sheet with the title travelling from `fromId` (the readout's week label carries `data-shared`). */
export const useOpenWeek = (today: string) => {
  const sheet = useSheet();
  return (w: string, how: 'open' | 'push' = 'open', onGone?: () => void) =>
    sheet[how]({ title: weekTitle(w, today), eyebrow: up(dayRange(w, shiftDays(w, 6))), body: <WeekSheet w={w} today={today} onGone={onGone} />, wide: true });
};

// ---------- easy pace ----------
const BASIS: Record<EasyPace['basis'], string> = {
  planned: 'Easy runs are the ones planned as Easy or Long.',
  zones: 'Easy runs: planned Easy and Long runs, and unplanned runs that averaged zone 2 or under.',
  hr: 'Easy runs: planned Easy and Long runs, and unplanned runs at or under your usual heart rate.',
  pace: 'Easy runs: planned Easy and Long runs, and the slower half of unplanned runs.',
};
export const paceChange = (now: number | null, then: number | null) => {
  if (now == null || then == null) return null;
  const d = Math.round(then - now);
  if (Math.abs(d) < 3) return 'level';
  return d > 0 ? `${d} s faster` : `${-d} s slower`;
};
/**
 * Easy runs, one by one. The sheet reads its own months (the range it shows), so it fills in when they land instead of
 * keeping what the page had at the tap: rows of skeletons while a month is on the way, Try again if one could not be read.
 */
export const EasyPaceSheet = ({ from, today, range }: { from: string; today: string; range: Range }) => {
  const months = useMemo(() => monthsBetween(from, today), [from, today]);
  const log = useLog(months);
  const fail = useMonthsFailed(months);
  const ready = months.every((m) => log.snap.loaded(m));
  const ep = useMemo(() => easyPace(log.snap, from, today, log.zones), [log.snap, log.zones, from, today]);
  if (!ready && fail.failed) return <SheetFail what="Couldn’t load your runs." onRetry={fail.retry} />;
  if (!ready) return <SheetWait label="Loading your runs" />;
  return <EasyPaceBody ep={ep} log={log} range={range} />;
};
const EasyPaceBody = ({ ep, log, range }: { ep: EasyPace; log: Log; range: Range }) => {
  const openRun = useOpenRun(log);
  const pts = ep.runs.map((r) => ({ key: r.a.id, label: md(r.a.date), y: r.pace }));
  const ch = paceChange(ep.now, ep.then);
  // pace needs a run with a time: runs marked done by hand have none
  if (!ep.runs.length)
    return (
      <div className="pg-sheet">
        <EmptyState>No timed runs yet. Runs synced from a watch show their pace here.</EmptyState>
      </div>
    );
  return (
    <div className="pg-sheet">
      <LineChart
        label="Pace of each easy run"
        points={pts}
        invert
        steps={[5, 10, 15, 20, 30, 60, 120, 300]}
        format={paceText}
        onTap={(i) => ep.runs[i] && openRun(ep.runs[i]!.a)}
        readout={(i) => {
          if (i == null)
            return (
              <div className="pg-stamps two">
                <Stamp label="Easy pace now" value={ep.now != null ? paceText(ep.now) : '–'} unit="/mi" note={ch ? (ch === 'level' ? `Level with ${ep.thenMonth}` : `${ch} than ${ep.thenMonth}`) : `${ep.runs.length} easy ${plural(ep.runs.length, 'run')} ${rangePhrase(range)}`} />
                {ep.nowHr != null ? <Stamp label="Heart rate" value={Math.round(ep.nowHr)} unit="bpm" note="Average on those runs" /> : null}
              </div>
            );
          const r = ep.runs[i]!;
          return (
            <div className="pg-stamps two">
              <Stamp label={fmtDate('short', r.a.date)} value={paceText(r.pace)} unit="/mi" note={`${mi(r.a.miles)} mi · ${r.a.name}`} />
              {r.hr != null ? <Stamp label="Heart rate" value={<Ticker value={r.hr} />} unit="bpm" /> : null}
            </div>
          );
        }}
      />
      <p className="pg-note">{BASIS[ep.basis]} Faster is higher on the chart.</p>
      <div className="list-edge pg-list">
        {[...ep.runs]
          .reverse()
          .slice(0, 14)
          .map((r) => (
            <SheetRow
              key={r.a.id}
              title={fmtDate('short', r.a.date)}
              sub={`${mi(r.a.miles)} mi${r.hr != null ? ` · ${r.hr} bpm` : ''}`}
              right={
                <span className="pg-row-num">
                  {paceText(r.pace)}
                  <small>/mi</small>
                </span>
              }
              onPress={() => openRun(r.a)}
              label={`${fmtDate('long', r.a.date)}, ${mi(r.a.miles)} miles at ${paceText(r.pace)} a mile${r.hr != null ? `, ${r.hr} beats per minute` : ''}. Open`}
            />
          ))}
      </div>
    </div>
  );
};

// ---------- lifts ----------
export const LiftSheet = ({ g }: { g: LiftGroup }) => {
  const pts = g.days.map((d) => ({ key: d.date, label: md(d.date), y: liftValue(g, d) }));
  let best: number | null = null;
  pts.forEach((p, i) => {
    if (best == null || p.y > pts[best]!.y) best = i;
  });
  const top = best != null ? g.days[best]! : null;
  // a bodyweight lift reads in reps: there is no weight to estimate a max from
  const unit = g.reps ? 'reps' : 'e1RM';
  const bestLabel = g.reps ? 'Best set' : 'Best e1RM';
  const topValue = top ? Math.round(liftValue(g, top)) : '–';
  const topNote = top ? `${setWords(top)} · ${md(top.date)}` : undefined;
  return (
    <div className="pg-sheet">
      {g.days.length > 1 ? (
        <LineChart
          label={g.reps ? `${g.name}, best set’s reps by day` : `${g.name}, estimated one-rep max by day`}
          points={pts}
          format={(v) => String(Math.round(v))}
          readout={(i) => {
            if (i == null)
              return (
                <div className="pg-stamps two">
                  <Stamp label={bestLabel} value={topValue} unit={g.reps ? 'reps' : undefined} note={topNote} />
                  {g.change != null ? <Stamp label="Change" value={signedPct(g.change)} note={`Since ${md(g.days[0]!.date)}`} /> : null}
                </div>
              );
            const d = g.days[i]!;
            return (
              <div className="pg-stamps two">
                <Stamp label={fmtDate('short', d.date)} value={<Ticker value={liftValue(g, d)} />} unit={unit} note={setWords(d)} />
              </div>
            );
          }}
        />
      ) : (
        <div className="pg-stamps two">
          <Stamp label={g.reps ? 'Best set' : 'e1RM'} value={topValue} unit={g.reps ? 'reps' : undefined} note={topNote} />
        </div>
      )}
      <p className="pg-note">
        {g.days.length > 1 ? '' : 'The line draws from the second day you log it. '}
        {g.reps ? 'With no weight on it, the line follows the reps of your best set each day.' : 'e1RM estimates the most you could lift once, from your best set that day (weight × (1 + reps ÷ 30)).'}
      </p>
      <div className="list-edge pg-list">
        {[...g.days].reverse().map((d) => (
          <SheetRow
            key={d.date}
            title={fmtDate('short', d.date)}
            sub={g.reps ? 'Bodyweight' : `e1RM ${Math.round(d.e1rm)}`}
            right={
              g.reps ? (
                <span className="pg-row-num">
                  {d.reps}
                  <small>{plural(d.reps, 'rep')}</small>
                </span>
              ) : (
                <span className="pg-row-num">{setWords(d)}</span>
              )
            }
          />
        ))}
      </div>
    </div>
  );
};

/** What a sheet shows while its own history is on the way, or when it could not be read. */
const SheetWait = ({ label }: { label: string }) => (
  <div className="pg-sheet">
    <SkeletonRows rows={3} label={label} />
  </div>
);
const SheetFail = ({ what, onRetry }: { what: string; onRetry: () => void }) => (
  <div className="pg-sheet">
    <EmptyState verb={{ label: 'Try again', onPress: onRetry }}>{what}</EmptyState>
  </div>
);

/**
 * Each lift's line over the range. The sheet reads the lift history itself, so it fills in when the history lands (a sheet
 * opened before then showed "No lifts" for good): rows of skeletons while it is on the way, a line and Try again if it
 * could not be read, the empty state only once it is known to be empty.
 */
export const LiftsSheet = ({ from, today, range }: { from: string; today: string; range: Range }) => {
  const sheet = useSheet();
  const nav = useNav();
  const lifts = useAllLifts();
  const groups = useMemo(() => liftGroups(lifts.data ?? [], from, today), [lifts.data, from, today]);
  if (!lifts.data && lifts.isError) return <SheetFail what="Couldn’t load your lifts." onRetry={() => void lifts.refetch()} />;
  if (!lifts.data) return <SheetWait label="Loading your lifts" />;
  if (!groups.length)
    return (
      <div className="pg-sheet">
        <EmptyState
          ghost={<LiftGhost />}
          verb={{
            label: 'Open today',
            onPress: () => nav.go('/today'),
          }}
        >
          {`No lifts ${rangePhrase(range)}. Log a set from a lift session and its line starts here.`}
        </EmptyState>
      </div>
    );
  return (
    <div className="pg-sheet">
      <div className="list-edge pg-list">
        {groups.map((g) => {
          const last = g.days[g.days.length - 1]!;
          const value = Math.round(liftValue(g, last));
          const unit = g.reps ? 'reps' : 'e1RM';
          return (
            <SheetRow
              key={g.name}
              title={g.name}
              sub={`${g.days.length} ${plural(g.days.length, 'day')} · ${setWords(last)}, ${md(last.date)}`}
              right={
                <>
                  <Spark values={g.days.map((d) => liftValue(g, d))} />
                  <span className="pg-num-col">
                    <span className="pg-row-num">{value}</span>
                    <span className="caps">{g.change == null ? unit : signedPct(g.change)}</span>
                  </span>
                </>
              }
              onPress={() => sheet.push({ title: g.name, eyebrow: 'Lift', body: <LiftSheet g={g} /> })}
              // the printed words first: the name, then its line
              label={`${g.name}. ${g.days.length} ${plural(g.days.length, 'day')}, ${setWords(last)}, ${md(last.date)}. ${g.reps ? `Best set ${value} reps` : `Estimated one-rep max ${value}`}${g.change != null ? `, ${signedPct(g.change)}` : ''}. Open`}
            />
          );
        })}
      </div>
    </div>
  );
};
const LiftGhost = () => (
  <svg viewBox="0 0 300 90" width="100%" height={90} aria-hidden="true">
    <path d="M6,74 L60,66 L114,60 L168,48 L222,40 L294,22" className="pg-line-path" />
    {[6, 60, 114, 168, 222, 294].map((x, i) => (
      <circle key={x} cx={x} cy={[74, 66, 60, 48, 40, 22][i]} r={3} className="pg-line-dot" />
    ))}
  </svg>
);
