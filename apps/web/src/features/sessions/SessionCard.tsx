import { assess, buildMorning, clock, clockOfDay, floorFor, fmtDate, isAutoStatus, KIND_WORD, label, METERS_PER_MILE, mi, mondayOf, monthOf, MORNING_DEFAULTS, morningDayFor, num, sessionStatus, shiftDays, STATUS_WORD, tone, weekTotals, zoneOf, type Activity, type Session } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/api/client';
import { keys, useSessionMutations } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { Button, Chip, ChipButton, Mark } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import type { ShareData } from '../share/cards';
import { ShareSheet } from '../share/ShareSheet';
import { LiftLog } from './LiftLog';
import { MoveSheet } from './MoveSheet';
import { SessionEditor } from './SessionEditor';
import './sessions.css';

/** One line that says what the session is: "Easy · 6 mi · 1.5 mi wu". The floor is explained in the sheet, never in the row. */
export const sessionMeta = (s: Session, st: string): string => {
  const bits: string[] = [];
  const lbl = label(s).toLowerCase();
  if (s.type && !lbl.includes(s.type.toLowerCase())) bits.push(s.type);
  if (s.kind === 'run' && s.miles && !lbl.includes(num(s.miles))) bits.push(`${num(s.miles)} mi`);
  if (s.minutes) bits.push(`${s.minutes} min`);
  if (s.details) bits.push(s.details);
  return bits.join(' · ');
};

const short = (m: number) => clockOfDay(m).replace(' AM', '').replace(' PM', '');

// ---------- the sheet's head: eyebrow and status, the name, and the four stamps on a hairline ----------
type AuraStat = [string, string, string?];
interface AuraSpec {
  tone: string;
  eyebrow: string;
  status: string;
  title: string;
  display: boolean;
  stats: AuraStat[];
}

/**
 * One head for every way in. The page's hero already drew the route and lit the day, so the sheet never restates it:
 * the eyebrow and the status chip, the name in the display serif (a stamp for a number label like "Easy 6"),
 * then the summary strip: DISTANCE / PACE / TIME / AVG HR for a run, PLAN / FLOOR / OUT / BACK for a plan.
 */
