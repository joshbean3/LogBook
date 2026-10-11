import { assess, clock, fmtDate, floorFor, isAutoStatus, label, METERS_PER_MILE, mi, num, sessionStatus, STATUS_WORD, tone, zoneOf, type Activity, type Session } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { keys, useSessionMutations } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { monthOf } from '@logbook/shared';
import { Button, Chip, ChipButton, Mark } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import { LiftLog } from './LiftLog';
import { MoveSheet } from './MoveSheet';
import { SessionEditor } from './SessionEditor';
import './sessions.css';

const SessionActual = ({ date, sess, runs, log }: { date: string; sess: Session | null; runs: Activity[]; log: Log }) => {
  const a = assess(log.zones, sess, runs);
  const za = a.avgHr != null ? zoneOf(log.zones, a.avgHr) : null;
  const laps = runs.flatMap((r) => r.laps ?? []).filter((l) => l[0] > 160);
  const key = sess ? sess.id : 'run';
  const saved = log.snap.coachOn(date, key);
  const qc = useQueryClient();
  const toast = useToast();
  const coach = useMutation({
    mutationFn: () => api<{ date: string; key: string; text: string; createdAt: string }>('/coach/read', { method: 'POST', json: { date, sessionId: sess?.id ?? null } }),
    onSuccess: (r) => {
      qc.setQueryData<MonthBundle>(keys.month(monthOf(date)), (b) => (b ? { ...b, coach: [...b.coach.filter((c) => !(c.date === date && c.key === key)), r] } : b));
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t get the coach’s read.'),
  });
  const [open, setOpen] = useState(false);
  return (
    <div className="actual">
      <div className="did">
        <span className="did-label">Did</span>
        <span className="did-big num">{mi(a.miles)} mi</span>
        <span>{clock(a.movingSec)}</span>
        {a.pace ? <span>{a.pace} /mi</span> : null}
        {a.avgHr != null ? (
          <span className="row" style={{ gap: 5 }}>
            {a.avgHr} avg · {a.maxHr} max bpm {za ? <b className={`hr-chip z${za}`}>Z{za}</b> : null}
          </span>
        ) : runs.some((r) => !r.perfAt) ? (
          <span className="muted" style={{ fontSize: 12.5 }}>
            heart rate on its way…
          </span>
        ) : null}
        {runs[0]?.cadence ? <span>{runs[0].cadence} spm</span> : null}
      </div>
      <div className="did-src">
        {runs.map((r) => r.name + (r.time ? ` · ${r.time}` : '')).join(' + ')}
        {runs.length > 1 ? ' (combined)' : ''}
      </div>
      {laps.length > 1 ? (
        <div className="splits" aria-label="Mile splits">
          {laps.map((l, i) => {
            const part = l[0] < 0.9 * METERS_PER_MILE;
            const z = l[2] != null ? zoneOf(log.zones, l[2]) : null;
            const pace = clock(l[1] / (l[0] / METERS_PER_MILE));
            return (
              <span key={i} className={`split ${z ? `sz${z}` : ''} ${part ? 'part' : ''}`} title={`${part ? `${mi(l[0] / METERS_PER_MILE)} mi` : `Mile ${i + 1}`} · ${pace}/mi${l[2] != null ? ` · ${l[2]} bpm` : ''}`}>
                <b>{part ? mi(l[0] / METERS_PER_MILE) : i + 1}</b>
                <span>{pace}</span>
                {l[2] != null ? <small>{l[2]}</small> : null}
              </span>
            );
          })}
        </div>
      ) : null}
      {a.lines.length ? (
        <div className={`assess v-${a.verdict}`}>
          <button type="button" className="assess-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span>{a.head}</span>
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                {a.lines.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      {log.features.claude ? (
        saved ? (
          <div className="coach">
            <div className="row" style={{ gap: 6 }}>
              <Sparkles size={13} />
              <span className="mini-label">Coach’s read</span>
            </div>
            <p>{saved}</p>
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

export const UnplannedCard = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log }) => (
  <article className="scard k-run s-done">
    <Mark status="done" disabled label="Unplanned run, done" />
    <div className="scard-body">
      <div className="scard-head">
        <span className="pill t-easy">Unplanned run</span>
        <Chip kind="done">Bonus</Chip>
      </div>
      <SessionActual date={date} sess={null} runs={runs} log={log} />
    </div>
  </article>
);

export const SessionCard = ({ date, s, log, compact }: { date: string; s: Session; log: Log; compact?: boolean }) => {
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const { mark, remove } = useSessionMutations();
  const sheet = useSheet();
  const toast = useToast();
  const [liftOpen, setLiftOpen] = useState(false);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const sets = log.snap.liftsOn(date);
  const others = log.snap.activitiesOn(date).filter((a) => a.kind !== 'run');
  const lbl = label(s);
  const plan = [s.type, s.miles ? `${num(s.miles)} mi` : null, s.details].filter(Boolean).join(' · ');
  const setMark = (m: Session['mark']) => mark.mutate({ session: s, mark: m });
  return (
    <motion.article layout className={`scard k-${s.kind} s-${st}`} data-id={s.id}>
      <Mark
        status={st}
        label={`${lbl}: ${STATUS_WORD[st] ?? st}`}
        title={auto ? 'Matched from Strava' : st === 'done' ? 'Tap to clear' : 'Tap if you did it'}
        disabled={s.kind === 'rest' || auto}
        onClick={() => setMark(st === 'done' && s.mark === 'done' ? null : 'done')}
      />
      <div className="scard-body">
        <div className="scard-head">
          <span className={`pill t-${tone(s)}`}>{lbl}</span>
          {s.type && s.title && !s.title.toLowerCase().includes(s.type.toLowerCase()) ? <span className="scard-type">{s.type}</span> : null}
          {s.kind === 'run' && s.miles && s.title && !s.title.includes(num(s.miles)) ? <span className="scard-type">{num(s.miles)} mi</span> : null}
          {s.minutes ? <span className="scard-type">{s.minutes} min</span> : null}
          <Chip kind={st}>{STATUS_WORD[st]}</Chip>
        </div>
        {s.movedFrom ? <div className="scard-meta">Moved from {fmtDate('short', s.movedFrom)}</div> : null}
        {runs.length ? plan ? <div className="scard-plan">Plan: {plan}</div> : null : s.details ? <div className="scard-details">{s.details}</div> : null}
        {!(st === 'done' || st === 'floor') && st !== 'rest' && st !== 'skipped' && floorFor(s) ? <div className="scard-floor">Floor: {floorFor(s)}</div> : null}
        {runs.length ? <SessionActual date={date} sess={s} runs={runs} log={log} /> : null}
        {s.kind !== 'run' && s.kind === 'lift' && sets.length ? (
          <div className="scard-meta">
            {sets.length} {sets.length === 1 ? 'set' : 'sets'} logged: {sets.map((x) => `${x.exercise} ${x.weight}×${x.reps}`).join(', ')}
          </div>
        ) : null}
        {s.kind !== 'run' ? others.map((a) => <div key={a.id} className="scard-meta">Strava: {a.name} · {Math.round(a.movingSec / 60)} min</div>) : null}
        {s.mark === 'floor' && st === 'floor' ? <div className="scard-meta">Logged as floor</div> : null}
        {!compact ? (
          <div className="scard-actions">
            {s.kind !== 'rest' && !auto && st !== 'done' ? (
              st !== 'floor' ? (
                <ChipButton onClick={() => setMark('floor')}>Did the floor</ChipButton>
              ) : s.mark === 'floor' ? (
                <ChipButton onClick={() => setMark(null)}>Clear floor</ChipButton>
              ) : null
            ) : null}
            {s.kind === 'lift' || (s.kind === 'cross' && /hyrox/i.test(s.type ?? '')) ? <ChipButton onClick={() => setLiftOpen((o) => !o)}>{liftOpen ? 'Close lift log' : 'Log lift'}</ChipButton> : null}
            <ChipButton onClick={() => sheet.open({ title: `Move ${lbl}`, body: <MoveSheet date={date} session={s} log={log} /> })}>Move</ChipButton>
            <ChipButton onClick={() => sheet.open({ title: 'Edit session', body: <SessionEditor date={date} session={s} /> })}>Edit</ChipButton>
            {st !== 'done' ? (
              <ChipButton quiet onClick={() => setMark(s.mark === 'skip' ? null : 'skip')}>
                {s.mark === 'skip' ? 'Unskip' : 'Skip'}
              </ChipButton>
            ) : null}
            <ChipButton
              quiet
              onClick={() => {
                remove.mutate(s);
                toast('Session deleted', { label: 'Undo', fn: () => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={{ ...s }} restore /> }) });
              }}
              aria-label={`Delete ${lbl}`}
            >
              Delete
            </ChipButton>
          </div>
        ) : null}
        <AnimatePresence initial={false}>
          {liftOpen ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24 }} style={{ overflow: 'hidden' }}>
              <LiftLog date={date} log={log} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};

export const AddSessionButton = ({ date, children }: { date: string; children?: React.ReactNode }) => {
  const sheet = useSheet();
  return (
    <Button variant="ghost" size="sm" onClick={() => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={null} /> })}>
      {children ?? '+ Add session'}
    </Button>
  );
};
