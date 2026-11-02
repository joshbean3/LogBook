import { fmtDate, type AssistantChange, type AssistantProposal, type ISODate } from '@logbook/shared';
import { ArrowUp, CalendarDays, CheckSquare, FileText, Paperclip, RotateCcw, Sparkles, Target, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { askAssistant, useAssistantActions } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { ATTACHMENT_LIMITS, type AssistantFileShown } from '@logbook/shared';
import { AttachError, prepareFile, requestTurns, type PreparedFile } from './attach';
import { assistantStore, useAssistantTurns } from './store';
import './assistant.css';

const iconOf = (c: AssistantChange) =>
  c.op.op.endsWith('_session') ? <CalendarDays size={15} aria-hidden="true" /> : c.op.op.endsWith('_todo') ? <CheckSquare size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />;

/** A proposal: what will happen, each change in words, and the one decision. After Apply it says so, with Undo. */
const ProposalCard = ({ p }: { p: AssistantProposal }) => {
  const { apply, undo, dismiss } = useAssistantActions();
  const toast = useToast();
  const busy = apply.isPending || undo.isPending;
  const run = async (fn: typeof apply, ok?: () => void) => {
    try {
      const next = await fn.mutateAsync(p.id);
      assistantStore.setProposal(next);
      ok?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t go through. Try again.');
    }
  };
  return (
    <div className={`as-proposal is-${p.status}`}>
      <p className="as-proposal-sum">{p.summary}</p>
      <ul className="as-changes">
        {p.changes.map((c, i) => (
          <li key={i} className="as-change">
            <span className="as-change-ic">{iconOf(c)}</span>
            <span className="as-change-text">{c.label}</span>
          </li>
        ))}
      </ul>
      {p.status === 'proposed' ? (
        <div className="as-proposal-foot">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              const next = await dismiss.mutateAsync(p.id).catch(() => null);
              if (next) assistantStore.setProposal(next);
            }}
          >
            Not now
          </Button>
          <Button variant="primary" disabled={busy} aria-busy={apply.isPending} onClick={() => void run(apply, () => haptics.drop())}>
            {apply.isPending ? 'Applying…' : p.changes.length === 1 ? 'Apply' : `Apply ${p.changes.length} changes`}
          </Button>
        </div>
      ) : (
        <div className="as-proposal-state">
          <span className="caps">{p.status === 'applied' ? 'Applied' : p.status === 'undone' ? 'Undone' : 'Not applied'}</span>
          {p.status === 'applied' ? (
            <button type="button" className="as-undo" disabled={busy} onClick={() => void run(undo)}>
              <RotateCcw size={14} aria-hidden="true" /> {undo.isPending ? 'Undoing…' : 'Undo'}
            </button>
          ) : null}
        </div>
      )}
    </div>
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

const startersFor = (date: ISODate, today: ISODate) => {
  const day = date === today ? 'today' : fmtDate('short', date);
  return [
    `Push the runs I missed this week to next week`,
    `Move ${day === 'today' ? 'today’s' : `${day}’s`} run to the next day`,
    `What’s left on the plan this week?`,
    `Set this week’s goal from my plan`,
  ];
};

/**
 * The assistant (Claude Sonnet): ask in words; it answers, or proposes changes to the plan, to-dos and goals that run only
 * when Apply is tapped (and Undo takes back). The conversation stays for the session.
 */
export const AssistantSheet = ({ date, initial }: { date: ISODate; initial?: string }) => {
  const today = useToday();
  const turns = useAssistantTurns();
  const [draft, setDraft] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PreparedFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, busy]);

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

  const send = async (text: string) => {
    const t = text.trim();
    const files = pending;
    if ((!t && !files.length) || busy || preparing) return;
    setDraft('');
    setPending([]);
    assistantStore.push({ role: 'user', text: t, files: files.length ? files.map((f) => f.shown) : undefined }, files.map((f) => f.file));
    setBusy(true);
    try {
      const history = requestTurns(assistantStore.get(), assistantStore.filesOf);
      const r = await askAssistant(date, history);
      assistantStore.push({ role: 'assistant', text: r.text, proposal: r.proposal });
    } catch (e) {
      assistantStore.push({ role: 'assistant', text: e instanceof Error ? `That didn’t go through: ${e.message}` : 'That didn’t go through. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="as-sheet">
      <div className="as-thread" aria-live="polite">
        {turns.length === 0 ? (
          <div className="as-empty">
            <p className="as-empty-lead">
              <Sparkles size={16} aria-hidden="true" /> Ask about your plan, or ask for a change. Attach a photo or a PDF of a plan, a schedule or a list and it can read it. Nothing changes until you tap Apply.
            </p>
            <div className="as-starters">
              {startersFor(date, today).map((s) => (
                <button key={s} type="button" className="as-starter" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={`as-turn is-${t.role}`}>
              {t.files?.length ? <TurnFiles files={t.files} /> : null}
              {t.text ? <p className="as-bubble">{t.text}</p> : null}
              {t.proposal ? <ProposalCard p={t.proposal} /> : null}
            </div>
          ))
        )}
        {busy ? (
          <div className="as-turn is-assistant">
            <p className="as-bubble as-typing" aria-label="Thinking">
              <i />
              <i />
              <i />
            </p>
          </div>
        ) : null}
        <div ref={end} />
      </div>
      <div className="as-compose">
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
            {preparing ? <span className="as-file is-preparing" aria-label="Preparing">…</span> : null}
          </div>
        ) : null}
        {turns.length ? (
          <button type="button" className="as-new" onClick={() => assistantStore.clear()}>
            New
          </button>
        ) : null}
        <button type="button" className="as-attach" aria-label="Attach a photo or a PDF" disabled={busy || preparing || pending.length >= ATTACHMENT_LIMITS.perTurn} onClick={() => picker.current?.click()}>
          <Paperclip size={19} aria-hidden="true" />
        </button>
        <input ref={picker} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => void addFiles(e.currentTarget.files)} />
        <textarea
          ref={field}
          className="as-input"
          rows={1}
          maxLength={2000}
          placeholder={pending.length ? 'Add a note (optional)' : `Ask or change anything${date !== today ? ` about ${fmtDate('short', date)}` : ''}`}
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
              void send(draft);
            }
          }}
        />
        <button type="button" className="as-send" aria-label="Send" disabled={(!draft.trim() && !pending.length) || busy || preparing} onClick={() => void send(draft)}>
          <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