const SheetHead = ({ a }: { a: AuraSpec }) => (
  <div className={`sh-head t-${a.tone}`}>
    <div className="sh-top">
      <span className="caps">{a.eyebrow}</span>
      <Chip kind={a.status === 'bonus' ? 'done' : a.status}>{STATUS_WORD[a.status] ?? a.status}</Chip>
    </div>
    <h3 className={`sh-title ${a.display ? 'display' : 'stamp'}`}>{a.title}</h3>
    {a.stats.length ? (
      <div className="sh-stats" role="list" aria-label="Summary">
        {a.stats.map(([k, v, u]) => (
          <span key={k} className="sh-stat" role="listitem">
            <span className="caps">{k}</span>
            <span className="stamp sh-num">
              {v}
              {u ? <small>{u}</small> : null}
            </span>
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

/** The day's verdict in the brand voice: "Floor held." / "Easy 6, done." / "6.0 mi, off the plan." */
const runVerdict = (sess: Session | null, runs: Activity[], miles: number, status: string): string => {
  if (status === 'floor') return 'Floor held.';
  if (sess) return `${label(sess)}, done.`;
  return runs.length > 1 ? `${mi(miles)} mi across ${runs.length} runs.` : `${mi(miles)} mi, off the plan.`;
};

/** A finished run's head: the name, DISTANCE / PACE / TIME / AVG HR. */
const auraForRuns = (sess: Session | null, runs: Activity[], log: Log, status: string): AuraSpec => {
  const a = assess(log.zones, sess, runs);
  const name = runs.length === 1 ? runs[0]!.name : `${runs.length} runs`;
  return {
    tone: sess ? tone(sess) : 'easy',
    eyebrow: sess ? label(sess) : 'Unplanned run',
    status,
    title: name,
    display: true,
    stats: [
      ['Distance', mi(a.miles), 'mi'],
      ['Pace', a.pace ?? '—', a.pace ? '/mi' : undefined],
      ['Time', clock(a.movingSec)],
      ['Avg HR', a.avgHr != null ? String(a.avgHr) : '—', a.avgHr != null ? 'bpm' : undefined],
    ],
  };
};

/** A planned session's head: the name as a stamp, PLAN / FLOOR / OUT / BACK when known (SETS for a lift). */
const auraForPlan = (date: string, s: Session, log: Log, status: string, sets: number): AuraSpec => {
  const floor = floorFor(s);
  const mm = /(\d+)\s*min/.exec(floor);
  const stats: AuraStat[] = [];
  if (s.kind === 'run' && s.miles) stats.push(['Plan', num(s.miles), 'mi']);
  else if (s.minutes) stats.push(['Plan', String(s.minutes), 'min']);
  else if (s.type) stats.push(['Plan', s.type]);
  if (floor) stats.push(mm ? ['Floor', mm[1]!, 'min'] : ['Floor', floor.split(/[,\s]/)[0]!]);
  let morning: { start: number; back: number; mode: string } | null = null;
  if (date === log.today && log.boot && s.kind !== 'rest') {
    const sessions = log.snap.sessionsOn(date);
    const main = sessions.find((x) => x.kind === 'run') ?? sessions.find((x) => x.kind !== 'rest');
    if (main?.id === s.id) {
      const st2 = log.boot.morningSettings ?? MORNING_DEFAULTS;
      const T = buildMorning(morningDayFor(sessions, log.snap.morningOverride(date), st2), st2);
      const out = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
      if (out) morning = { start: out.start, back: T.back, mode: T.day.mode };
    }
  }
  if (morning) stats.push(['Out', short(morning.start)], ['Back', short(morning.back)]);
  if (sets) stats.push(['Sets', String(sets)]);
  return { tone: tone(s), eyebrow: s.movedFrom ? `${KIND_WORD[s.kind]} · moved from ${fmtDate('md', s.movedFrom)}` : KIND_WORD[s.kind], status, title: s.kind === 'rest' ? 'Rest' : label(s), display: false, stats };
};

/** Everything a share card needs: the run, the day's verdict, and the week around it. */
export const shareDataFor = (date: string, sess: Session | null, runs: Activity[], log: Log): ShareData => {
  const a = assess(log.zones, sess, runs);
  const status = sess ? sessionStatus(log.snap, date, sess) : 'done';
  const monday = mondayOf(date);
  const wt = weekTotals(log.snap, monday);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(monday, i);
    return { date: d, miles: log.snap.activitiesOn(d).filter((x) => x.kind === 'run').reduce((t, x) => t + x.miles, 0) };
  });
  return {
    name: runs.length === 1 ? runs[0]!.name : sess ? label(sess) : 'Run',
    label: sess ? label(sess) : null,
    verdict: runVerdict(sess, runs, a.miles, status),
    date,
    time: runs[0]?.time ?? null,
    miles: a.miles,
    movingSec: a.movingSec,
    elevFt: runs.reduce((t, r) => t + r.elevFt, 0),
    avgHr: a.avgHr,
    polyline: runs.find((r) => r.polyline)?.polyline ?? null,
    week: { monday, days, total: wt.ran, planned: wt.planned },
  };
};

const ShareButton = ({ data }: { data: ShareData }) => {
  const sheet = useSheet();
  return (
    <Button variant="primary" onClick={() => sheet.open({ title: 'Share', body: <ShareSheet data={data} /> })}>
      Share
    </Button>
  );
};

/** What happened, graded against the plan: splits, the read, the coach. */
export const SessionActual = ({ date, sess, runs, log }: { date: string; sess: Session | null; runs: Activity[]; log: Log }) => {
  const a = assess(log.zones, sess, runs);
  const laps = runs.flatMap((r) => r.laps ?? []).filter((l) => l[0] > 160);
  const key = sess ? sess.id : 'run';
  const saved = log.snap.coachOn(date, key);
  const qc = useQueryClient();
  const toast = useToast();
  const coach = useMutation({
    mutationFn: () => api<{ date: string; key: string; text: string; createdAt: string }>('/coach/read', { method: 'POST', json: { date, sessionId: sess?.id ?? null } }),
    onSuccess: (r) => qc.setQueryData<MonthBundle>(keys.month(monthOf(date)), (b) => (b ? { ...b, coach: [...b.coach.filter((c) => !(c.date === date && c.key === key)), r] } : b)),
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t get the coach’s read.'),
  });
  const fastest = laps.length ? Math.min(...laps.map((l) => l[1] / (l[0] / METERS_PER_MILE))) : 0;
  const slowest = laps.length ? Math.max(...laps.map((l) => l[1] / (l[0] / METERS_PER_MILE))) : 0;
  const za = a.avgHr != null ? zoneOf(log.zones, a.avgHr) : null;
  // the name sits in the head just above, so the line starts at the clock
  const starts = runs.map((r) => r.time).filter((t): t is string => !!t);
  const line = [
    starts.length ? `Started ${starts.join(' and ')}` : null,
    runs.length > 1 ? `${runs.length} runs combined` : null,
    za ? `Z${za} average` : null,
    a.maxHr != null ? `max ${a.maxHr} bpm` : null,
    runs[0]?.cadence ? `${runs[0].cadence} spm` : null,
    runs.some((r) => r.elevFt) ? `${runs.reduce((t, r) => t + r.elevFt, 0)} ft up` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="actual">
      <p className="fine">{line}</p>
      {a.avgHr == null && runs.some((r) => !r.perfAt) ? <p className="fine">Heart rate and splits are on their way.</p> : null}
      {laps.length > 1 ? (
        <div className="splits" aria-label="Mile splits">
          {laps.map((l, i) => {
            const part = l[0] < 0.9 * METERS_PER_MILE;
            const z = l[2] != null ? zoneOf(log.zones, l[2]) : null;
            const p = l[1] / (l[0] / METERS_PER_MILE);
            // the fastest mile gets the longest bar
            const w = slowest === fastest ? 1 : 0.35 + 0.65 * (1 - (p - fastest) / (slowest - fastest));
            return (
              <div key={i} className={`split ${z ? `sz${z}` : ''} ${part ? 'part' : ''}`}>
                <span className="split-n">{part ? mi(l[0] / METERS_PER_MILE) : i + 1}</span>
                <span className="split-bar">
                  <i style={{ width: `${w * 100}%` }} />
                </span>
                <span className="split-pace">{clock(p)}</span>
                <span className="split-hr">{l[2] != null ? l[2] : ''}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {a.lines.length ? (
        <div className={`assess v-${a.verdict}`}>
          {sess ? <div className="assess-head">{a.head}</div> : null}
          <ul>
            {a.lines.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {log.features.claude ? (
        saved ? (
          <div className="coach">
            <span className="caps row" style={{ gap: 6 }}>
              <Sparkles size={12} /> Coach’s read
            </span>
            <p className="serif">{saved}</p>
            <button type="button" className="link sm" disabled={coach.isPending} onClick={() => coach.mutate()}>
              {coach.isPending ? 'Asking…' : 'Ask again'}
            </button>
          </div>
        ) : (
          <ChipButton onClick={() => coach.mutate()} disabled={coach.isPending}>
            <Sparkles size={14} />
            {coach.isPending ? 'Reading the run…' : 'Coach’s read'}
          </ChipButton>
        )
      ) : null}
    </div>
  );
};

/** The sheet's title on every path: the date as a caps label. Inter, never the serif under 22px. */
export const sessionSheetTitle = (date: string) => <span className="caps sh-sheet-date">{fmtDate('long', date)}</span>;
const sheetDate = sessionSheetTitle;

/** Whatever the caller passed, the title of a session sheet is the caps date. */
const useCapsDateTitle = (date: string) => {
  const sheet = useSheet();
  useEffect(() => {
    sheet.update({ title: sheetDate(date) });
  }, [date, sheet]);
};

/** The full session in a sheet: the head, the evidence, the lift log, and every action. `fromHero` is accepted and makes no difference: one sheet, every way in. */
const SessionSheet = ({ date, id }: { date: string; id: string; fromHero?: boolean }) => {
  // the sheet body is captured once at open; subscribing here keeps marks, sets and deletes live while it is up
  const log = useLog([monthOf(date)]);
  const sheet = useSheet();
  const toast = useToast();
  const { mark, remove, restore } = useSessionMutations();
  const [liftOpen, setLiftOpen] = useState(false);
  const s = log.snap.sessionsOn(date).find((x) => x.id === id);
  useCapsDateTitle(date);
  useEffect(() => {
    if (!s) sheet.close();
  }, [s, sheet]);
  const runs = s?.kind === 'run' ? log.snap.runsOn(date) : [];
  const share = useMemo(() => (s && runs.length ? shareDataFor(date, s, runs, log) : null), [date, s, runs, log]);
  if (!s) return null;
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const sets = log.snap.liftsOn(date);
  const others = log.snap.activitiesOn(date).filter((a) => a.kind !== 'run');
  const setMark = (m: Session['mark']) => mark.mutate({ session: s, mark: m });
  const canLog = s.kind === 'lift' || (s.kind === 'cross' && /hyrox/i.test(s.type ?? ''));
  const aura = runs.length ? auraForRuns(s, runs, log, st) : auraForPlan(date, s, log, st, s.kind === 'lift' ? sets.length : 0);
  return (
    <div className="sh-body">
      <SheetHead a={aura} />
      {sessionMeta(s, st) ? <p className="t-sub ink2">{sessionMeta(s, st)}</p> : null}
      {s.kind !== 'rest' && floorFor(s) ? (
        <p className="t-sub ink2">
          <span className="muted">Floor:</span> {floorFor(s)}
        </p>
      ) : null}
      {runs.length ? <SessionActual date={date} sess={s} runs={runs} log={log} /> : null}
      {s.kind === 'lift' && sets.length ? (
        <p className="t-sub ink2">
          {sets.length} {sets.length === 1 ? 'set' : 'sets'}: {sets.map((x) => `${x.exercise} ${x.weight}×${x.reps}`).join(', ')}
        </p>
      ) : null}
      {s.kind !== 'run'
        ? others.map((a) => (
            <p key={a.id} className="t-sub ink2">
              {a.name} · {Math.round(a.movingSec / 60)} min
            </p>
          ))
        : null}
      {canLog ? (
        <>
          <Button variant={liftOpen ? 'default' : 'soft'} onClick={() => setLiftOpen((o) => !o)} style={{ justifySelf: 'start' }}>
            {liftOpen ? 'Close' : 'Log'}
          </Button>
          {liftOpen ? <LiftLog date={date} /> : null}
        </>
      ) : null}
      <div className="row wrap sh-marks">
        {s.kind !== 'rest' && !auto ? (
          st === 'done' ? (
            <ChipButton onClick={() => setMark(null)}>Undo</ChipButton>
          ) : (
            <>
              <ChipButton onClick={() => setMark('done')}>Done</ChipButton>
              {st !== 'floor' ? <ChipButton onClick={() => setMark('floor')}>Floor</ChipButton> : <ChipButton onClick={() => setMark(null)}>Clear</ChipButton>}
            </>
          )
        ) : null}
        {st !== 'done' ? (
          <ChipButton quiet onClick={() => setMark(s.mark === 'skip' ? null : 'skip')}>
            {s.mark === 'skip' ? 'Unskip' : 'Skip'}
          </ChipButton>
        ) : null}
      </div>
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            remove.mutate(s);
            sheet.close();
            toast('Session deleted', { label: 'Undo', fn: () => restore.mutate(s) });
          }}
        >
          Delete
        </Button>
        <div className="foot-right">
          <Button variant="quiet" onClick={() => sheet.open({ title: `Move ${label(s)}`, body: <MoveSheet date={date} session={s} /> })}>
            Move
          </Button>
          <Button variant="quiet" onClick={() => sheet.open({ title: 'Edit session', body: <SessionEditor date={date} session={s} /> })}>
            Edit
          </Button>
          {share && share.miles > 0 ? <ShareButton data={share} /> : null}
        </div>
      </div>
    </div>
  );
};

/** A run with no session behind it: the same head and evidence, and Share. `fromHero` is accepted and makes no difference. */
export const UnplannedSheet = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log; fromHero?: boolean }) => {
  const share = useMemo(() => shareDataFor(date, null, runs, log), [date, runs, log]);
  const aura = auraForRuns(null, runs, log, 'done');
  useCapsDateTitle(date);
  return (
    <div className="sh-body">
      <SheetHead a={aura} />
      <SessionActual date={date} sess={null} runs={runs} log={log} />
      <div className="sheet-foot">
        <span />
        <div className="foot-right">{share.miles > 0 ? <ShareButton data={share} /> : null}</div>
      </div>
    </div>
  );
};

/** Open a session's sheet. `fromHero` is accepted for the callers that pass it; the sheet is the same from the hero and from a row. */
export const useOpenSession = (_log?: Log) => {
  const sheet = useSheet();
  return (date: string, s: Session, opts: { fromHero?: boolean } = {}) => sheet.open({ title: sheetDate(date), body: <SessionSheet date={date} id={s.id} fromHero={opts.fromHero} />, wide: true });
};

/** A 60px row: check, colour bar, the run's name (or the plan's label), the plan as the sub line, one stat, chevron. */
export const SessionRow = ({ date, s, log, as = 'li' }: { date: string; s: Session; log: Log; as?: 'li' | 'div' }) => {
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const { mark } = useSessionMutations();
  const open = useOpenSession(log);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const sets = log.snap.liftsOn(date);
  const lbl = label(s);
  // a logged run leads with its own name, the way Aura sets it; the plan's label drops to the sub line
  const title = runs.length ? runs.map((r) => r.name).join(' + ') : lbl;
  const sub = runs.length ? [lbl, sessionMeta(s, st)].filter(Boolean).join(' · ') : sessionMeta(s, st) || STATUS_WORD[st];
  let stat: ReactNode = null;
  if (runs.length) {
    const a = assess(log.zones, s, runs);
    stat = (
      <span className="srow-stat">
        <b>{mi(a.miles)} mi</b>
        <small>{a.pace ? `${a.pace}/mi` : clock(a.movingSec)}</small>
      </span>
    );
  } else if (s.kind === 'lift' && sets.length) {
    stat = (
      <span className="srow-stat">
        <b>{sets.length}</b>
        <small>{sets.length === 1 ? 'set' : 'sets'}</small>
      </span>
    );
  } else if (st !== 'done') stat = <Chip kind={st}>{STATUS_WORD[st]}</Chip>;
  const Tag = as;
  return (
    <Tag className={`srow t-${tone(s)} s-${st}`}>
      <Mark status={st} label={`${lbl}: ${STATUS_WORD[st] ?? st}`} title={auto ? 'Matched to a logged run' : undefined} disabled={s.kind === 'rest' || auto} onClick={() => mark.mutate({ session: s, mark: st === 'done' && s.mark === 'done' ? null : 'done' })} />
      <button type="button" className="srow-body" onClick={() => open(date, s)}>
        <span className="srow-bar" aria-hidden="true" />
        <span className="srow-main">
          <span className="lrow-title">{title}</span>
          <span className="lrow-sub">{sub}</span>
        </span>
        {stat}
        <ChevronRight size={18} className="srow-chev" />
      </button>
    </Tag>
  );
};

export const UnplannedRow = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log }) => {
  const sheet = useSheet();
  const a = assess(log.zones, null, runs);
  return (
    <li className="srow t-easy s-done">
      <Mark status="done" disabled label="Unplanned run, done" />
      <button type="button" className="srow-body" onClick={() => sheet.open({ title: sheetDate(date), body: <UnplannedSheet date={date} runs={runs} log={log} />, wide: true })}>
        <span className="srow-bar" aria-hidden="true" />
        <span className="srow-main">
          <span className="lrow-title">{runs.map((r) => r.name).join(' + ')}</span>
          <span className="lrow-sub">Unplanned</span>
        </span>
        <span className="srow-stat">
          <b>{mi(a.miles)} mi</b>
          <small>{a.pace ? `${a.pace}/mi` : ''}</small>
        </span>
        <ChevronRight size={18} className="srow-chev" />
      </button>
    </li>
  );
};

export const AddSessionButton = ({ date, children, variant = 'quiet' }: { date: string; children?: ReactNode; variant?: 'ghost' | 'soft' | 'primary' | 'quiet' }) => {
  const sheet = useSheet();
  return (
    <Button variant={variant} size="sm" onClick={() => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={null} /> })}>
      {children ?? 'Add'}
    </Button>
  );
};
