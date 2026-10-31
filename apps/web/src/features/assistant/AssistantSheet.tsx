import { fmtDate, type AssistantChange, type AssistantProposal, type ISODate } from '@logbook/shared';
import { ArrowUp, CalendarDays, CheckSquare, RotateCcw, Sparkles, Target } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { askAssistant, useAssistantActions } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { assistantStore, useAssistantTurns } from './store';
import type { AskContext } from './AskBar';
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
export const AssistantSheet = ({ date, initial, context }: { date: ISODate; initial?: string; context?: AskContext }) => {
  void context; // sent with every turn once the server reads it (docs/system.md §7)
  const today = useToday();
  const turns = useAssistantTurns();
  const [draft, setDraft] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [turns.length, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft('');
    assistantStore.push({ role: 'user', text: t });
    setBusy(true);
    try {
      const history = assistantStore.get().map((x) => ({ role: x.role, text: x.proposal ? `${x.text}\n[Proposed: ${x.proposal.summary} Status: ${x.proposal.status}.]`.trim() : x.text }));
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
              <Sparkles size={16} aria-hidden="true" /> Ask about your plan, or ask for a change. Nothing changes until you tap Apply.
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
        {turns.length ? (
          <button type="button" className="as-new" onClick={() => assistantStore.clear()}>
            New
          </button>
        ) : null}
        <textarea
          ref={field}
          className="as-input"
          rows={1}
          maxLength={2000}
          placeholder={`Ask or change anything${date !== today ? ` about ${fmtDate('short', date)}` : ''}`}
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
        <button type="button" className="as-send" aria-label="Send" disabled={!draft.trim() || busy} onClick={() => void send(draft)}>
          <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

