import { dayStatus, daysBetween, fmtDate, label, mi, mondayOf, monthsBetween, num, sessionKey, sessionWord, shiftDays, weekSummary, type Activity, type Session } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { haptics } from '@/lib/haptics';
import { EmptyState, Pressable, Ticker, useSheet, WeekRing } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { sessionSheetTitle, UnplannedSheet, useOpenSession } from '../sessions/SessionCard';
import { LineChart, Spark, useWidth } from './charts';
import { paceOfRun, paceText, pct, plural, signedPct, weekId, weekTitle, Words, type Adherence, type Consistency, type EasyPace, type LiftGroup, type LongRun, type Range, rangePhrase, rangeLabel } from './data';

const up = (s: string) => s.toUpperCase();
/** Mon–Sun weeks a block touches, and which of them today is in (1-based). */
const blockWeeks = (start: string, end: string) => Math.floor(daysBetween(mondayOf(start), mondayOf(end)) / 7) + 1;
const weeksSince = (start: string, today: string) => Math.floor(daysBetween(mondayOf(start), mondayOf(today)) / 7) + 1;
const md = (d: string) => fmtDate('md', d);

/** A caps label over a stamped number: the sheets' stat. */
export const Stamp = ({ label: l, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: ReactNode }) => (
  <div className="pg-stamp">
    <span className="caps">{l}</span>
    <span className="stamp pg-stamp-num">
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
    <Pressable className="pg-srow" pressScale={1} onPress={onPress} label={l}>
      {body}
    </Pressable>
  ) : (
    <div className="pg-srow quiet">{body}</div>
  );
};

/** Open whatever a run belongs to: its planned session's sheet, or the run on its own, pushed inside this sheet. */
const useOpenRun = (log: Log) => {
  const sheet = useSheet();
  const openSession = useOpenSession(log);
  return (a: Pick<Activity, 'date'>) => {
    const s = log.snap.sessionsOn(a.date).find((x) => x.kind === 'run');
    if (s) openSession(a.date, s);
    else sheet.push({ title: sessionSheetTitle(a.date), body: <UnplannedSheet date={a.date} runs={log.snap.runsOn(a.date)} log={log} />, wide: true });
  };
};

// ---------- the week ----------
const runs0 = (log: Log, w: string) => Array.from({ length: 7 }, (_, i) => log.snap.runsOn(shiftDays(w, i)).length).reduce((a, b) => a + b, 0);
const STATUS_CLASS: Record<string, string> = { done: 'ok', bonus: 'ok', floor: 'warn', missed: 'bad', skipped: 'quiet', rest: 'quiet', planned: 'quiet', today: 'today' };

