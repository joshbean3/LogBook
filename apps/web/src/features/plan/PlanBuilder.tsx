import { CONSENT_VERSION, daysBetween, fmtDate, label, mondayOf, monthsBetween, num, parseISO, shiftDays, tone, type PlanBlock, type PlanDraft } from '@logbook/shared';
import { errorWords } from './errorWords';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { oneAtATime } from './oneAtATime';
import { useNav, useTab } from '@/app/NavController';
import { api, ApiError, LONG_TIMEOUT_MS } from '@/api/client';
import { keys, useMonths, useTemplateUndo, type PlanTemplateResult } from '@/api/queries';
import { consentKey, useConsent, useSaveConsent } from '@/lib/consent';
import { DISCLAIMER } from '@/lib/copy';
import { haptics } from '@/lib/haptics';
import { LEGAL, openExternal } from '@/lib/siteLinks';
import { Button, Chip, Field, Group, Note, Segmented, Stat, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { SectionHeader } from '@/ui/layout';
import { useLog, type Log } from '../log/useLog';
import { applyChoice, draftMonths, mayDraft, replacedBy } from './applyModel';
import { announceApplied, builderSpec } from './Builder';
import type { BuilderPrefill } from './builderModel';
import { requestDraft } from './draftRequest';
import { dayRange } from '@/ui/charts/range';

type Mode = 'file' | 'text' | 'describe' | 'revise';
const MODES: Array<[Mode, string]> = [
  ['file', 'File'],
  ['text', 'Paste'],
  ['describe', 'Describe'],
  ['revise', 'Revise'],
];
const nextMonday = (t: string) => shiftDays(mondayOf(t), 7);
/** Miles to one decimal, whole miles without `.0` (`300`, `25`, `6.5`). */
const mi = (v: number) => num(Math.round(v * 10) / 10);

/** `POST /plans/apply`'s answer. `replacedIds` (and the plans it ended) are what Undo puts back; `addedIds` what it takes out of a revised plan. */
type Applied = { block: PlanBlock; months: string[] } & Pick<PlanTemplateResult, 'replacedIds' | 'endedBlock' | 'endedBlocks' | 'addedIds'>;

const Preview = ({ draft, mode, onDone, onDiscard }: { draft: PlanDraft; mode: Mode; onDone: () => void; onDiscard: () => void }) => {
  const qc = useQueryClient();
  const nav = useNav();
  const tab = useTab();
  const toast = useToast();
  const sheet = useSheet();
  const undo = useTemplateUndo();
  const [name, setName] = useState(draft.name);
  // every month the draft covers, loaded here: the sheet's own log holds the month on screen, and most drafts start in a
  // later one. Until they are in, nobody knows what a Replace would take away, so no button is live
  const months = useMemo(() => draftMonths(draft), [draft.start, draft.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const span = useLog(months);
  const failed = useMonths(months).error;
  const replaced = useMemo(() => replacedBy({ loaded: (m) => span.snap.loaded(m), sessionsOn: (d) => span.snap.sessionsOn(d) }, draft), [span.snap, draft.start, draft.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const choice = applyChoice(replaced, mode === 'revise');
  const existing = replaced?.length ?? 0;
  const miles = draft.sessions.reduce((t, s) => t + (s.kind === 'run' ? s.miles ?? 0 : 0), 0);
  const byDate = new Map<string, PlanDraft['sessions']>();
  for (const s of draft.sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const apply = useMutation({
    mutationFn: (v: { mode: 'replace' | 'add'; ids: string[] }) => api<Applied>('/plans/apply', { method: 'POST', json: { draft: { ...draft, name: name.trim() || draft.name }, mode: v.mode, source: mode }, timeoutMs: LONG_TIMEOUT_MS }),
    onSuccess: async (r, v) => {
      for (const m of monthsBetween(shiftDays(draft.start, -14), shiftDays(draft.end, 14))) void qc.invalidateQueries({ queryKey: keys.month(m) });
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      // what the write took away, as the server lists it; from a server that does not list it yet, the sessions this
      // preview counted (the same rule). Undo deletes the new plan and puts every one of them back
      const replacedIds = v.mode === 'replace' ? (r.replacedIds ?? v.ids) : [];
      const result: PlanTemplateResult = { block: r.block, months: r.months, removed: replacedIds.length, replacedIds, endedBlock: r.endedBlock, endedBlocks: r.endedBlocks, addedIds: r.addedIds };
      if (replacedIds.length) haptics.delete();
      announceApplied(toast, result, () =>
        undo.mutateAsync(result).then(
          () => undefined,
          () => toast('Couldn’t undo. The new plan is still there.'),
        ),
      );
      onDone();
      sheet.close();
      if (tab === 'plan') nav.go(`/plan/week/${mondayOf(r.block.start)}`);
    },
    onError: (e) => toast(errorWords(e, 'Couldn’t save the plan. Try again.')),
  });
  const weeks: string[] = [];
  for (let mon = mondayOf(draft.start); mon <= draft.end; mon = shiftDays(mon, 7)) weeks.push(mon);
  const nWeeks = Math.ceil((daysBetween(draft.start, draft.end) + 1) / 7);
  // one plan per press (oneAtATime.ts): `disabled` waits for a render, and two presses in one task would write it twice
  const applyNow = useRef(apply.mutateAsync);
  applyNow.current = apply.mutateAsync;
  // the failure is said by the mutation's own onError: the lock only needs to know when it settled
  const [applyOnce] = useState(() => oneAtATime((v: { mode: 'replace' | 'add'; ids: string[] }) => applyNow.current(v).catch(() => undefined)));
  const send = (m: 'replace' | 'add') => replaced && !apply.isPending && applyOnce({ mode: m, ids: replaced });
  return (
    // one block in the sheet's body (as `.tp` is for the builder): the body's grid would shrink the week list to fit and
    // nothing could scroll (16 weeks in 170 px)
    <div className="pv">
      <SectionHeader size="sm" level={3} title="Preview" meta="Nothing is saved yet" />
      <div className="pv-hero">
        <span className="caps pv-ai">Written by the assistant</span>
        <input className="pv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Plan name" />
        <span className="t-cap muted">
          {dayRange(draft.start, draft.end)}
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
      <SectionHeader size="sm" level={3} className="pv-head" title="Week by week" meta={`${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`} />
      <Group className="pv-weeks">
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
      <p className="fine pv-fine">{DISCLAIMER}</p>
      {existing ? (
        <p className="fine pv-fine">
          {existing} planned {existing === 1 ? 'session' : 'sessions'} already {existing === 1 ? 'sits' : 'sit'} in these dates. Replace clears {existing === 1 ? 'it' : 'them'}, and Undo puts {existing === 1 ? 'it' : 'them'} back.{choice.keep ? ` Add keeps ${existing === 1 ? 'it' : 'them'}.` : ''}
        </p>
      ) : null}
      {replaced == null && failed ? (
        <div className="pv-retry">
          <Note kind="bad">Couldn’t check your calendar.</Note>
          <Button variant="soft" size="sm" onClick={() => months.forEach((m) => void qc.refetchQueries({ queryKey: keys.month(m) }))}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="pv-actions">
        {choice.keep ? (
          <Button variant="soft" disabled={apply.isPending} onClick={() => send('add')}>
            Add, keep them
          </Button>
        ) : null}
        <Button variant="quiet" onClick={onDiscard}>
          Discard
        </Button>
      </div>
      {/* not `pv-foot`: the welcome pager's class of that name (auth/start.css) takes every press away from its children */}
      <div className="sheet-foot pv-save">
        <Button variant="primary" block disabled={!choice.primary || apply.isPending} onClick={() => choice.primary && send(choice.primary.mode)}>
          {apply.isPending ? 'Saving' : (choice.primary?.label ?? (failed ? 'Calendar not loaded' : 'Checking your calendar…'))}
        </Button>
      </div>
    </div>
  );
};

// ---------- the permission step (Contract 1): nothing goes to Claude before a yes ----------

/**
 * Asked the first time an account that never answered (`consent.at` null) opens the AI builder, and again whenever the
 * server says `consent_required`. Allow stores the choice on the account; Not now stores nothing and sends nothing.
 */
const Permission = ({ onAllowed, onNotNow }: { onAllowed: () => void; onNotNow: () => void }) => {
  const save = useSaveConsent();
  const [error, setError] = useState<string | null>(null);
  const allow = () => {
    setError(null);
    save.mutateAsync({ training: true, version: CONSENT_VERSION }).then(onAllowed, () => setError('Couldn’t save your choice. Check your connection and try again.'));
  };
  return (
    <div className="pb-ask">
      <div className="card pb-ask-card">
        <h3 className="pb-ask-title">Let the assistant write your plan?</h3>
        <p className="pb-ask-p">The assistant is Claude, by Anthropic. What you type or paste here, and any file or photo you attach, goes to Claude to write your plan.</p>
        <p className="pb-ask-p">Allow also lets the assistant read your plan, sessions, training status, goals and to-dos. You can change this in Settings, under Privacy.</p>
        <button type="button" className="pb-ask-link" onClick={() => openExternal(LEGAL.privacy)}>
          Privacy policy
        </button>
      </div>
      {error ? <Note kind="bad">{error}</Note> : null}
      <div className="sheet-foot pb-ask-foot">
        <Button variant="quiet" disabled={save.isPending} onClick={onNotNow}>
          Not now
        </Button>
        <Button variant="primary" disabled={save.isPending} onClick={allow}>
          Allow
        </Button>
      </div>
    </div>
  );
};

/** After Not now: nothing was sent, and the plan can still be built by hand. */
const Declined = ({ log, onBack }: { log: Log; onBack: () => void }) => {
  const sheet = useSheet();
  return (
    <div className="pb-ask">
      <div className="card pb-ask-card">
        <h3 className="pb-ask-title">Nothing was sent</h3>
        <p className="pb-ask-p">The assistant stays off until you allow it. You can still build a plan yourself: pick a goal, your run days and your weekly miles.</p>
      </div>
      <div className="sheet-foot pb-ask-foot">
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={() => sheet.open(builderSpec(log))}>
          Build it myself
        </Button>
      </div>
    </div>
  );
};

// ---------- the wait: what is happening, how long it has been, and Stop ----------
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const Wait = () => {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="pb-wait" role="status">
      <span className="pb-wait-t">
        Writing your plan
        <span className="pb-wait-clock" aria-hidden="true">
          {clock(sec)}
        </span>
      </span>
      <span className="pb-wait-s">{sec < 75 ? 'Usually 20 to 60 seconds. Keep this open.' : 'A long plan can take two minutes. Keep this open.'}</span>
    </span>
  );
};

/** The one line the first time a file is attached; kept on this device once a file has been sent. */
const ATTACH_KEY = 'logbook.plan.attachNote';
const attachSeen = () => {
  try {
    return localStorage.getItem(ATTACH_KEY) === '1';
  } catch {
    return false;
  }
};
const markAttachSeen = () => {
  try {
    localStorage.setItem(ATTACH_KEY, '1');
  } catch {
    /* private mode: it shows again next time */
  }
};

export const PlanBuilder = ({ log }: { log: Log }) => {
  const t = log.today;
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [instr, setInstr] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the account's answer to the permission step: the live record, else the one the app opened with
  const consentQ = useConsent();
  const consent = consentQ.data ?? log.boot?.consent ?? null;
  /** The server refused a draft with `consent_required`: ask (again) whatever this device believed. */
  const [refused, setRefused] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [noteSeen] = useState(attachSeen);
  const ctl = useRef<AbortController | null>(null);
  // leaving the sheet stops the wait: a draft nobody is waiting for is never shown
  useEffect(() => () => ctl.current?.abort(), []);
  const defaultStart = mode === 'revise' ? mondayOf(t) : nextMonday(t);
  const build = useMutation({
    mutationFn: () => {
      setError(null);
      const ac = (ctl.current = new AbortController());
      if (mode === 'file' && file) markAttachSeen();
      return requestDraft({ mode, file, text, instructions: instr.trim(), start: start || defaultStart, end }, ac.signal);
    },
    onSuccess: (d) => setDraft(d),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'cancelled') return;
      if (e instanceof ApiError && e.code === 'consent_required') {
        setRefused(true);
        void qc.invalidateQueries({ queryKey: consentKey });
        return;
      }
      setError(e instanceof Error ? e.message : 'Something interrupted the request. Try again.');
    },
  });
  // one request per press: a second press in the same task would ask (and wait) twice
  const buildNow = useRef(build.mutateAsync);
  buildNow.current = build.mutateAsync;
  const [buildOnce] = useState(() => oneAtATime(() => buildNow.current().catch(() => undefined)));
  if (draft)
    return (
      <Preview
        draft={draft}
        mode={mode}
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
  // the answer is not on this device yet (a first open, offline): nothing to tap until it is
  if (!consent && consentQ.isPending) return <div className="pb-ask" aria-busy="true" />;
  if (declined) return <Declined log={log} onBack={() => setDeclined(false)} />;
  if (refused || !mayDraft(consent)) return <Permission onAllowed={() => setRefused(false)} onNotNow={() => setDeclined(true)} />;
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
            {file && !noteSeen ? <p className="fine pb-attach">This file goes to Claude, by Anthropic, to write your plan.</p> : null}
          </div>
        ) : mode === 'text' ? (
          <div className="brow">
            <Field label="Plan">
              <textarea className="in bare mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder="Paste the plan: an email, a table copied from a spreadsheet, a forum post…" />
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
                  ? 'A 12 week half marathon plan. 4 runs a week, long run Saturday, 2 strength days, weekdays under 45 minutes.'
                  : mode === 'revise'
                    ? 'Move every long run to Sunday. Make next week lighter.'
                    : 'Optional. Anything worth knowing.'
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
          {busy ? <Wait /> : <span />}
          {busy ? (
            <Button variant="ghost" onClick={() => ctl.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={() => buildOnce()}>
              {mode === 'revise' ? 'Draft' : 'Build'}
            </Button>
          )}
        </div>
      </Group>
      <p className="fine pb-fine">Your file or text goes to Claude, by Anthropic, to write the plan. Nothing is saved until you check it.</p>
      {consent?.training ? <p className="fine pb-fine">Reads your source and the runs you marked done, then returns dated sessions you can check before saving.</p> : null}
      <p className="fine pb-fine">{DISCLAIMER}</p>
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
