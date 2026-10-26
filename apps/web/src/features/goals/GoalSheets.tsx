import { fmtDate, periodPast, type Aim, type GoalEventKind, type GoalLevel, type GoalStatus } from '@logbook/shared';
import { Check, CircleDashed, Minus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { refineGoal, useGoalEvents, useGoalMutations, useGoals } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { deadlineWords, goalOf, LEVEL, periodCaps, STATUS_WORD } from './model';
import './goals.css';

type Step = { kind: 'write' } | { kind: 'reviewing' } | { kind: 'compare'; text: string; why: string | null; mine: string };

/**
 * Setting a goal: the owner writes it, the review (Claude, on Locke and Latham's rules) rewrites it to be specific,
 * measurable, hard but attainable and due at the period's end, and he picks the sharpened words or keeps his own. A goal
 * the review leaves alone, or one written offline, is saved as typed. Every step lands in the goal's log on the server.
 */
export const GoalEditor = ({ level, period, initial }: { level: GoalLevel; period: string; initial?: string }) => {
  const today = useToday();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const { set } = useGoalMutations();
  const toast = useToast();
  const [text, setText] = useState(initial ?? '');
  const [step, setStep] = useState<Step>({ kind: 'write' });
  const field = useRef<HTMLTextAreaElement>(null);
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  const words = text.trim();

  const save = (final: string, chose: 'sharpened' | 'kept' | 'own', original?: string, why?: string | null) => {
    set.mutate({ level, period, text: final, original: original ?? null, why: why ?? null, chose });
    haptics.drop();
    done();
  };
  const review = async () => {
    if (!words || step.kind === 'reviewing') return;
    setStep({ kind: 'reviewing' });
    try {
      const r = await refineGoal(level, period, words);
      if (!r.changed) return save(words, 'own');
      setStep({ kind: 'compare', text: r.text, why: r.why, mine: words });
    } catch (e) {
      setStep({ kind: 'write' });
      toast(e instanceof Error ? e.message : 'The review didn’t go through. Try again.');
    }
  };

  if (step.kind === 'compare') {
    return (
      <div className="gsheet">
        <div className="gs-sharp">
          <span className="caps gs-sharp-caps">
            <Sparkles size={13} aria-hidden="true" /> Sharpened
          </span>
          <p className="gs-sentence serif">{step.text}</p>
          {step.why ? <p className="gs-why">{step.why}</p> : null}
        </div>
        <div className="gs-mine">
          <span className="caps">Your words</span>
          <p className="gs-mine-text">{step.mine}</p>
        </div>
        <div className="sheet-foot">
          <Button variant="ghost" onClick={() => save(step.mine, 'kept')}>
            Keep mine
          </Button>
          <div className="foot-right">
            <Button variant="primary" onClick={() => save(step.text, 'sharpened', step.mine, step.why)}>
              Use this
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gsheet">
      <label className="gs-field">
        <span className="caps">{periodCaps(level, period, today)}</span>
        <textarea
          ref={field}
          className="gs-input serif"
          rows={3}
          maxLength={400}
          placeholder={LEVEL[level].example}
          aria-label={LEVEL[level].ask}
          value={text}
          autoFocus
          enterKeyHint="done"
          onFocus={(e) => revealField(e.currentTarget)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void review();
            }
          }}
        />
      </label>
      <p className="gs-hint">{step.kind === 'reviewing' ? 'Reviewing against the goal-setting rules…' : `${LEVEL[level].ask} The review makes it specific, measurable and due ${deadlineWords(level, period, today)}.`}</p>
      <div className="sheet-foot">
        <Button variant="ghost" onClick={done}>
          Cancel
        </Button>
        <div className="foot-right">
          <Button variant="primary" onClick={() => void review()} disabled={!words || step.kind === 'reviewing'} aria-busy={step.kind === 'reviewing'}>
            {step.kind === 'reviewing' ? 'Reviewing…' : 'Set goal'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const EVENT_WORD: Record<GoalEventKind, string> = { set: 'Set', sharpened: 'Sharpened by the review', kept: 'Kept in your words', edited: 'Edited', done: 'Marked done', partly: 'Marked partly done', missed: 'Marked missed', reopened: 'Reopened', cleared: 'Cleared' };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayOf = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const StatusIcon = ({ status, size = 16 }: { status: GoalStatus; size?: number }) =>
  status === 'done' ? <Check size={size} strokeWidth={2.6} aria-hidden="true" /> : status === 'partly' ? <Minus size={size} strokeWidth={2.6} aria-hidden="true" /> : status === 'missed' ? <X size={size} strokeWidth={2.4} aria-hidden="true" /> : <CircleDashed size={size} strokeWidth={2} aria-hidden="true" />;

/** The three answers to "did you hit it?" as one row of buttons; the chosen one is lit. */
export const ReviewButtons = ({ goal, onAnswer }: { goal: Aim; onAnswer?: (s: GoalStatus) => void }) => {
  const { review } = useGoalMutations();
  const answer = (s: GoalStatus) => {
    const next = goal.status === s ? 'open' : s;
    review.mutate({ id: goal.id, status: next });
    if (next === 'done') haptics.toggle();
    onAnswer?.(next);
  };
  return (
    <div className="g-answers" role="group" aria-label="How did it go?">
      {(['done', 'partly', 'missed'] as const).map((s) => (
        <button key={s} type="button" className={`g-answer is-${s} ${goal.status === s ? 'on' : ''}`} aria-pressed={goal.status === s} onClick={() => answer(s)}>
          <StatusIcon status={s} size={15} />
          {STATUS_WORD[s]}
        </button>
      ))}
    </div>
  );
};

/** A goal opened: its words, where they came from, the review, a line on how it went, and its whole log. */
export const GoalDetail = ({ id }: { id: string }) => {
  const today = useToday();
  const sheet = useSheet();
  const goals = useGoals();
  const { review, clear, set } = useGoalMutations();
  const toast = useToast();
  const g = goals.data?.find((x) => x.id === id) ?? null;
  const events = useGoalEvents(id.startsWith('tmp-') ? undefined : id, !id.startsWith('tmp-'));
  const [note, setNote] = useState(g?.reflection ?? '');
  useEffect(() => setNote(g?.reflection ?? ''), [g?.reflection]);
  if (!g) return <p className="gs-hint">This goal was cleared.</p>;
  const past = periodPast(g.level, g.period, today);
  const saveNote = () => {
    const v = note.trim();
    if (v !== (g.reflection ?? '')) review.mutate({ id: g.id, reflection: v || null });
  };
  const log = events.data?.events ?? [];
  return (
    <div className="gsheet">
      <p className="gs-sentence serif">{g.text}</p>
      {g.original ? (
        <p className="gs-from">
          From your words: “{g.original}”{g.why ? <span className="gs-from-why"> {g.why}</span> : null}
        </p>
      ) : null}
      <div className="gs-field">
        <span className="caps">{past ? 'Did you hit it?' : 'How is it going?'}</span>
        <ReviewButtons goal={g} />
      </div>
      {g.status !== 'open' || g.reflection ? (
        <label className="gs-field">
          <span className="caps">How it went</span>
          <textarea className="gs-note" rows={2} maxLength={500} placeholder="A line for the record" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} onFocus={(e) => revealField(e.currentTarget)} />
        </label>
      ) : null}
      {log.length ? (
        <div className="gs-field">
          <span className="caps">Log</span>
          <ol className="g-log">
            {log.map((e) => (
              <li key={e.id} className="g-log-row">
                <span className="g-log-what">{EVENT_WORD[e.kind]}</span>
                <span className="g-log-when tnum">
                  {dayOf(e.at) === today ? timeOf(e.at) : `${fmtDate('md', dayOf(e.at))}, ${timeOf(e.at)}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            const was = g;
            haptics.delete();
            clear.mutate(g.id);
            sheet.close();
            toast('Goal cleared', { label: 'Undo', fn: () => set.mutate({ level: was.level, period: was.period, text: was.text, original: was.original, why: was.why }) });
          }}
        >
          Clear
        </Button>
        <div className="foot-right">
          <Button variant="primary" onClick={() => sheet.push({ eyebrow: periodCaps(g.level, g.period, today), title: 'Edit goal', body: <GoalEditor level={g.level} period={g.period} initial={g.text} /> })}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Open a period's goal: its card when it is set, the editor when it is not. */
export const useOpenGoal = () => {
  const sheet = useSheet();
  const today = useToday();
  const goals = useGoals();
  return (level: GoalLevel, period: string, opts: { edit?: boolean } = {}) => {
    const g = goalOf(goals.data, level, period);
    const eyebrow = periodCaps(level, period, today);
    if (g && !opts.edit) sheet.open({ eyebrow, title: `${LEVEL[level].label} goal`, body: <GoalDetail id={g.id} />, detents: ['medium', 'large'], detent: 'medium' });
    else sheet.open({ eyebrow, title: g ? 'Edit goal' : LEVEL[level].ask, body: <GoalEditor level={level} period={period} initial={g?.text} />, sticky: true });
  };
};