/** The week behind a bar: the ring, miles against the plan, and every day; a session opens its sheet. */
export const WeekSheet = ({ w, today, onGone }: { w: string; today: string; onGone?: () => void }) => {
  const gone = useRef(onGone);
  useEffect(() => () => gone.current?.(), []);
  const months = useMemo(() => monthsBetween(w, shiftDays(w, 6)), [w]);
  const log = useLog(months);
  const openSession = useOpenSession(log);
  const openRun = useOpenRun(log);
  const sum = weekSummary(log.snap, w);
  const current = w === mondayOf(today);
  const future = w > mondayOf(today);
  // a week with nothing run yet leads with its plan, never with a zero
  const ahead = future || (current && sum.doneMiles === 0 && runs0(log, w) === 0 && sum.plannedMiles > 0);
  const ti = current ? sum.days.findIndex((d) => d.date === today) : undefined;
  const runs = sum.days.flatMap((d) => log.snap.runsOn(d.date));
  const keptLine = future
    ? `${sum.runsPlanned} ${plural(sum.runsPlanned, 'run')} planned.`
    : sum.kept
      ? 'Week kept.'
      : current
        ? `${Words(Math.max(0, sum.target - sum.keptSessions))} more ${plural(sum.target - sum.keptSessions, 'session keeps', 'sessions keep')} it.`
        : `${Words(sum.keptSessions)} of ${sum.target} kept.`;
  const rows: ReactNode[] = [];
  for (const d of sum.days) {
    const ss = log.snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest');
    const dayRuns = log.snap.runsOn(d.date);
    let first = true;
    // the day is named once; a second session that day sits under it
    const dayLead = () => {
      const show = first;
      first = false;
      return show ? lead : <span className="pg-day" aria-hidden="true" />;
    };
    const lead = (
      <span className={`pg-day ${d.date === today ? 'is-today' : ''}`}>
        <span className="caps">{fmtDate('dow', d.date)}</span>
        <span className="pg-day-n">{Number(d.date.slice(8))}</span>
      </span>
    );
    if (!ss.length && !dayRuns.length) {
      rows.push(<SheetRow key={d.date} lead={lead} title={<span className="ink3">{sessionWord(log.snap, d.date, null)}</span>} />);
      continue;
    }
    for (const s of ss) {
      const k = sessionKey(log.snap, d.date, s);
      const ran = s.kind === 'run' ? dayRuns.reduce((t, a) => t + a.miles, 0) : 0;
      const sub = s.kind === 'run' ? (ran ? `${mi(ran)} mi run${s.miles ? ` of ${num(s.miles)}` : ''}` : s.miles ? `${num(s.miles)} mi planned` : null) : s.details;
      rows.push(
        <SheetRow
          key={s.id}
          lead={dayLead()}
          title={label(s)}
          sub={sub}
          right={<span className={`pg-st ${STATUS_CLASS[k] ?? ''}`}>{sessionWord(log.snap, d.date, s)}</span>}
          onPress={() => openSession(d.date, s)}
          label={`${fmtDate('long', d.date)}, ${label(s)}, ${sessionWord(log.snap, d.date, s)}. Open`}
        />,
      );
    }
    if (!ss.some((s) => s.kind === 'run'))
      for (const a of dayRuns) {
        const p = paceOfRun(a);
        rows.push(
          <SheetRow
            key={a.id}
            lead={dayLead()}
            title={a.name}
            sub={`${mi(a.miles)} mi${p ? ` · ${paceText(p)} /mi` : ''}`}
            right={<span className="pg-st ok">Bonus</span>}
            onPress={() => openRun(a)}
            label={`${fmtDate('long', d.date)}, ${a.name}, ${mi(a.miles)} miles. Open`}
          />,
        );
      }
  }
  return (
    <div className="pg-sheet">
      <div className="pg-week-top">
        <WeekRing days={sum.days.map((d) => d.ring)} size={64} today={ti != null && ti >= 0 ? ti : undefined} onceADay={null}>
          {runs.length || ''}
        </WeekRing>
        <div className="pg-week-words">
          <p className="pg-week-line">{keptLine}</p>
          <div className="pg-stamps two">
            {ahead ? (
              <>
                <Stamp label="Planned" value={num(sum.plannedMiles)} unit="mi" note={current ? 'None run yet' : undefined} />
                <Stamp label="Runs" value={sum.runsPlanned} note={current ? 'Planned' : undefined} />
              </>
            ) : (
              <>
                <Stamp label="Miles" value={mi(sum.doneMiles)} unit="mi" note={sum.plannedMiles ? `of ${num(sum.plannedMiles)} planned` : undefined} />
                <Stamp label="Runs" value={runs.length} note={sum.runsPlanned ? `${sum.runsDone} of ${sum.runsPlanned} planned` : undefined} />
              </>
            )}
          </div>
        </div>
      </div>
      <div className="list-edge pg-list">{rows}</div>
    </div>
  );
};

/** Open the week sheet with the title travelling from `fromId` (the readout's week label carries `data-shared`). */
export const useOpenWeek = (today: string) => {
  const sheet = useSheet();
  return (w: string, how: 'open' | 'push' = 'open', onGone?: () => void) =>
    sheet[how]({ title: weekTitle(w, today), eyebrow: `${up(md(w))} – ${up(md(shiftDays(w, 6)))}`, layoutId: how === 'open' ? weekId(w) : undefined, body: <WeekSheet w={w} today={today} onGone={onGone} />, wide: true });
};

