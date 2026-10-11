import { daysBetween, fmtDate, label, mi, mondayOf, monthsBetween, parseISO, shiftDays, tone, type PlanBlock, type PlanDraft } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '@/api/client';
import { keys, useBlockMutations } from '@/api/queries';
import { Button, Chip, EmptyState, Field, Group, Note, Row, SectionHead, Segmented, Stat, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import { AddSessionButton, useOpenSession } from '../sessions/SessionCard';

type Mode = 'file' | 'text' | 'describe' | 'revise';
const MODES: Array<[Mode, string]> = [
  ['file', 'File'],
  ['text', 'Paste'],
  ['describe', 'Describe'],
  ['revise', 'Revise'],
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
  const nWeeks = Math.ceil((daysBetween(draft.start, draft.end) + 1) / 7);
  return (
    <>
      <SectionHead title="Preview" meta="Nothing is saved until you apply it." />
      <div className="pv-hero">
        <input className="pv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Plan name" />
        <span className="t-cap muted">
          {fmtDate('md', draft.start)} – {fmtDate('md', draft.end)}
        </span>
        {draft.summary ? <p className="t-sub ink2">{draft.summary}</p> : null}
        <StatStrip>
          <Stat label="Weeks" value={nWeeks} />
          <Stat label="Sessions" value={draft.sessions.length} />
          <Stat label="Miles" value={mi(miles)} />
        </StatStrip>
      </div>
      {draft.notes.length ? (
        <div className="pv-notes">
          <span className="t-label">Flagged</span>
          <ul>
            {draft.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <SectionHead title="Week by week" meta={`${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`} />
      <Group>
        {weeks.map((mon) => {
          let wk = 0;
          const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
          for (const d of days) wk += (byDate.get(d) ?? []).reduce((t, s) => t + (s.kind === 'run' ? s.miles ?? 0 : 0), 0);
          return (
            <div key={mon} className="pv-week">
              <div className="pv-wk">
                <b>{fmtDate('md', mon)}</b>
                <span>{wk ? `${mi(wk)} mi` : 'No running'}</span>
              </div>
              <div className="pv-days">
                {days.map((d) => {
                  const list = byDate.get(d) ?? [];
                  if (!list.length) return null;
                  return (
                    <div key={d} className={`pv-day ${d < draft.start || d > draft.end ? 'out' : ''}`}>
                      <span className="pv-dow">{`${fmtDate('dow', d)[0]} ${parseISO(d).getDate()}`}</span>
                      {list.map((s, i) => (
                        <Chip key={i} kind="tone" className={`t-${tone(s)}`}>
                          {label(s)}
                        </Chip>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Group>
      <div className="pv-actions">
        <Button variant="primary" disabled={apply.isPending} onClick={() => apply.mutate('replace')}>
          {existing ? 'Replace' : 'Add'}
        </Button>
        {existing && mode !== 'revise' ? (
          <Button disabled={apply.isPending} onClick={() => apply.mutate('add')}>
            Add
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
      {existing ? (
        <p className="fine pv-fine">
          {existing} planned {existing === 1 ? 'session' : 'sessions'} already sit in these dates. Replace clears them{mode !== 'revise' ? '; Add keeps them' : ''}.
        </p>
      ) : null}
    </>
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
  const busy = build.isPending;
  // nothing to build with: the page starts at "Your plans"
  if (!log.features.claude) return null;
  return (
    <>
      <SectionHead title="Plan builder" />
      <Group className="builder">
        <div className="brow">
          <Segmented className="mode-tabs" label="Source" options={MODES} value={mode} onChange={(m) => (setMode(m), setError(null))} disabled={busy} />
        </div>
        {mode === 'file' ? (
          <div className="brow">
            <label className={`drop ${file ? 'has' : ''}`}>
              <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <FileText size={22} />
              <span className="t-sub">{file ? file.name : 'Choose a PDF or a photo of your plan'}</span>
              <span className="t-cap muted">{file ? `${Math.round(file.size / 1024)} KB · tap to change` : 'PDF, JPG or PNG'}</span>
            </label>
          </div>
        ) : mode === 'text' ? (
          <div className="brow">
            <Field label="Plan">
              <textarea className="in bare mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder="Paste the plan: a coach’s email, a table copied from a spreadsheet, a forum post…" />
            </Field>
          </div>
        ) : null}
        <div className="brow">
          <Field label={mode === 'revise' ? 'What should change?' : mode === 'describe' ? 'What do you want?' : 'Notes'}>
            <textarea
              className="in bare"
              rows={mode === 'file' || mode === 'text' ? 2 : 4}
              maxLength={4000}
              value={instr}
              disabled={busy}
              onChange={(e) => setInstr(e.target.value)}
              placeholder={
                mode === 'describe'
                  ? 'e.g. 12-week half marathon build to a 1:30 at the Brooklyn Half, 4 runs a week, long run Saturday, 2 lifts, nothing over 45 min on weekdays'
                  : mode === 'revise'
                    ? 'e.g. Move every long run to Sunday. Cut next week by 20%, I have a live deal. Add a Tuesday upper-body lift.'
                    : 'Optional: anything worth knowing, e.g. “skip the Week 6 race”, “my long run day is Sunday”'
              }
            />
          </Field>
        </div>
        <div className="brow grid2">
          <Field label={mode === 'revise' ? 'From' : 'Start date'} hint={mode === 'file' || mode === 'text' ? 'Week 1 of the source starts here' : undefined}>
            <input className="in bare" type="date" value={start || defaultStart} onChange={(e) => setStart(e.target.value)} disabled={busy} />
          </Field>
          {mode === 'file' || mode === 'text' ? null : (
            <Field label={mode === 'revise' ? 'Through' : 'End by (optional)'}>
              <input className="in bare" type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={busy} />
            </Field>
          )}
        </div>
        {error ? (
          <div className="brow">
            <Note kind="bad">{error}</Note>
          </div>
        ) : null}
        <div className="brow foot">
          <AnimatePresence>
            {busy ? (
              <motion.span className="row t-sub muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Building the plan. 20–60 seconds…
              </motion.span>
            ) : (
              <span />
            )}
          </AnimatePresence>
          {busy ? (
            <Button variant="ghost" onClick={() => ctl.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={() => build.mutate()}>
              {mode === 'revise' ? 'Draft' : 'Build'}
            </Button>
          )}
        </div>
      </Group>
      <p className="fine" style={{ marginTop: 8 }}>
        Reads your source, your recent Strava weeks and heart-rate zones, then returns dated sessions you can check before saving.
      </p>
    </>
  );
};

const SRC_WORD: Record<string, string> = { file: 'a file', text: 'pasted text', describe: 'your description', revise: 'a revision', chat: 'chat', sheet: 'your spreadsheet' };
const planState = (b: PlanBlock, t: string) => (t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active');
const planMeta = (b: PlanBlock) => `${fmtDate('md', b.start)} – ${fmtDate('md', b.end)} · ${b.sessionCount ?? 0} sessions${b.source ? ` · from ${SRC_WORD[b.source] ?? b.source}` : ''}`;

/** The plan's sheet: what it is, then the two things you can do with it. */
const PlanSheet = ({ b, t }: { b: PlanBlock; t: string }) => {
  const sheet = useSheet();
  const nav = useNavigate();
  const toast = useToast();
  const { remove } = useBlockMutations();
  const [confirm, setConfirm] = useState(false);
  const state = planState(b, t);
  const weeks = Math.ceil((daysBetween(b.start, b.end) + 1) / 7);
  return (
    <>
      <div className="plan-sheet">
        <div className="row" style={{ gap: 8 }}>
          <Chip kind={state === 'Active' ? 'open' : state === 'Upcoming' ? 'upcoming' : ''}>{state}</Chip>
          <span className="t-sub muted">
            {fmtDate('md', b.start)} – {fmtDate('md', b.end)}
          </span>
        </div>
        <StatStrip>
          <Stat label="Weeks" value={weeks} />
          <Stat label="Sessions" value={b.sessionCount ?? 0} />
        </StatStrip>
        {b.summary ? <p className="t-body ink2">{b.summary}</p> : null}
        {b.source ? <span className="t-cap muted">From {SRC_WORD[b.source] ?? b.source}</span> : null}
      </div>
      <div className="sheet-foot">
        {confirm ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                remove.mutate(b);
                sheet.close();
                toast('Plan deleted');
              }}
            >
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        )}
        <div className="foot-right">
          <Button
            variant="primary"
            onClick={() => {
              sheet.close();
              nav(`/plan/week/${b.start < t && t <= b.end ? t : b.start}`);
            }}
          >
            Open
          </Button>
        </div>
      </div>
    </>
  );
};

export const PlansList = ({ log }: { log: Log }) => {
  const blocks = log.boot?.blocks ?? [];
  const sheet = useSheet();
  const t = log.today;
  return (
    <>
      <SectionHead title="Your plans" meta={blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'plan' : 'plans'}` : undefined} />
      <Group>
        {!blocks.length ? (
          <EmptyState action={<AddSessionButton date={t} variant="soft" />}>{log.features.claude ? 'No plans yet. Build one above, or add a session.' : 'No plans yet. Add a session.'}</EmptyState>
        ) : (
          <ul>
            {blocks.map((b) => {
              const state = planState(b, t);
              return (
                <Row
                  key={b.id}
                  as="li"
                  className="plan-row"
                  title={b.name}
                  sub={planMeta(b)}
                  right={
                    <>
                      <Chip kind={state === 'Active' ? 'open' : state === 'Upcoming' ? 'upcoming' : ''}>{state}</Chip>
                      <ChevronRight size={18} />
                    </>
                  }
                  onClick={() => sheet.open({ title: b.name, body: <PlanSheet b={b} t={t} /> })}
                />
              );
            })}
          </ul>
        )}
      </Group>
    </>
  );
};

export const Upcoming = ({ log }: { log: Log }) => {
  const open = useOpenSession(log);
  const t = log.today;
  const items: Array<[string, ReturnType<Log['snap']['sessionsOn']>[number]]> = [];
  for (let d = t; d <= shiftDays(t, 13); d = shiftDays(d, 1)) for (const s of log.snap.sessionsOn(d)) if (s.kind !== 'rest') items.push([d, s]);
  return (
    <>
      <SectionHead title="Next two weeks" meta={items.length ? `${items.length} ${items.length === 1 ? 'session' : 'sessions'}` : undefined} />
      <Group>
        {!items.length ? (
          <EmptyState>Nothing planned in the next two weeks.</EmptyState>
        ) : (
          <ul>
            {items.map(([d, s]) => (
              <li key={s.id}>
                <button type="button" className={`lrow tappable uprow t-${tone(s)}`} onClick={() => open(d, s)}>
                  <span className="up-date caps">{d === t ? 'Today' : `${fmtDate('dow', d)} ${parseISO(d).getDate()}`}</span>
                  <span className="up-sess">
                    <i className="tone-dot" aria-hidden="true" />
                    <span className="stamp up-stamp">{label(s)}</span>
                  </span>
                  <span className="up-det">{s.details ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Group>
    </>
  );
};
