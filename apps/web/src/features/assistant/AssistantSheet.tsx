import { fmtDate, PHASE_WORDS, screenLabel, type AssistantChange, type AssistantLive, type AssistantProposal, type AssistantScreen, type AssistantTurn, type ISODate } from '@logbook/shared';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bike,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  CornerDownRight,
  Dumbbell,
  FileText,
  Footprints,
  Lightbulb,
  Moon,
  Paperclip,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  SquarePen,
  Sun,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { askAssistant, stopAssistant, useAssistantActions } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { ATTACHMENT_LIMITS, type AssistantFileShown } from '@logbook/shared';
import { AttachError, prepareFile, type PreparedFile } from './attach';
import { regenerate, retryAsk, sendTurn, stopAsk } from './conversation';
import { Rich } from './Rich';
import { assistantStore, useAssistantBusy, useAssistantLive, useAssistantTurns } from './store';
import './assistant.css';

/** What a change is about, for its icon: a workout added, a change to the plan's days, a to-do, a goal. Deletes are flagged. */
const kindOf = (c: AssistantChange): { Icon: LucideIcon; risky?: boolean } => {
  const op = c.op;
  switch (op.op) {
    case 'add_session':
      return { Icon: op.kind === 'lift' ? Dumbbell : op.kind === 'cross' ? Bike : op.kind === 'rest' ? Moon : Footprints };
    case 'mark_session':
      return { Icon: CalendarCheck };
    case 'delete_session':
      return { Icon: CalendarX, risky: true };
    case 'move_session':
    case 'update_session':
      return { Icon: CalendarDays };
    case 'delete_todo':
      return { Icon: CheckSquare, risky: true };
    case 'add_todo':
    case 'update_todo':
      return { Icon: CheckSquare };
    default:
      return { Icon: Target };
  }
};

/** A proposal of more than this many changes shows the first six and a "Show all" (a plan can be fifty). */
const FOLD_OVER = 8;
const changesWord = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

/**
 * A proposal (docs/inspiration.md §3, Proposal card): the summary, then each change on its own card with its icon, its
 * words and its reason, and a Remove for leaving that one out. Apply names how many will run; after it, Undo.
 */
