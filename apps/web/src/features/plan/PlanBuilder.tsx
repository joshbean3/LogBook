import { fmtDate, label, mi, mondayOf, monthsBetween, parseISO, shiftDays, tone, type PlanBlock, type PlanDraft } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '@/api/client';
import { keys, useBlockMutations } from '@/api/queries';
import { Button, Card, CardHead, Chip, Empty, Field, Kpi, Note, Segmented, Spinner } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import { useQuickOpen } from './PlanView';

type Mode = 'file' | 'text' | 'describe' | 'revise';
const MODES: Array<[Mode, string]> = [
  ['file', 'PDF or photo'],
  ['text', 'Paste'],
  ['describe', 'Describe'],
  ['revise', 'Change mine'],
];
const nextMonday = (t: string) => shiftDays(mondayOf(t), 7);

const Preview = ({ draft, mode, onDone, onDiscard, log }: { draft: PlanDraft; mode: Mode; onDone: () => void; onDiscard: () => void; log: Log }) => {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(draft.name);
  const existing = (() => {
    let n = 0;
    for (let d = draft.start; d <= draft.end; d = shiftDays(d, 1)) n += log.snap.sessionsOn(d).length;
    return n;
  })();
  const miles = draft.sessions.reduce((t, s) => t + (s.kind === 'run' ? s.miles ?? 0 : 0), 0);
  const byDate = new Map<string, PlanDraft['sessions']>();
  for (const s of draft.sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const apply = useMutation({
    mutationFn: (applyMode: 'replace' | 'add') => api<{ block: PlanBlock; months: string[] }>('/plans/apply', { method: 'POST', json: { draft: { ...draft, name: name.trim() || draft.name }, mode: applyMode, source: mode } }),
    onSuccess: async (r) => {
      for (const m of monthsBetween(shiftDays(draft.start, -14), shiftDays(draft.end, 14))) void qc.invalidateQueries({ queryKey: keys.month(m) });
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      toast(`${draft.sessions.length} sessions added to your calendar`);
      onDone();
      nav(`/plan/week/${r.block.start}`);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t save the plan.'),
  });
  const weeks: string[] = [];
  for (let mon = mondayOf(draft.start); mon <= draft.end; mon = shiftDays(mon, 7)) weeks.push(mon);
  return (
    <Card>
      <CardHead title="Preview" meta="Nothing is saved until you apply it." />
      <Field label="Plan name">
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      {draft.summary ? <p className="lead">{draft.summary}</p> : null}
      {draft.notes.length ? (
        <div className="pv-notes">
          <span className="mini-label">Claude flagged</span>
          <ul>
            {draft.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="kpis">
        <Kpi label="Dates" value={<span className="kpi-val sm">{`${fmtDate('md', draft.start)} – ${fmtDate('md', draft.end)}`}</span>} />
        <Kpi label="Sessions" value={String(draft.sessions.length)} />
        <Kpi label="Planned miles" value={mi(miles)} />
      </div>
      <div className="pv-weeks">
        {weeks.map((mon) => {
          let wk = 0;
          const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
          for (const d of days) wk += (byDate.get(d) ?? []).reduce((t, s) => t + (s.kind === 'run' ? s.miles ?? 0 : 0), 0);
          return (
            <div key={mon} className="pv-week">
              <div className="pv-wk">
                <b>{fmtDate('md', mon)}</b>
                <span>{wk ? `${mi(wk)} mi` : '—'}</span>
              </div>
              <div className="pv-days">
                {days.map((d) => {
                  const list = byDate.get(d) ?? [];
                  return (
                    <div key={d} className={`pv-day ${d < draft.start || d > draft.end ? 'out' : ''} ${list.length ? '' : 'none'}`}>
                      <span className="pv-dow">{`${fmtDate('dow', d)[0]} ${parseISO(d).getDate()}`}</span>
                      {list.map((s, i) => (
                        <span key={i} className={`s-chip t-${tone(s)}`} title={s.details ?? ''}>
                          <span className="s-text">{label(s)}</span>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row wrap">
        <Button variant="primary" disabled={apply.isPending} onClick={() => apply.mutate('replace')}>
          {existing ? `Replace ${existing} planned session${existing === 1 ? '' : 's'} in these dates` : 'Add to my calendar'}
        </Button>
        {existing && mode !== 'revise' ? (
          <Button disabled={apply.isPending} onClick={() => apply.mutate('add')}>
            Add alongside what’s there
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </Card>
  );
};

export const PlanBuilder = ({ log }: { log: Log }) => {
  const t = log.today;
  const [mode, setMode] = useState<Mode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [instr, setInstr] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const defaultStart = mode === 'revise' ? mondayOf(t) : nextMonday(t);
  const build = useMutation({
    mutationFn: async () => {
      setError(null);
      const s = start || defaultStart;
      const ac = (ctl.current = new AbortController());
      let res: Response;
      try {
        if (mode === 'file') {
          if (!file) throw new ApiError('Choose a PDF or a photo of your plan first.', 422);
          const fd = new FormData();
          fd.set('mode', 'file');
          fd.set('start', s);
          if (instr.trim()) fd.set('instructions', instr.trim());
          fd.set('file', file);
          res = await fetch('/api/plans/draft', { method: 'POST', body: fd, credentials: 'same-origin', signal: ac.signal });
        } else {
          res = await fetch('/api/plans/draft', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode, text: mode === 'text' ? text : undefined, instructions: instr.trim() || undefined, start: s, end: end || undefined }),
            credentials: 'same-origin',
            signal: ac.signal,
          });
        }
      } catch (e) {
        if (e instanceof ApiError) throw e;
        if ((e as Error).name === 'AbortError') throw new ApiError('Stopped.', 499, 'cancelled');
        throw new ApiError('Couldn’t reach the server. Check your connection.', 0);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw new ApiError(body.error ?? 'Something interrupted the request. Try again.', res.status, body.code ?? null);
      }
      return (await res.json()) as PlanDraft;
    },
    onSuccess: (d) => setDraft(d),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'cancelled') return;
      setError(e instanceof Error ? e.message : 'Something interrupted the request. Try again.');
    },
  });
  if (draft)
    return (
      <Preview
        draft={draft}
        mode={mode}
        log={log}
        onDone={() => {
          setDraft(null);
          setText('');
          setFile(null);
          setInstr('');
        }}
        onDiscard={() => setDraft(null)}
      />
    );
  const off = !log.features.claude;
  return (
    <Card>
      <CardHead title="Build or import a plan">
        <span className="row" style={{ gap: 6, color: 'var(--ink-3)', fontSize: 13 }}>
          <Sparkles size={14} /> with Claude
        </span>
      </CardHead>
      <Segmented className="mode-tabs" label="Source" options={MODES} value={mode} onChange={(m) => (setMode(m), setError(null))} disabled={build.isPending} />
      {mode === 'file' ? (
        <label className={`drop ${file ? 'has' : ''}`}>
          <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={build.isPending} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <FileText size={22} />
          <span>{file ? file.name : 'Choose a PDF or a photo of your plan'}</span>
          <small>{file ? `${Math.round(file.size / 1024)} KB · tap to change` : 'PDF, JPG or PNG'}</small>
        </label>
      ) : mode === 'text' ? (
        <Field label="Plan">
          <textarea className="in mono" rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={build.isPending} placeholder="Paste the plan: a coach’s email, a table copied from a spreadsheet, a forum post…" />
        </Field>
      ) : null}
      <Field label={mode === 'revise' ? 'What should change?' : mode === 'describe' ? 'What do you want?' : 'Notes for Claude'}>
        <textarea
          className="in"
          rows={mode === 'file' || mode === 'text' ? 2 : 4}
          maxLength={4000}
          value={instr}
          disabled={build.isPending}
          onChange={(e) => setInstr(e.target.value)}
          placeholder={
            mode === 'describe'
              ? 'e.g. 12-week half marathon build to a 1:30 at the Brooklyn Half, 4 runs a week, long run Saturday, 2 lifts, nothing over 45 min on weekdays'
              : mode === 'revise'
                ? 'e.g. Move every long run to Sunday. Cut next week by 20%, I have a live deal. Add a Tuesday upper-body lift.'
                : 'Optional: anything Claude should know, e.g. “skip the Week 6 race”, “my long run day is Sunday”'
          }
        />
      </Field>
      <div className="grid2">
        <Field label={mode === 'revise' ? 'From' : 'Start date'} hint={mode === 'file' || mode === 'text' ? 'Week 1 of the source starts here' : undefined}>
          <input className="in" type="date" value={start || defaultStart} onChange={(e) => setStart(e.target.value)} disabled={build.isPending} />
        </Field>
        {mode === 'file' || mode === 'text' ? null : (
          <Field label={mode === 'revise' ? 'Through' : 'End by (optional)'}>
            <input className="in" type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={build.isPending} />
          </Field>
        )}
      </div>
      {error ? <Note kind="bad">{error}</Note> : null}
      {off ? <Note kind="warn">Building plans needs an Anthropic API key on the server. Add ANTHROPIC_API_KEY and restart.</Note> : null}
      <div className="row spread">
        <AnimatePresence>
          {build.isPending ? (
            <motion.div className="row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: 'var(--ink-2)', fontSize: 14 }}>
              <Spinner /> Claude is building the plan. This usually takes 20–60 seconds…
            </motion.div>
          ) : (
            <span />
          )}
        </AnimatePresence>
        {build.isPending ? (
          <Button variant="ghost" onClick={() => ctl.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" disabled={off} onClick={() => build.mutate()}>
            {mode === 'revise' ? 'Draft the changes' : 'Build the plan'}
          </Button>
        )}
      </div>
      <p className="fine">Claude reads your source, your recent Strava weeks and heart-rate zones, then returns dated sessions you can check before saving.</p>
    </Card>
  );
};

export const PlansList = ({ log }: { log: Log }) => {
  const blocks = log.boot?.blocks ?? [];
  const { remove } = useBlockMutations();
  const toast = useToast();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState<string | null>(null);
  const t = log.today;
  const srcWord: Record<string, string> = { file: 'a file', text: 'pasted text', describe: 'your description', revise: 'a revision', chat: 'chat' };
  return (
    <Card>
      <CardHead title="Your plans" />
      {!blocks.length ? (
        <Empty>No plans yet. Import one above, or add sessions from the Today and Week views.</Empty>
      ) : (
        <ul className="blocks">
          {blocks.map((b) => {
            const state = t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active';
            return (
              <li key={b.id} className="block">
                <div className="block-main">
                  <div className="block-name">
                    {b.name}
                    <Chip kind={state === 'Active' ? 'open' : state === 'Upcoming' ? 'upcoming' : ''}>{state}</Chip>
                  </div>
                  <div className="block-meta">
                    {fmtDate('md', b.start)} – {fmtDate('md', b.end)} · {b.sessionCount ?? 0} sessions{b.source ? ` · from ${srcWord[b.source] ?? b.source}` : ''}
                  </div>
                  {b.summary ? <div className="block-sum">{b.summary}</div> : null}
                </div>
                <div className="row wrap">
                  <Button size="sm" onClick={() => nav(`/plan/week/${b.start < t && t <= b.end ? t : b.start}`)}>
                    Open week
                  </Button>
                  {confirm === b.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          remove.mutate(b);
                          setConfirm(null);
                          toast('Plan deleted');
                        }}
                      >
                        Delete {b.sessionCount ?? 0} sessions
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(b.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export const Upcoming = ({ log }: { log: Log }) => {
  const open = useQuickOpen(log);
  const t = log.today;
  const items: Array<[string, ReturnType<Log['snap']['sessionsOn']>[number]]> = [];
  for (let d = t; d <= shiftDays(t, 13); d = shiftDays(d, 1)) for (const s of log.snap.sessionsOn(d)) if (s.kind !== 'rest') items.push([d, s]);
  if (!items.length) return <Empty>Nothing planned in the next two weeks.</Empty>;
  return (
    <ul className="upcoming">
      {items.map(([d, s]) => (
        <li key={s.id}>
          <span className="up-date">{d === t ? 'Today' : fmtDate('short', d)}</span>
          <button type="button" className={`s-chip t-${tone(s)}`} onClick={() => open(d, s)}>
            <span className="s-text">{label(s)}</span>
          </button>
          <span className="up-det">{s.details ?? ''}</span>
        </li>
      ))}
    </ul>
  );
};
