import { daysBetween, fmtDate, label, mi, mondayOf, monthsBetween, parseISO, shiftDays, tone, type PlanBlock, type PlanDraft } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useNav, useTab } from '@/app/NavController';
import { api, ApiError } from '@/api/client';
import { keys, usePlanDelete } from '@/api/queries';
import { Button, Chip, Field, Group, Note, SectionHead, Segmented, Stat, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { builderSpec } from './Builder';
import type { BuilderPrefill } from './builderModel';

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
  const nav = useNav();
  const tab = useTab();
  const toast = useToast();
  const sheet = useSheet();
  const [name, setName] = useState(draft.name);
  const existing = (() => {
    let n = 0;
    for (let d = draft.start; d <= draft.end; d = shiftDays(d, 1)) n += log.snap.sessionsOn(d).length;
    return n;
  })();
  const miles = draft.sessions.reduce((t, s) => t + (s.kind === 'run' ? s.miles ?? 0 : 0), 0);
  const byDate = new Map<string, PlanDraft['sessions']>();
  for (const s of draft.sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const { remove: removeBlock } = usePlanDelete();
  const apply = useMutation({
    mutationFn: (applyMode: 'replace' | 'add') => api<{ block: PlanBlock; months: string[] }>('/plans/apply', { method: 'POST', json: { draft: { ...draft, name: name.trim() || draft.name }, mode: applyMode, source: mode } }),
    onSuccess: async (r, applyMode) => {
      for (const m of monthsBetween(shiftDays(draft.start, -14), shiftDays(draft.end, 14))) void qc.invalidateQueries({ queryKey: keys.month(m) });
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      // spec §8: a toast only with an Undo (or for an error). An Add is undone by deleting the new block; a Replace cannot
      // be put back from here (the apply route returns no replaced ids: a request in docs/reviews/wp4.md), so it says
      // nothing and stays silent (`delete` is a destructive commit WITH Undo, contracts §D.3; code review 2 #11): the new
      // block on the calendar (and in Plans) is the answer
      if (!(applyMode === 'replace' && existing))
        toast(`${r.block.name} is on your calendar`, {
          label: 'Undo',
          fn: () => void removeBlock.mutateAsync(r.block).catch(() => toast('Couldn’t undo. The new plan is still there.')),
        });
      onDone();
      sheet.close();
      if (tab === 'plan') nav.go(`/plan/week/${mondayOf(r.block.start)}`);
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
        throw new ApiError('Couldn’t connect. Check your connection.', 0);
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
        Reads your source, your recent weeks of running and your heart-rate zones, then returns dated sessions you can check before saving.
      </p>
    </>
  );
};

// ---------- the builder's door (contracts §F) ----------

export { fromEndingBlock, type BuilderPrefill } from './builderModel';

/**
 * Opens the builder over the current tab (spec §1.6, §7.4): a large sheet whose fixed header is the ghost preview, with
 * `prefill` applied. Its doors: Plan's block card `New block ›`, the Plans page's `New block`, Today's plan-end `Next block`.
 * `Create` lands on the new block's first week only when the sheet was opened on Plan; over Today the tab stays.
 */
export const useOpenBuilder = (): ((prefill?: BuilderPrefill) => void) => {
  const sheet = useSheet();
  const log = useLog([]);
  return (prefill) => sheet.open(builderSpec(log, prefill));
};
