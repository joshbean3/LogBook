import { assess, clock, fmtDate, floorFor, isAutoStatus, label, METERS_PER_MILE, mi, monthOf, num, sessionStatus, STATUS_WORD, tone, zoneOf, type Activity, type Session } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/api/client';
import { keys, useSessionMutations } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { Button, Chip, ChipButton, Mark, Stat, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
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

/** What Strava says happened, graded against the plan. */
export const SessionActual = ({ date, sess, runs, log }: { date: string; sess: Session | null; runs: Activity[]; log: Log }) => {
  const a = assess(log.zones, sess, runs);
  const za = a.avgHr != null ? zoneOf(log.zones, a.avgHr) : null;
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
  return (
    <div className="actual">
      <StatStrip>
        <Stat label="Distance" value={mi(a.miles)} unit="mi" />
        <Stat label="Pace" value={a.pace ?? '—'} unit={a.pace ? '/mi' : undefined} />
        <Stat label="Time" value={clock(a.movingSec)} />
      </StatStrip>
      {a.avgHr != null || runs[0]?.cadence ? (
        <StatStrip>
          <Stat label="Avg HR" value={a.avgHr ?? '—'} unit={za ? <b className={`hr-chip z${za}`}>Z{za}</b> : 'bpm'} small />
          <Stat label="Max HR" value={a.maxHr ?? '—'} unit="bpm" small />
          <Stat label="Cadence" value={runs[0]?.cadence ?? '—'} unit="spm" small />
        </StatStrip>
      ) : runs.some((r) => !r.perfAt) ? (
        <p className="fine">Heart rate and splits are on their way from Strava.</p>
      ) : null}
      <p className="fine">
        {runs.map((r) => r.name + (r.time ? ` · ${r.time}` : '')).join(' + ')}
        {runs.length > 1 ? ' (combined)' : ''}
      </p>
      {laps.length > 1 ? (
        <div className="splits" aria-label="Mile splits">
          {laps.map((l, i) => {
            const part = l[0] < 0.9 * METERS_PER_MILE;
            const z = l[2] != null ? zoneOf(log.zones, l[2]) : null;
            const p = l[1] / (l[0] / METERS_PER_MILE);
            // the fastest mile gets the longest bar (as Strava draws them)
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
            <span className="t-label muted row" style={{ gap: 6 }}>
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
            {coach.isPending ? 'Claude is reading the run…' : 'Coach’s read'}
          </ChipButton>
        )
      ) : null}
    </div>
  );
};

/** The full session in a sheet: evidence, lift log, and every action. */
const SessionSheet = ({ date, id }: { date: string; id: string }) => {
  // the sheet body is captured once at open; subscribing here keeps marks, sets and deletes live while it is up
  const log = useLog([monthOf(date)]);
  const sheet = useSheet();
  const toast = useToast();
  const { mark, remove, restore } = useSessionMutations();
  const [liftOpen, setLiftOpen] = useState(false);
  const s = log.snap.sessionsOn(date).find((x) => x.id === id);
  useEffect(() => {
    if (!s) sheet.close();
  }, [s, sheet]);
  if (!s) return null;
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const sets = log.snap.liftsOn(date);
  const others = log.snap.activitiesOn(date).filter((a) => a.kind !== 'run');
  const setMark = (m: Session['mark']) => mark.mutate({ session: s, mark: m });
  const canLog = s.kind === 'lift' || (s.kind === 'cross' && /hyrox/i.test(s.type ?? ''));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 10 }}>
        <i className={`tone-dot t-${tone(s)}`} aria-hidden="true" />
        <Chip kind={st}>{STATUS_WORD[st]}</Chip>
        <span className="t-sub muted">{fmtDate('short', date)}</span>
      </div>
      {sessionMeta(s, st) ? <p className="t-sub ink2">{sessionMeta(s, st)}</p> : null}
      {s.kind !== 'rest' && floorFor(s) ? (
        <p className="t-sub ink2">
          <span className="muted">Floor:</span> {floorFor(s)}
        </p>
      ) : null}
      {s.movedFrom ? <p className="fine">Moved from {fmtDate('short', s.movedFrom)}</p> : null}
      {runs.length ? <SessionActual date={date} sess={s} runs={runs} log={log} /> : null}
      {s.kind === 'lift' && sets.length ? (
        <p className="t-sub ink2">
          {sets.length} {sets.length === 1 ? 'set' : 'sets'}: {sets.map((x) => `${x.exercise} ${x.weight}×${x.reps}`).join(', ')}
        </p>
      ) : null}
      {s.kind !== 'run'
        ? others.map((a) => (
            <p key={a.id} className="t-sub ink2">
              Strava: {a.name} · {Math.round(a.movingSec / 60)} min
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
      <div className="row wrap" style={{ gap: 8 }}>
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
          <Button onClick={() => sheet.open({ title: `Move ${label(s)}`, body: <MoveSheet date={date} session={s} /> })}>Move</Button>
          <Button onClick={() => sheet.open({ title: 'Edit session', body: <SessionEditor date={date} session={s} /> })}>Edit</Button>
        </div>
      </div>
    </div>
  );
};

export const useOpenSession = (_log?: Log) => {
  const sheet = useSheet();
  return (date: string, s: Session) => sheet.open({ title: label(s), body: <SessionSheet date={date} id={s.id} />, wide: true });
};

/** A 60px row: check, colour bar, title, meta, one stat, chevron. */
export const SessionRow = ({ date, s, log, as = 'li' }: { date: string; s: Session; log: Log; as?: 'li' | 'div' }) => {
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const { mark } = useSessionMutations();
  const open = useOpenSession(log);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const sets = log.snap.liftsOn(date);
  const lbl = label(s);
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
      <Mark status={st} label={`${lbl}: ${STATUS_WORD[st] ?? st}`} title={auto ? 'Matched from Strava' : undefined} disabled={s.kind === 'rest' || auto} onClick={() => mark.mutate({ session: s, mark: st === 'done' && s.mark === 'done' ? null : 'done' })} />
      <button type="button" className="srow-body" onClick={() => open(date, s)}>
        <span className="srow-bar" aria-hidden="true" />
        <span className="srow-main">
          <span className="lrow-title">{lbl}</span>
          <span className="lrow-sub">{sessionMeta(s, st) || STATUS_WORD[st]}</span>
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
      <button type="button" className="srow-body" onClick={() => sheet.open({ title: 'Unplanned run', body: <SessionActual date={date} sess={null} runs={runs} log={log} />, wide: true })}>
        <span className="srow-bar" aria-hidden="true" />
        <span className="srow-main">
          <span className="lrow-title">Unplanned run</span>
          <span className="lrow-sub">{runs.map((r) => r.name).join(' + ')}</span>
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

export const AddSessionButton = ({ date, children, variant = 'ghost' }: { date: string; children?: ReactNode; variant?: 'ghost' | 'soft' | 'primary' }) => {
  const sheet = useSheet();
  return (
    <Button variant={variant} size="sm" onClick={() => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={null} /> })}>
      {children ?? 'Add'}
    </Button>
  );
};