// ---------- plan adherence ----------
export const AdherenceSheet = ({ ad, today, range, log }: { ad: Adherence; today: string; range: Range; log: Log }) => {
  const openWeek = useOpenWeek(today);
  const nav = useNavigate();
  const sheet = useSheet();
  if (!ad.weeks.length)
    return (
      <div className="pg-sheet">
        <EmptyState
          ghost={<AdherenceGhost />}
          verb={{
            label: 'Make a plan',
            onPress: () => {
              sheet.close();
              nav('/plan/plans');
            },
          }}
        >
          Plan a block and this shows how much of it you keep, week by week.
        </EmptyState>
      </div>
    );
  const p = pct(ad.kept, ad.planned);
  return (
    <div className="pg-sheet">
      <div className="pg-stamps">
        <Stamp label="Kept" value={ad.kept} unit={`of ${ad.planned}`} note={ad.planned ? `${p}% of planned sessions` : 'Nothing due yet'} />
        {ad.block ? (
          <Stamp label="Block week" value={Math.min(blockWeeks(ad.block.start, ad.block.end), weeksSince(ad.block.start, today))} unit={`of ${blockWeeks(ad.block.start, ad.block.end)}`} note={`${md(ad.block.start)} – ${md(ad.block.end)}`} />
        ) : (
          <Stamp label="Weeks" value={ad.weeks.length} note={rangeLabel(range)} />
        )}
      </div>
      {ad.block?.summary ? <p className="pg-note">{ad.block.summary}</p> : null}
      <p className="pg-note">Kept means done, at the floor, or skipped for illness. Rest days count by lowering the bar. Today and later are still ahead.</p>
      <div className="list-edge pg-list">
        {[...ad.weeks].reverse().map((wk) => {
          const s = weekSummary(log.snap, wk.w);
          const r = wk.planned ? wk.kept / wk.planned : 0;
          return (
            <SheetRow
              key={wk.w}
              lead={<WeekRing days={s.days.map((d) => d.ring)} size={40} onceADay={null} />}
              title={weekTitle(wk.w, today)}
              sub={`${wk.kept} of ${wk.planned} kept${wk.ahead ? ` · ${wk.ahead} ahead` : ''}`}
              right={
                <span className="pg-meter" aria-hidden="true">
                  <i style={{ width: `${Math.round(r * 100)}%` } as CSSProperties} />
                </span>
              }
              onPress={() => openWeek(wk.w, 'push')}
              label={`${weekTitle(wk.w, today)}: ${wk.kept} of ${wk.planned} sessions kept${wk.ahead ? `, ${wk.ahead} still ahead` : ''}. Open week`}
            />
          );
        })}
      </div>
    </div>
  );
};
const AdherenceGhost = () => (
  <div className="list-edge pg-list">
    {[3, 2, 4].map((k, i) => (
      <div key={i} className="pg-srow quiet">
        <WeekRing days={['done', 'done', 'rest', 'done', 'floor', 'rest', i ? 'done' : 'future']} size={40} onceADay={null} />
        <span className="pg-srow-main">
          <span className="pg-srow-title">Week {3 - i}</span>
          <span className="pg-srow-sub">{k} of 4 kept</span>
        </span>
      </div>
    ))}
  </div>
);

