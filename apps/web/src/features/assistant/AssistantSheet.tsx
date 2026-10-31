import { fmtDate, isDirectApply, type AssistantChange, type AssistantProposal, type ISODate } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlarmClock, ArrowUp, Bell, CalendarDays, CheckSquare, Lightbulb, RotateCcw, Sparkles, Target } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { askAssistant, newAssistantThread, refreshAfterAssistant, useAssistantActions, useAssistantThread } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { assistantStore, useAssistantState } from './store';
import type { AskContext } from './AskBar';
import './assistant.css';

const iconOf = (c: AssistantChange) => {
  const op = c.op.op;
  if (op.endsWith('_session') || op === 'apply_plan_template') return <CalendarDays size={15} aria-hidden="true" />;
  if (op.endsWith('_todo') || op === 'plan_day') return <CheckSquare size={15} aria-hidden="true" />;
  if (op.endsWith('_habit')) return <Lightbulb size={15} aria-hidden="true" />;
  if (op.endsWith('_reminder')) return <Bell size={15} aria-hidden="true" />;
  if (op === 'set_alarm') return <AlarmClock size={15} aria-hidden="true" />;
  return <Target size={15} aria-hidden="true" />;
};

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

/** One small change the server applied at once: a line in the thread with Undo, instead of a card. */
const AppliedLine = ({ p }: { p: AssistantProposal }) => {
  const { undo } = useAssistantActions();
  const toast = useToast();
  const label = p.changes[0]?.label ?? p.summary;
  return (
    <div className={`as-applied is-${p.status}`}>
      <span className="as-applied-ic">{p.changes[0] ? iconOf(p.changes[0]) : null}</span>
      <span className="as-applied-text">
        {label}
        <span className="caps"> · {p.status === 'applied' ? 'Done' : 'Undone'}</span>
      </span>
      {p.status === 'applied' ? (
        <button type="button" className="as-undo" disabled={undo.isPending} onClick={() => void undo.mutateAsync(p.id).then((next) => assistantStore.setProposal(next)).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Couldn’t undo that.'))}>
          <RotateCcw size={14} aria-hidden="true" /> Undo
        </button>
      ) : null}
    </div>
  );
};

/** The starters in the empty state, from where the owner asked (docs/system.md §7). */
export const startersFor = (ctx: AskContext | undefined, date: ISODate, today: ISODate): string[] => {
  const day = date === today ? 'today' : fmtDate('short', date);
  switch (ctx?.tab) {
    case 'plan':
      return ['Pick a plan', 'Push my missed runs to next week', 'How is my week looking?'];
    case 'goals':
      return ['Set this week’s goal from my plan', 'How am I doing on this month’s goal?'];
    case 'journal':
      return ['What happened this month?', `What did I do ${day === 'today' ? 'today' : `on ${day}`}?`];
    default:
      return ['What’s left today?', 'Plan my morning', `Move ${day === 'today' ? 'today’s' : `${day}’s`} run to the next day`];
  }
};

/**
 * The assistant (Claude Sonnet): ask in words; the reply streams in, and it either answers or proposes changes to the plan,
 * to-dos, goals, habits, reminders and mornings. Most proposals run when Apply is tapped (and Undo takes back); one small,
 * obviously reversible change is applied at once with Undo in a toast. The thread lives on the server.
 */
export const AssistantSheet = ({ date, initial, context }: { date: ISODate; initial?: string; context?: AskContext }) => {
  const today = useToday();
  const qc = useQueryClient();
  const toast = useToast();
  const thread = useAssistantThread();
  const { undo } = useAssistantActions();
  const { turns, streaming, busy, threadId } = useAssistantState();
  const [draft, setDraft] = useState(initial ?? '');
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (thread.data) assistantStore.hydrate(thread.data);
  }, [thread.data]);
  useEffect(() => {
    // braces on purpose: an effect must return a cleanup or nothing (a returned value crashes React with "destroy is not a function")
    end.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, busy, streaming?.text]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft('');
    assistantStore.push({ role: 'user', text: t });
    assistantStore.setBusy(true);
    try {
      const r = await askAssistant(t, date, context ? { tab: context.tab, date: context.date, level: context.level } : { tab: 'today', date }, (delta) => assistantStore.stream(delta));
      assistantStore.endStream();
      if (!r.available) {
        assistantStore.push({ role: 'assistant', text: r.text });
        return;
      }
      assistantStore.push({ role: 'assistant', text: r.text, proposal: r.proposal });
      if (r.proposal?.status === 'applied') {
        // applied at once (docs/system.md §7): the data changed, and the owner gets a toast with Undo
        refreshAfterAssistant(qc, r.months ?? []);
        haptics.drop();
        const id = r.proposal.id;
        toast(r.proposal.changes[0]?.label ?? r.proposal.summary, {
          label: 'Undo',
          fn: () => void undo.mutateAsync(id).then((next) => assistantStore.setProposal(next)).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Couldn’t undo that.')),
        });
      }
    } catch (e) {
      assistantStore.endStream();
      assistantStore.push({ role: 'assistant', text: e instanceof Error ? `That didn’t go through: ${e.message}` : 'That didn’t go through. Try again.' });
    } finally {
      assistantStore.setBusy(false);
    }
  };

  const startNew = async () => {
    try {
      const t = await newAssistantThread();
      assistantStore.reset(t.id);
      qc.setQueryData(['assistant', 'thread'], t);
    } catch {
      toast('Couldn’t start a new conversation. Try again.');
    }
  };

  const empty = turns.length === 0 && !busy;
  return (
    <div className="as-sheet">
      <div className="as-thread" aria-live="polite">
        {empty && thread.isPending && !threadId ? (
          <p className="as-empty-lead">
            <Sparkles size={16} aria-hidden="true" /> Loading your conversation…
          </p>
        ) : empty ? (
          <div className="as-empty">
            <p className="as-empty-lead">
              <Sparkles size={16} aria-hidden="true" /> Ask about your plan, or ask for a change. Bigger changes wait for Apply; a small one is done at once, with Undo.
            </p>
            <div className="as-starters">
              {startersFor(context, date, today).map((s) => (
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
              {t.proposal ? t.proposal.status !== 'proposed' && t.proposal.status !== 'dismissed' && isDirectApply(t.proposal.changes.map((c) => c.op)) ? <AppliedLine p={t.proposal} /> : <ProposalCard p={t.proposal} /> : null}
            </div>
          ))
        )}
        {busy ? (
          <div className="as-turn is-assistant">
            {streaming?.text ? (
              <p className="as-bubble as-streaming">{streaming.text}</p>
            ) : (
              <p className="as-bubble as-typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </p>
            )}
          </div>
        ) : null}
        <div ref={end} />
      </div>
      <div className="as-compose">
        {turns.length ? (
          <button type="button" className="as-new" disabled={busy} onClick={() => void startNew()}>
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