const ProposalCard = ({ p, waiting }: { p: AssistantProposal; waiting: boolean }) => {
  const { apply, undo, dismiss } = useAssistantActions();
  const [all, setAll] = useState(false);
  const toast = useToast();
  const skipped = new Set(p.skipped ?? []);
  const live = p.changes.length - skipped.size;
  const open = p.status === 'proposed';
  const busy = apply.isPending || undo.isPending || dismiss.isPending;
  const shown = all || p.changes.length <= FOLD_OVER ? p.changes : p.changes.slice(0, 6);
  const toggle = (i: number) => {
    const next = skipped.has(i) ? [...skipped].filter((x) => x !== i) : [...skipped, i];
    assistantStore.setProposal({ ...p, skipped: next.sort((a, b) => a - b) });
  };
  const run = async (fn: () => Promise<AssistantProposal>, ok?: () => void) => {
    try {
      const next = await fn();
      // the server says what it skipped once applied; a dismissed one keeps what was removed here
      assistantStore.setProposal(next.skipped || next.status !== 'dismissed' ? next : { ...next, skipped: p.skipped });
      ok?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t go through. Try again.');
    }
  };
  const applied = p.status === 'applied';
  return (
    <section className={`as-proposal card is-${p.status}`} data-waiting={waiting ? '' : undefined} aria-label="Proposed changes">
      <header className="as-prop-head">
        <span className="caps">{open ? `${changesWord(p.changes.length)} to review` : 'Changes'}</span>
        <p className="as-proposal-sum">{p.summary}</p>
      </header>
      <ul className="as-changes">
        {shown.map((c, i) => {
          const { Icon, risky } = kindOf(c);
          const off = skipped.has(i);
          return (
            <li key={i} className={`as-change${off ? ' is-off' : ''}${risky ? ' is-risky' : ''}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <span className="icon-tile as-change-ic" aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span className="as-change-body">
                <span className="as-change-text">
                  {off ? <span className="sr-only">Removed: </span> : null}
                  {c.label}
                </span>
                {c.reason ? <span className="as-change-why">{c.reason}</span> : null}
              </span>
              {open ? (
                <button type="button" className="as-change-x" disabled={busy} aria-label={off ? `Put back: ${c.label}` : `Remove: ${c.label}`} onClick={() => toggle(i)}>
                  {off ? <RotateCcw size={15} aria-hidden="true" /> : <X size={15} strokeWidth={2.4} aria-hidden="true" />}
                </button>
              ) : off ? (
                <span className="as-change-left">Left out</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {shown.length < p.changes.length ? (
        <button type="button" className="as-more" onClick={() => setAll(true)}>
          Show all {p.changes.length} changes
        </button>
      ) : null}
      {open ? (
        <div className="as-proposal-foot">
          <Button variant="quiet" disabled={busy} onClick={() => void run(() => dismiss.mutateAsync(p.id))}>
            Not now
          </Button>
          <Button variant="primary" className="as-apply" disabled={busy || live === 0} aria-busy={apply.isPending} onClick={() => void run(() => apply.mutateAsync({ id: p.id, skip: p.skipped }), () => haptics.drop())}>
            {apply.isPending ? 'Applying…' : live === 0 ? 'Apply' : `Apply ${changesWord(live)}`}
          </Button>
        </div>
      ) : (
        <div className="as-proposal-state">
          <span className={`as-status ${applied ? 'is-on' : ''}`}>
            {applied ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : p.status === 'undone' ? <RotateCcw size={14} strokeWidth={2.4} aria-hidden="true" /> : <X size={14} strokeWidth={2.4} aria-hidden="true" />}
            {applied ? (skipped.size ? `Applied ${live} of ${p.changes.length}` : 'Applied') : p.status === 'undone' ? 'Undone' : 'Not applied'}
          </span>
          {applied ? (
            <button type="button" className="as-undo" disabled={busy} onClick={() => void run(() => undo.mutateAsync(p.id))}>
              <RotateCcw size={14} aria-hidden="true" /> {undo.isPending ? 'Undoing…' : 'Undo'}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
};

/** The files a turn carried, as the thread shows them: a photo's preview, a PDF's name. */
const TurnFiles = ({ files }: { files: AssistantFileShown[] }) => (
  <div className="as-turn-files">
    {files.map((f, i) =>
      f.thumb ? (
        <img key={i} className="as-turn-photo" src={f.thumb} alt={f.name} />
      ) : (
        <span key={i} className="as-turn-doc">
          <FileText size={15} aria-hidden="true" />
          <span>{f.name}</span>
        </span>
      ),
    )}
  </div>
);

/** Rows that send themselves: the starters on an empty conversation, the suggested replies after an answer. */
const ReplyRows = ({ items, label, onPick }: { items: string[]; label: string; onPick: (s: string) => void }) => (
  <div className="as-replies" role="group" aria-label={label}>
    {items.map((s) => (
      <button key={s} type="button" className="as-reply" onClick={() => onPick(s)}>
        <CornerDownRight size={16} className="as-reply-ic" aria-hidden="true" />
        <span className="as-reply-text">{s}</span>
      </button>
    ))}
  </div>
);

const SCREEN_ICON: Record<AssistantScreen['tab'], LucideIcon> = { today: Sun, plan: CalendarDays, progress: Activity, goals: Target, learned: Lightbulb, journal: BookOpen };

const startersFor = (date: ISODate, today: ISODate) => {
  const day = date === today ? 'today' : fmtDate('short', date);
  return [
    `Push the runs I missed this week to next week`,
    `Move ${day === 'today' ? 'today’s' : `${day}’s`} run to the next day`,
    `What’s left on the plan this week?`,
    `Set this week’s goal from my plan`,
  ];
};

/** Seconds since `since`, ticking once a second while shown. */
const useSeconds = (since: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - since) / 1000));
};

/**
 * The words as they arrive, revealed smoothly: the server's text comes in chunks a third of a second apart; this lets
 * the shown text catch up a few characters a frame, so it flows instead of jumping.
 */
const useSmoothText = (target: string) => {
  const [n, setN] = useState(target.length);
  const want = useRef(target);
  want.current = target;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setN((cur) => {
        const goal = want.current.length;
        if (cur > goal) return goal;
        if (cur === goal) return cur;
        return Math.min(goal, cur + Math.max(1, Math.ceil((goal - cur) / 9)));
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return target.slice(0, Math.min(n, target.length));
};

/** The reasoning summary, folded: "Thought for 6s ›" opens it. */
const Thoughts = ({ text, seconds, live }: { text: string; seconds: number; live?: boolean }) => {
  const [open, setOpen] = useState(false);
  if (!text && !live) return seconds >= 1 ? <span className="as-thought-for">Thought for {seconds}s</span> : null;
  return (
    <div className={`as-thoughts${open ? ' is-open' : ''}`}>
      <button type="button" className="as-thought-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {live ? 'Show thinking' : `Thought for ${Math.max(1, seconds)}s`}
        <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {open ? <p className="as-thought-text">{text || '…'}</p> : null}
    </div>
  );
};

/**
 * The answer while it is written (docs/inspiration.md §4): what it is doing now with the seconds running ("Reading your
 * plan · 4s", a shimmer over the words), its reasoning to open, and its words so far flowing in behind a caret. Before the
 * first look comes back it says Thinking. After 20 s a line says closing is fine.
 */
const LiveAnswer = ({ since, live }: { since: number; live: AssistantLive | null }) => {
  const secs = useSeconds(since);
  const text = useSmoothText(live?.text ?? '');
  const phase = live?.phase ?? 'thinking';
  const writing = phase === 'writing' && text.length > 0;
  return (
    <div className="as-turn is-assistant is-live">
      <div className="as-answer as-live" aria-busy="true">
        {!writing ? (
          <p className="as-phase" aria-live="polite">
            <span className="as-orb" aria-hidden="true" />
            <span className="as-shimmer">{PHASE_WORDS[phase]}</span>
            <span className="as-phase-secs">{secs}s</span>
          </p>
        ) : null}
        {live?.thoughts ? <Thoughts text={live.thoughts} seconds={secs} live /> : null}
        {text ? <Rich text={text} after={writing ? <span className="as-caret" aria-hidden="true" /> : null} /> : null}
        {secs >= 20 && !text ? <p className="as-slow">Still working. A plan from photos can take a minute or two. You can close this and come back.</p> : null}
      </div>
    </div>
  );
};

/** Under a finished answer: how long it thought, Copy, and Regenerate on the newest one. */
const AnswerMeta = ({ t, newest, onRegenerate }: { t: AssistantTurn; newest: boolean; onRegenerate: () => void }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.text);
      haptics.select();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast('Couldn’t copy that.');
    }
  };
  return (
    <div className="as-meta">
      {t.stopped ? <span className="as-stopped">Stopped</span> : <Thoughts text={t.thoughts ?? ''} seconds={t.thoughtSeconds ?? 0} />}
      <span className="as-meta-actions">
        <button type="button" className="as-meta-btn" aria-label={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
          {copied ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : <Copy size={15} strokeWidth={2.2} aria-hidden="true" />}
        </button>
        {newest ? (
          <button type="button" className="as-meta-btn" aria-label="Ask again" onClick={onRegenerate}>
            <RotateCw size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </div>
  );
};

/** The waiting proposal, when it has scrolled out of view: a bar over the composer that brings it back. */
const useOutOfView = (el: HTMLElement | null) => {
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return setOut(false);
    const root = el.closest<HTMLElement>('.sheet-body');
    // the composer sits over the bottom of the scroller: a proposal behind it is not in view
    const io = new IntersectionObserver(([e]) => setOut(!e!.isIntersecting), { root, rootMargin: '0px 0px -120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return out;
};

/**
 * The assistant (Claude Sonnet): ask in words; it answers, or proposes changes to the plan, to-dos and goals that run only
 * when Apply is tapped (and Undo takes back). The conversation stays for the session; an ask keeps going with the sheet
 * closed. `screen` is where it was opened from, shown as a chip the owner can remove.
 */
export const AssistantSheet = ({ date, initial, screen: openedFrom }: { date: ISODate; initial?: string; screen?: AssistantScreen }) => {
  const today = useToday();
  const turns = useAssistantTurns();
  const busySince = useAssistantBusy();
  const live = useAssistantLive();
  const busy = busySince !== null;
  // turns added while the sheet is open come in with a rise; the ones already there just show
  const mountedAt = useRef(turns.length);
  const [screen, setScreen] = useState(openedFrom);
  // with the screen removed, the question is about no page in particular: today
  const askDate = openedFrom && !screen ? today : date;
  const [draft, setDraft] = useState(initial ?? '');
  const [pending, setPending] = useState<PreparedFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  // a request handed in pre-filled (Plan's "Move them") shows whole, not cut to one line
  useEffect(() => {
    const el = field.current;
    if (!el || !initial) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [initial]);
  // a new turn comes into view; a proposal shows from its top, so its summary is read first
  const last = turns[turns.length - 1];
  useLayoutEffect(() => {
    if (last?.role === 'assistant' && last.proposal && !busy) lastTurn.current?.scrollIntoView({ block: 'start' });
    else {
      // to the very bottom of the scroller, so nothing sits under the pinned composer
      const body = end.current?.closest<HTMLElement>('.sheet-body');
      if (body) body.scrollTop = body.scrollHeight;
    }
  }, [turns.length, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the words as they come while the thread is at its bottom; scrolled up to read, it stays put and offers a jump
  const [away, setAway] = useState(false);
  useEffect(() => {
    const body = end.current?.closest<HTMLElement>('.sheet-body');
    if (!body) return;
    const on = () => setAway(body.scrollHeight - body.scrollTop - body.clientHeight > 140);
    body.addEventListener('scroll', on, { passive: true });
    return () => body.removeEventListener('scroll', on);
  }, []);
  useLayoutEffect(() => {
    if (away) return;
    const body = end.current?.closest<HTMLElement>('.sheet-body');
    if (body) body.scrollTop = body.scrollHeight;
  }, [live?.text, live?.phase, live?.thoughts]); // eslint-disable-line react-hooks/exhaustive-deps
  const toBottom = () => {
    const body = end.current?.closest<HTMLElement>('.sheet-body');
    body?.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  };

  // the newest proposal still waiting for a decision, and whether it has scrolled away
  const waiting = [...turns].reverse().find((t) => t.proposal?.status === 'proposed')?.proposal ?? null;
  const [waitingEl, setWaitingEl] = useState<HTMLElement | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => setWaitingEl(thread.current?.querySelector<HTMLElement>('.as-proposal[data-waiting]') ?? null), [waiting?.id, turns.length]);
  const outOfView = useOutOfView(waitingEl);
  const waitingCount = waiting ? waiting.changes.length - (waiting.skipped?.length ?? 0) : 0;

  /** Picked files: each becomes a photo (shrunk, as a JPEG) or a PDF, up to four with a message. */
  const addFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const room = ATTACHMENT_LIMITS.perTurn - pending.length;
    if (files.length > room) toast(`Up to ${ATTACHMENT_LIMITS.perTurn} files with a message. ${room > 0 ? `The first ${room} ${room === 1 ? 'was' : 'were'} added.` : ''}`.trim());
    setPreparing(true);
    try {
      const ready: PreparedFile[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        try {
          ready.push(await prepareFile(f));
        } catch (e) {
          toast(e instanceof AttachError ? e.message : `Couldn’t add ${f.name || 'that file'}.`);
        }
      }
      if (ready.length) setPending((p) => [...p, ...ready].slice(0, ATTACHMENT_LIMITS.perTurn));
    } finally {
      setPreparing(false);
      if (picker.current) picker.current.value = '';
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    const files = pending;
    if ((!t && !files.length) || busy || preparing) return;
    setDraft('');
    setPending([]);
    // the field grew with the words; empty again, it goes back to one line
    if (field.current) field.current.style.height = '';
    void sendTurn(askAssistant, askDate, screen, t, { shown: files.length ? files.map((f) => f.shown) : undefined, data: files.map((f) => f.file) });
  };

  const replies = !busy && last?.role === 'assistant' && !last.error && last.replies?.length ? last.replies : null;

  // "New" lives in the sheet's header, at the right, once there is a conversation to clear (shape system §5)
  const sheet = useSheet();
  const hasTurns = turns.length > 0;
  useEffect(() => {
    sheet.update({
      action: hasTurns ? (
        <button type="button" className="icon-btn as-new" aria-label="New conversation" title="New conversation" onClick={() => assistantStore.clear()}>
          <SquarePen size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : undefined,
    });
  }, [hasTurns]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="as-sheet">
      <div className="as-thread" ref={thread} aria-live="polite">
        {screen ? (
          <div className="as-context">
            <span className="ctx-chip as-ctx">
              <span className="ctx-ic" aria-hidden="true">
                {(() => {
                  const Icon = SCREEN_ICON[screen.tab];
                  return <Icon size={16} />;
                })()}
              </span>
              <span className="ctx-text">
                <span className="ctx-title">{screenLabel(screen)}</span>
                <span className="ctx-sub">Sent with your question</span>
              </span>
              <button type="button" className="as-chip-x" aria-label={`Don’t send ${screenLabel(screen)} with the question`} onClick={() => setScreen(undefined)}>
                <X size={14} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </span>
          </div>
        ) : null}
        {turns.length === 0 ? (
          <div className="as-empty">
            <section className="card as-intro">
              <span className="as-intro-ic" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <p className="as-intro-title display">Ask about your plan, or ask for a change.</p>
              <p className="as-intro-sub">Attach a photo or a PDF of a plan, a schedule or a list and it can read it. Nothing changes until you tap Apply.</p>
            </section>
            <h3 className="as-head">Try one</h3>
            <ReplyRows items={startersFor(askDate, today)} label="Ways to start" onPick={send} />
          </div>
        ) : (
          turns.map((t, i) => (
            <div key={i} ref={i === turns.length - 1 ? lastTurn : undefined} className={`as-turn is-${t.role}${t.error ? ' is-error' : ''}${i >= mountedAt.current ? ' is-new' : ''}`}>
              {t.files?.length ? <TurnFiles files={t.files} /> : null}
              {t.error ? (
                <div className="as-error" role="alert">
                  <CircleAlert size={16} className="as-error-ic" aria-hidden="true" />
                  <p>{t.text}</p>
                  {i === turns.length - 1 && !busy ? (
                    <button type="button" className="as-retry" onClick={() => void retryAsk(askAssistant, askDate, screen)}>
                      <RotateCw size={14} strokeWidth={2.4} aria-hidden="true" /> Retry
                    </button>
                  ) : null}
                </div>
              ) : t.text ? (
                t.role === 'user' ? (
                  <p className="as-bubble">{t.text}</p>
                ) : (
                  <div className="as-answer">
                    <Rich text={t.text} />
                  </div>
                )
              ) : null}
              {t.proposal ? <ProposalCard p={t.proposal} waiting={t.proposal.id === waiting?.id} /> : null}
              {t.role === 'assistant' && !t.error ? <AnswerMeta t={t} newest={i === turns.length - 1 && !busy} onRegenerate={() => void regenerate(askAssistant, askDate, screen)} /> : null}
            </div>
          ))
        )}
        {replies ? <ReplyRows items={replies} label="Suggested replies" onPick={send} /> : null}
        {busySince !== null ? <LiveAnswer since={busySince} live={live} /> : null}
        <div ref={end} />
      </div>
      <div className="as-compose">
        {away && (busy || turns.length > 0) && !(waiting && outOfView) ? (
          <button type="button" className="icon-btn as-jump" aria-label="Jump to the newest" onClick={toBottom}>
            <ArrowDown size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
        {waiting && outOfView ? (
          <button type="button" className="as-review" onClick={() => waitingEl?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
            <span className="as-review-n" aria-hidden="true">
              {waitingCount}
            </span>
            <span className="as-review-text">
              Review changes<span className="sr-only"> ({waitingCount})</span>
            </span>
            <ChevronUp size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
        {pending.length || preparing ? (
          <div className="as-files" aria-label="Files to send">
            {pending.map((f, i) => (
              <span key={i} className={`as-file ${f.shown.thumb ? 'is-photo' : 'is-doc'}`}>
                {f.shown.thumb ? <img src={f.shown.thumb} alt="" /> : <FileText size={18} aria-hidden="true" />}
                {f.shown.thumb ? null : <span className="as-file-name">{f.shown.name}</span>}
                <button type="button" className="as-file-x" aria-label={`Remove ${f.shown.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                  <X size={12} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </span>
            ))}
            {preparing ? (
              <span className="as-file is-preparing" aria-label="Preparing">
                …
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="as-pill">
          <button type="button" className="as-attach" aria-label="Attach a photo or a PDF" disabled={busy || preparing || pending.length >= ATTACHMENT_LIMITS.perTurn} onClick={() => picker.current?.click()}>
            <Paperclip size={18} aria-hidden="true" />
          </button>
          <input ref={picker} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => void addFiles(e.currentTarget.files)} />
          <textarea
            ref={field}
            className="as-input"
            rows={1}
            maxLength={2000}
            placeholder={pending.length ? 'Add a note (optional)' : askDate !== today ? `Ask about ${fmtDate('short', askDate)}` : 'Ask anything'}
            aria-label="Ask the assistant"
            enterKeyHint="send"
            value={draft}
            autoFocus
            onFocus={(e) => revealField(e.currentTarget)}
            onChange={(e) => {
              setDraft(e.target.value);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          {busy ? (
            <button type="button" className="as-send is-stop" aria-label="Stop" onClick={() => void stopAsk(stopAssistant)}>
              <Square size={13} strokeWidth={0} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={`as-send${draft.trim() || pending.length ? ' is-ready' : ''}`} aria-label="Send" disabled={(!draft.trim() && !pending.length) || preparing} onClick={() => send(draft)}>
              <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