// ---------- long run ----------
export const LongRunSheet = ({ lr, log, today }: { lr: LongRun; log: Log; today: string }) => {
  const openRun = useOpenRun(log);
  const pts = lr.points.map((p) => ({ key: p.w, label: up(md(p.w)), y: p.miles > 0 ? p.miles : null }));
  let best: number | null = null;
  pts.forEach((p, i) => {
    if (p.y != null && (best == null || p.y > pts[best]!.y!)) best = i;
  });
  const list = [...lr.points].reverse().filter((p) => p.run);
  return (
    <div className="pg-sheet">
      <LineChart
        label="Longest run each week"
        points={pts}
        best={best}
        format={(v) => `${Math.round(v)}`}
        onTap={(i) => {
          const r = lr.points[i]?.run;
          if (r) openRun(r);
        }}
        readout={(i) => {
          if (i == null)
            return (
              <div className="pg-stamps two">
                <Stamp label="Last 4 weeks" value={mi(lr.recent)} unit="mi" note={lr.recentRun ? `${lr.recentRun.name}, ${md(lr.recentRun.date)}` : undefined} />
                <Stamp label="Longest" value={mi(lr.peak?.miles ?? 0)} unit="mi" note={lr.peak ? md(lr.peak.date) : undefined} />
              </div>
            );
          const p = lr.points[i]!;
          return (
            <div className="pg-stamps two">
              <Stamp label={weekTitle(p.w, today)} value={<Ticker value={p.miles} format={mi} />} unit="mi" note={p.run ? `${p.run.name}, ${fmtDate('dow', p.run.date)}` : 'No run'} />
            </div>
          );
        }}
      />
      <div className="list-edge pg-list">
        {list.slice(0, 12).map((p) => (
          <SheetRow
            key={p.w}
            title={p.run!.name}
            sub={`${fmtDate('short', p.run!.date)}${paceOfRun(p.run!) ? ` · ${paceText(paceOfRun(p.run!)!)} /mi` : ''}`}
            right={
              <span className="stamp pg-row-num">
                {mi(p.miles)}
                <small>mi</small>
              </span>
            }
            onPress={() => openRun(p.run!)}
            label={`${fmtDate('long', p.run!.date)}, ${p.run!.name}, ${mi(p.miles)} miles. Open`}
          />
        ))}
      </div>
    </div>
  );
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
export const EasyPaceSheet = ({ ep, log, range }: { ep: EasyPace; log: Log; range: Range }) => {
  const openRun = useOpenRun(log);
  const pts = ep.runs.map((r) => ({ key: r.a.id, label: up(md(r.a.date)), y: r.pace }));
  let best: number | null = null;
  pts.forEach((p, i) => {
    if (best == null || p.y < pts[best]!.y) best = i;
  });
  const ch = paceChange(ep.now, ep.then);
  return (
    <div className="pg-sheet">
      <LineChart
        label="Pace of each easy run"
        points={pts}
        invert
        steps={[5, 10, 15, 20, 30, 60, 120, 300]}
        best={best}
        format={paceText}
        onTap={(i) => ep.runs[i] && openRun(ep.runs[i]!.a)}
        readout={(i) => {
          if (i == null)
            return (
              <div className="pg-stamps two">
                <Stamp label="Easy pace now" value={ep.now != null ? paceText(ep.now) : '—'} unit="/mi" note={ch ? (ch === 'level' ? `Level with ${ep.thenMonth}` : `${ch} than ${ep.thenMonth}`) : `${ep.runs.length} easy ${plural(ep.runs.length, 'run')} ${rangePhrase(range)}`} />
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
                <span className="stamp pg-row-num">
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
  const pts = g.days.map((d) => ({ key: d.date, label: up(md(d.date)), y: d.e1rm }));
  let best: number | null = null;
  pts.forEach((p, i) => {
    if (best == null || p.y > pts[best]!.y) best = i;
  });
  const top = best != null ? g.days[best]! : null;
  return (
    <div className="pg-sheet">
      {g.days.length > 1 ? (
      <LineChart
        label={`${g.name}, estimated one-rep max by day`}
        points={pts}
        best={best}
        format={(v) => String(Math.round(v))}
        readout={(i) => {
          if (i == null)
            return (
              <div className="pg-stamps two">
                <Stamp label="Best e1RM" value={top ? Math.round(top.e1rm) : '—'} note={top ? `${top.weight} × ${top.reps} · ${md(top.date)}` : undefined} />
                {g.change != null ? <Stamp label="Change" value={signedPct(g.change)} note={`Since ${md(g.days[0]!.date)}`} /> : null}
              </div>
            );
          const d = g.days[i]!;
          return (
            <div className="pg-stamps two">
              <Stamp label={fmtDate('short', d.date)} value={<Ticker value={d.e1rm} />} unit="e1RM" note={`${d.weight} × ${d.reps}`} />
            </div>
          );
        }}
      />
      ) : (
        <div className="pg-stamps two">
          <Stamp label="e1RM" value={top ? Math.round(top.e1rm) : '—'} note={top ? `${top.weight} × ${top.reps} · ${md(top.date)}` : undefined} />
        </div>
      )}
      <p className="pg-note">{g.days.length > 1 ? '' : 'The line draws from the second day you log it. '}e1RM estimates the most you could lift once, from your best set that day (weight × (1 + reps ÷ 30)).</p>
      <div className="list-edge pg-list">
        {[...g.days].reverse().map((d) => (
          <SheetRow
            key={d.date}
            title={fmtDate('short', d.date)}
            sub={`e1RM ${Math.round(d.e1rm)}`}
            right={
              <span className="stamp pg-row-num">
                {d.weight} × {d.reps}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
};

export const LiftsSheet = ({ groups, range }: { groups: LiftGroup[]; range: Range }) => {
  const sheet = useSheet();
  const nav = useNavigate();
  if (!groups.length)
    return (
      <div className="pg-sheet">
        <EmptyState
          ghost={<LiftGhost />}
          verb={{
            label: 'Open today',
            onPress: () => {
              sheet.close();
              nav('/today');
            },
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
          return (
            <SheetRow
              key={g.name}
              title={g.name}
              sub={`${g.days.length} ${plural(g.days.length, 'day')} · ${last.weight} × ${last.reps}, ${md(last.date)}`}
              right={
                <>
                  <Spark values={g.days.map((d) => d.e1rm)} />
                  <span className="pg-num-col">
                    <span className="stamp pg-row-num">{Math.round(last.e1rm)}</span>
                    <span className="caps">{g.change == null ? 'e1RM' : signedPct(g.change)}</span>
                  </span>
                </>
              }
              onPress={() => sheet.push({ title: g.name, eyebrow: 'Lift', body: <LiftSheet g={g} /> })}
              label={`${g.name}: estimated one-rep max ${Math.round(last.e1rm)}${g.change != null ? `, ${signedPct(g.change)}` : ''}. Open`}
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

// ---------- consistency ----------
/**
 * The habit grid as a full sheet: one row per habit (name and rate over the range, then its days), Training first. Press
 * anywhere on the grid and slide: the column under the finger lights with its date; let go to open that day. The keyboard
 * and VoiceOver get one button per day.
 */
export const ConsistencySheet = ({ c, log, today, range, streak }: { c: Consistency; log: Log; today: string; range: Range; streak: { weeks: number; ofLast: { kept: number; total: number } } }) => {
  const nav = useNavigate();
  const sheet = useSheet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const N = width && width < 330 ? 21 : 28;
  const days = Array.from({ length: N }, (_, i) => shiftDays(today, i - N + 1));
  const habits = log.habits;
  const hits = useRef<HTMLDivElement>(null);
  const [press, setPress] = useState<number | null>(null);
  const colAt = (clientX: number) => {
    const r = hits.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const f = (Math.min(Math.max(clientX, r.left), r.right - 0.01) - r.left) / r.width;
    return Math.min(N - 1, Math.max(0, Math.floor(f * N)));
  };
  const openDay = (d: string) => {
    sheet.close();
    nav(d === today ? '/today' : `/today/${d}`);
  };
  const scrubTo = (clientX: number) => {
    const i = colAt(clientX);
    if (i != null && i !== press) haptics.select();
    setPress(i);
  };
  const cell = (rowId: string, d: string, createdOn?: string) => {
    if (rowId === '__t') {
      const st = dayStatus(log.snap, d);
      return st === 'done' || st === 'bonus' ? 'on' : st === 'floor' ? 'half' : st === 'missed' ? 'miss' : st === 'open' || st === 'upcoming' ? 'open' : 'none';
    }
    if (createdOn && d < createdOn) return 'none';
    if (log.snap.isHabitDone(d, rowId)) return 'on';
    return d === today ? 'open' : 'off';
  };
  const hp = pct(c.habitHit, c.habitOf);
  const tr = c.rows[0]!;
  const tp = pct(tr.hit, tr.of);
  return (
    <div className="pg-sheet">
      <div className="pg-stamps three">
        <Stamp label="Weeks kept" value={c.keptWeeks} unit={`of ${c.weeks}`} note={rangeLabel(range)} />
        <Stamp label="Training" value={tp ?? '—'} unit={tp != null ? '%' : undefined} note={tr.of ? `of ${tr.of} ${plural(tr.of, 'day')}` : 'No days yet'} />
        <Stamp label="Habits" value={hp ?? '—'} unit={hp != null ? '%' : undefined} note={c.habitOf ? `of ${c.habitOf} checks` : 'No habits yet'} />
      </div>
      {streak.ofLast.total ? <p className="pg-note">{`${streak.ofLast.kept} of the last ${streak.ofLast.total} ${plural(streak.ofLast.total, 'week')} kept${streak.weeks >= 2 ? `, ${streak.weeks} in a row` : ''}.`}</p> : null}
      <div ref={ref} className="pg-grid-wrap" style={{ '--n': N } as CSSProperties}>
        <div className="pg-grid-axis caps" aria-hidden="true">
          {press != null ? (
            <span className="on" style={{ left: `${((press + 0.5) / N) * 100}%` }}>
              {days[press] === today ? 'Today' : fmtDate('short', days[press]!)}
            </span>
          ) : (
            <>
              <span style={{ left: 0, transform: 'none' }}>{md(days[0]!)}</span>
              <span style={{ right: 0, left: 'auto', transform: 'none' }}>Today</span>
            </>
          )}
        </div>
        <div className="pg-grid">
          {c.rows.map((r) => {
            const h = habits.find((x) => x.id === r.id);
            const rp = pct(r.hit, r.of);
            return (
              <div key={r.id} className={`pg-grow ${r.train ? 'train' : ''}`}>
                <div className="pg-grow-head">
                  <span className="pg-grow-name">{r.name}</span>
                  <span className="pg-grow-rate">{rp == null ? '—' : `${rp}%`}</span>
                </div>
                <div className="pg-cells" aria-hidden="true">
                  {days.map((d, i) => (
                    <i key={d} className={`pg-cell ${cell(r.id, d, h?.createdOn)} ${press === i ? 'col' : ''}`} />
                  ))}
                </div>
              </div>
            );
          })}
          <div
            ref={hits}
            className="pg-hits pg-touch"
            role="group"
            aria-label="Open a day"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubTo(e.clientX);
            }}
            onPointerMove={(e) => press != null && scrubTo(e.clientX)}
            onPointerUp={(e) => {
              const i = press == null ? null : colAt(e.clientX);
              setPress(null);
              const d = i == null ? null : days[i];
              if (d) openDay(d);
            }}
            onPointerCancel={() => setPress(null)}
          >
            {days.map((d, i) => (
              <button key={d} type="button" className={`pg-hit ${press === i ? 'on' : ''}`} aria-label={`Open ${fmtDate('long', d)}`} onClick={(e) => e.detail === 0 && openDay(d)} />
            ))}
          </div>
        </div>
      </div>
      <p className="pg-key caps" aria-hidden="true">
        <span>
          <i className="pg-cell on" /> Done
        </span>
        <span>
          <i className="pg-cell half" /> Floor
        </span>
        <span>
          <i className="pg-cell miss" /> Missed
        </span>
        <span>
          <i className="pg-cell none" /> Rest
        </span>
      </p>
      <p className="pg-note">Press the grid and slide to a day; let go to open it. Rates count {rangeLabel(range).toLowerCase()}.</p>
    </div>
  );
};
