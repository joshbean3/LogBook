import { fmtDate, monthOf, periodOf, periodPast, type Aim, type GoalEventKind, type GoalLevel, type GoalStatus } from '@logbook/shared';
import { Check, CircleDashed, Dumbbell, Flag, Footprints, Minus, Sparkles, Target, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { refineGoal, useGoalEvents, useGoalMutations, useGoals, useMonth, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { deadlineWords, goalOf, LEVEL, periodCaps, STATUS_WORD } from './model';
import { DraftSteps, GoalSteps, stepsOf } from './Steps';
import { HalfGauge, NewGoalChoice } from './GoalSheetParts';
import { KPin } from './Kit';
import { useNowMinutes } from '../day/useNow';
import './goals.css';

type Step = { kind: 'write' } | { kind: 'reviewing' } | { kind: 'compare'; text: string; why: string | null; mine: string; changed: boolean };

/**
 * Setting a goal: the owner writes it, the review (Claude, on Locke and Latham's rules) rewrites it to be specific,
 * measurable, hard but attainable and due at the period's end, and he picks the sharpened words or keeps his own. A goal
 * the review leaves alone, or one written offline, is saved as typed. Every step lands in the goal's log on the server.
 */
export const GoalEditor = ({ level, period, initial, closeOnSave }: { level: GoalLevel; period: string; initial?: string; closeOnSave?: boolean }) => {
  const today = useToday();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const { set } = useGoalMutations();
  const toast = useToast();
  const [text, setText] = useState(initial ?? '');
  const [step, setStep] = useState<Step>({ kind: 'write' });
  const field = useRef<HTMLTextAreaElement>(null);
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  // pushed from the two ways to set a goal, a saved goal closes the sheet; Cancel still goes back to them
  const finish = () => (closeOnSave ? sheet.close() : done());
  const words = text.trim();

  const existing = goalOf(useGoals().data, level, period);
  const [steps, setSteps] = useState<string[]>([]);
  const chips = useStarters(level, period);
  const save = (final: string, chose: 'sharpened' | 'kept' | 'own', original?: string, why?: string | null) => {
    // new steps go in with the goal; an edit of the words keeps the steps it had unless the review offered new ones
    set.mutate({ level, period, text: final, original: original ?? null, why: why ?? null, chose, ...(steps.length || !existing ? { steps: stepsOf(steps) } : {}) });
    haptics.drop();
    finish();
  };
  const review = async () => {
    if (!words || step.kind === 'reviewing') return;
    setStep({ kind: 'reviewing' });
    try {
      const r = await refineGoal(level, period, words);
      setSteps(existing?.steps.length ? [] : r.steps);
      if (!r.changed && !(r.steps.length && !existing?.steps.length)) return save(words, 'own');
      setStep({ kind: 'compare', text: r.text, why: r.why, mine: words, changed: r.changed });
    } catch (e) {
      setStep({ kind: 'write' });
      toast(e instanceof Error ? e.message : 'The review didn’t go through. Try again.');
    }
  };

  if (step.kind === 'compare') {
    return (
      <div className="gsheet k-sheet">
        <section className="k-card gs-card gs-sharp">
          <span className="k-label gs-sharp-label">
            <Sparkles size={16} aria-hidden="true" /> {step.changed ? 'Sharpened' : 'Already sharp'}
          </span>
          <p className="gs-sentence serif">{step.text}</p>
          {step.why ? <p className="gs-why">{step.why}</p> : null}
          {step.changed ? (
            <>
              <hr className="k-rule" />
              <span className="k-label">Your words</span>
              <p className="gs-mine-text">{step.mine}</p>
            </>
          ) : null}
        </section>
        {!existing?.steps.length ? (
          <>
            <h3 className="k-sheet-label">Steps · drop any, add your own</h3>
            <DraftSteps steps={steps} onChange={setSteps} />
          </>
        ) : null}
        <KPin>
          <Button variant="primary" block onClick={() => (step.changed ? save(step.text, 'sharpened', step.mine, step.why) : save(step.mine, 'own'))}>
            {step.changed ? 'Use this' : 'Set goal'}
          </Button>
          {step.changed ? (
            <Button block className="gs-keep" onClick={() => save(step.mine, 'kept')}>
              Keep mine
            </Button>
          ) : null}
        </KPin>
      </div>
    );
  }

  return (
    <div className="gsheet k-sheet">
      <label className="gs-field">
        <span className="sr-only">{periodCaps(level, period, today)}</span>
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
      {chips.length && !words ? (
        <div className="gs-chips" role="group" aria-label="Start from">
          {chips.map((c) => (
            <button key={c.text} type="button" className="gs-chip" onClick={() => setText(c.text)}>
              {c.icon}
              <span className="gs-chip-text">{c.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="k-foot gs-hint">{step.kind === 'reviewing' ? 'Reviewing against the goal-setting rules…' : `Write it as you’d say it. The review makes it specific, measurable and due ${deadlineWords(level, period, today)}, and breaks it into steps.`}</p>
      <KPin>
        <Button variant="primary" block onClick={() => void review()} disabled={!words || step.kind === 'reviewing'} aria-busy={step.kind === 'reviewing'}>
          {step.kind === 'reviewing' ? 'Reviewing…' : 'Set goal'}
        </Button>
      </KPin>
    </div>
  );
};

/**
 * Where a day's goal can start: the day's session from the plan, a P1 to-do, the week's goal (the day as its proximal
 * step). One tap fills the field; the review still runs on Set goal.
 */
const useStarters = (level: GoalLevel, period: string) => {
  const month = useMonth(monthOf(level === 'day' || level === 'week' ? period : `${period.slice(0, 7)}-01`));
  const todos = useTodos();
  const goals = useGoals();
  if (level !== 'day') return [];
  const out: Array<{ label: string; text: string; icon: React.ReactNode }> = [];
  const sess = (month.data?.sessions ?? []).filter((x) => x.date === period && !(x as { deletedAt?: string | null }).deletedAt);
  for (const x of sess.slice(0, 2)) {
    const name = x.title || [x.type, x.miles ? `${x.miles}` : null].filter(Boolean).join(' ') || 'the session';
    out.push({ label: name, text: x.kind === 'run' ? `Run ${name}${x.miles && !/mi\b/.test(name) ? ` (${x.miles} mi)` : ''} today.` : `Get ${name} done today.`, icon: x.kind === 'run' ? <Footprints size={14} aria-hidden="true" /> : <Dumbbell size={14} aria-hidden="true" /> });
  }
  const p1 = (todos.data ?? []).filter((t) => t.priority === 3 && !t.doneOn && !t.deletedOn).slice(0, 2);
  for (const t of p1) out.push({ label: t.text, text: `${t.text}.`.replace(/\.\.$/, '.'), icon: <Flag size={14} aria-hidden="true" className="gs-chip-p1" /> });
  const week = goalOf(goals.data, 'week', periodOf('week', period));
  if (week) out.push({ label: 'Toward this week’s goal', text: `Today’s part of the week: ${week.text}`, icon: <Target size={14} aria-hidden="true" /> });
  return out.slice(0, 4);
};

const EVENT_WORD: Record<GoalEventKind, string> = { set: 'Set', sharpened: 'Sharpened by the review', kept: 'Kept in your words', edited: 'Edited', done: 'Marked done', partly: 'Marked partly done', missed: 'Marked missed', reopened: 'Reopened', cleared: 'Cleared', step: 'Checked off', unstep: 'Unchecked' };
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
    <div className="g-answers k-card" role="group" aria-label="How did it go?">
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
  const { review } = useGoalMutations();
  const g = goals.data?.find((x) => x.id === id) ?? null;
  const events = useGoalEvents(id.startsWith('tmp-') ? undefined : id, !id.startsWith('tmp-'));
  const [note, setNote] = useState(g?.reflection ?? '');
  const minutes = useNowMinutes();
  useEffect(() => setNote(g?.reflection ?? ''), [g?.reflection]);
  if (!g) return <p className="gs-hint">This goal was cleared.</p>;
  const past = periodPast(g.level, g.period, today);
  const now = new Date(`${today}T00:00:00`).getTime() + minutes * 60e3;
  const saveNote = () => {
    const v = note.trim();
    if (v !== (g.reflection ?? '')) review.mutate({ id: g.id, reflection: v || null });
  };
  const log = events.data?.events ?? [];
  return (
    <div className="gsheet k-sheet">
      <section className="k-card gs-card g-gauge-card" aria-label="Where it stands">
        <HalfGauge goal={g} now={now} />
        <hr className="k-rule" />
        <p className="gs-sentence serif">{g.text}</p>
        {g.original ? (
          <p className="k-foot gs-from">
            From your words: “{g.original}”{g.why ? <span className="gs-from-why"> {g.why}</span> : null}
          </p>
        ) : null}
      </section>
      <h3 className="k-sheet-label">What counts toward it</h3>
      <GoalSteps goal={g} editable />
      <h3 className="k-sheet-label">{past ? 'Did you hit it?' : 'How is it going?'}</h3>
      <ReviewButtons goal={g} />
      {g.status !== 'open' || g.reflection ? (
        <>
          <h3 className="k-sheet-label">How it went</h3>
          <label className="k-card gs-note-card">
            <span className="sr-only">How it went</span>
            <textarea className="gs-note" rows={2} maxLength={500} placeholder="A line for the record" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} onFocus={(e) => revealField(e.currentTarget)} />
          </label>
        </>
      ) : null}
      {log.length ? (
        <>
          <h3 className="k-sheet-label">Log</h3>
          <ol className="k-rows g-log">
            {log.map((e) => (
              <li key={e.id} className="k-row g-log-row">
                <span className="g-log-what">
                  {EVENT_WORD[e.kind]}
                  {(e.kind === 'step' || e.kind === 'unstep') && e.text ? <span className="g-log-step">: {e.text}</span> : null}
                </span>
                <span className="k-row-end g-log-when">{dayOf(e.at) === today ? timeOf(e.at) : `${fmtDate('md', dayOf(e.at))}, ${timeOf(e.at)}`}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <KPin>
        <Button variant="primary" block onClick={() => sheet.push({ eyebrow: periodCaps(g.level, g.period, today), title: 'Edit goal', body: <GoalEditor level={g.level} period={g.period} initial={g.text} /> })}>
          Edit goal
        </Button>
      </KPin>
    </div>
  );
};

/** Clearing a goal, behind the sheet's red trash: what goes, then Clear (a toast brings it back with Undo). */
const ClearGoal = ({ id }: { id: string }) => {
  const sheet = useSheet();
  const goals = useGoals();
  const { clear, set } = useGoalMutations();
  const toast = useToast();
  const g = goals.data?.find((x) => x.id === id) ?? null;
  if (!g) return <p className="k-foot">This goal was cleared.</p>;
  return (
    <div className="gsheet k-sheet">
      <section className="k-card gs-card">
        <p className="gs-sentence serif">{g.text}</p>
        <p className="k-foot">Clearing takes the goal and its steps off the period. Its log is kept, and Undo brings it back.</p>
      </section>
      <KPin>
        <Button
          className="block k-danger"
          block
          onClick={() => {
            const was = g;
            haptics.delete();
            clear.mutate(g.id);
            sheet.close();
            toast('Goal cleared', { label: 'Undo', fn: () => set.mutate({ level: was.level, period: was.period, text: was.text, original: was.original, why: was.why, steps: was.steps }) });
          }}
        >
          Clear goal
        </Button>
      </KPin>
    </div>
  );
};

/** The goal sheet's header action: a red trash in a tinted circle, then the confirm. */
const ClearButton = ({ id }: { id: string }) => {
  const sheet = useSheet();
  return (
    <button type="button" className="icon-btn k-trash" aria-label="Clear goal" title="Clear goal" onClick={() => sheet.push({ title: 'Clear this goal?', body: <ClearGoal id={id} /> })}>
      <Trash2 size={18} aria-hidden="true" />
    </button>
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
    if (g && !opts.edit) sheet.open({ eyebrow, title: `${LEVEL[level].label} goal`, body: <GoalDetail id={g.id} />, action: <ClearButton id={g.id} />, detents: ['medium', 'large'], detent: 'medium' });
    else if (g) sheet.open({ eyebrow, title: 'Edit goal', body: <GoalEditor level={level} period={period} initial={g.text} />, sticky: true });
    // a new goal: set it myself (the editor, pushed) or ask for a suggestion from the last 90 days
    else sheet.open({ eyebrow, title: LEVEL[level].ask, body: <NewGoalChoice level={level} period={period} onMine={() => sheet.push({ eyebrow, title: LEVEL[level].ask, body: <GoalEditor level={level} period={period} closeOnSave />, sticky: true })} /> });
  };
};

