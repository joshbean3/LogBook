import { fmtDate, monthOf, periodOf, periodPast, periodSpan, periodStart, shiftDays, type Aim, type GoalEventKind, type GoalLevel, type GoalStatus } from '@logbook/shared';
import { Check, CircleDashed, Dumbbell, Flag, Footprints, Minus, Target, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useGoalEvents, useGoalMutations, useGoals, useMonth, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet, useSheetDepth, type SheetSpec } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { askOf, dayEnd, deadlineWords, goalOf, LEVEL, periodCaps, STATUS_WORD } from './model';
import { AS_TYPED_WORDS, reviewGoal, SLOW_WORDS, useReviewAccess, type ReviewAccess } from './refine';
import { DraftSteps, GoalSteps, stepsOf } from './Steps';
import { HalfGauge, NewGoalChoice } from './GoalSheetParts';
import { KPin } from './Kit';
import { useNowMinutes } from '../day/useNow';
import './goals.css';

type Step = { kind: 'write' } | { kind: 'reviewing' } | { kind: 'compare'; text: string; why: string | null; mine: string; changed: boolean };

/** How the sheet tells the editor its panel was left (Back, Close, a flick down, another sheet opened over it). */
export interface EditorGate {
  left: boolean;
  onLeave?: () => void;
}

/** The line under the field: who reviews the words, or that nobody does. */
const hintWords = (access: ReviewAccess, deadline: string) =>
  access === 'on'
    ? `Write it as you’d say it. Claude, by Anthropic, reviews the wording so it is specific, measurable and due ${deadline}, and breaks it into steps.`
    : access === 'off'
      ? 'Write it as you’d say it. Assistant access is off, so it saves as written.'
      : 'Write it as you’d say it.';

/**
 * Setting a goal: the owner writes it, the review (Claude, on Locke and Latham's rules) rewrites it to be specific,
 * measurable, hard but attainable and due at the period's end, and he picks the sharpened words or keeps his own. The
 * review runs only with assistant access on (features/goals/refine.ts); otherwise, and when the review leaves the goal
 * alone, is offline, refuses or is not there, the goal is saved as typed and a toast says so. Leaving the editor while the
 * review runs saves nothing, and a review with no answer in 15 s gives the field back. Every step lands in the goal's log
 * on the server.
 */
export const GoalEditor = ({ level, period, initial, closeOnSave, gate }: { level: GoalLevel; period: string; initial?: string; closeOnSave?: boolean; gate?: EditorGate }) => {
  const today = useToday();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const { set } = useGoalMutations();
  const toast = useToast();
  const access = useReviewAccess();
  const [text, setText] = useState(initial ?? '');
  const [step, setStep] = useState<Step>({ kind: 'write' });
  const field = useRef<HTMLTextAreaElement>(null);
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  // pushed from the two ways to set a goal, a saved goal closes the sheet; Cancel still goes back to them
  const finish = () => (closeOnSave ? sheet.close() : done());
  const words = text.trim();
  const latest = useRef(words);
  latest.current = words;

  // the review in flight, and whether this editor is still the one on screen
  const run = useRef<AbortController | null>(null);
  const gone = useRef(false);
  const left = () => gone.current || !!gate?.left;
  useEffect(() => {
    gone.current = false;
    const drop = () => run.current?.abort();
    if (gate) gate.onLeave = drop;
    return () => {
      gone.current = true;
      drop();
    };
  }, [gate]);

  const existing = goalOf(useGoals().data, level, period);
  const [steps, setSteps] = useState<string[]>([]);
  const chips = useStarters(level, period);
  const save = (final: string, chose: 'sharpened' | 'kept' | 'own', original?: string, why?: string | null, note?: string) => {
    run.current?.abort();
    run.current = null;
    // new steps go in with the goal; an edit of the words keeps the steps it had unless the review offered new ones
    set.mutate({ level, period, text: final, original: original ?? null, why: why ?? null, chose, ...(steps.length || !existing ? { steps: stepsOf(steps) } : {}) });
    haptics.drop();
    finish();
    if (note) toast(note);
  };
  const review = async () => {
    if (!words || step.kind === 'reviewing') return;
    // with access off nothing is sent, so there is nothing to wait for
    if (access === 'on') setStep({ kind: 'reviewing' });
    const ctl = new AbortController();
    run.current = ctl;
    const r = await reviewGoal({ level, period, text: words }, access, { signal: ctl.signal });
    // closed, popped or replaced while the review ran: its answer is dropped and nothing is saved
    if (left() || run.current !== ctl) return;
    run.current = null;
    if (r.kind === 'asTyped') return save(words, 'own', undefined, undefined, AS_TYPED_WORDS[r.why]);
    if (r.kind === 'slow' || r.kind === 'failed') {
      setStep({ kind: 'write' });
      if (r.kind === 'failed') return toast(r.message);
      return toast(SLOW_WORDS, { label: 'Save', duration: 10_000, fn: () => (!left() && latest.current ? save(latest.current, 'own') : undefined) });
    }
    setSteps(existing?.steps.length ? [] : r.steps);
    if (!r.changed && !(r.steps.length && !existing?.steps.length)) return save(words, 'own');
    setStep({ kind: 'compare', text: r.text, why: r.why, mine: words, changed: r.changed });
  };

  if (step.kind === 'compare') {
    return (
      <div className="gsheet k-sheet">
        <section className="k-card gs-card gs-sharp">
          <span className="k-label gs-sharp-label">
            {step.changed ? 'Sharpened by the assistant' : 'Already sharp'}
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
            <h3 className="k-sheet-label">{steps.length ? 'Steps suggested by AI · drop any, add your own' : 'Steps · add your own'}</h3>
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

  const ask = askOf(level, period, today);
  return (
    <div className="gsheet k-sheet">
      <p className="gs-ask serif" aria-hidden="true">
        {ask}
      </p>
      <label className="gs-field">
        <span className="sr-only">{periodCaps(level, period, today)}</span>
        <textarea
          ref={field}
          className="gs-input serif"
          rows={3}
          maxLength={400}
          placeholder={LEVEL[level].example}
          aria-label={ask}
          value={text}
          autoFocus
          readOnly={step.kind === 'reviewing'}
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
      <p className="k-foot gs-hint" aria-live="polite">
        {step.kind === 'reviewing' ? 'Claude is reviewing the wording…' : hintWords(access, deadlineWords(level, period, today))}
      </p>
      <KPin>
        <Button variant="primary" block onClick={() => void review()} disabled={!words || step.kind === 'reviewing'} aria-busy={step.kind === 'reviewing'}>
          {step.kind === 'reviewing' ? 'Reviewing…' : existing ? 'Save' : 'Set goal'}
        </Button>
      </KPin>
    </div>
  );
};

/** The editor as a sheet panel that hears when it is left, so a review still running then saves nothing. */
const editorPanel = (p: { level: GoalLevel; period: string; initial?: string; closeOnSave?: boolean }): Pick<SheetSpec, 'body' | 'onClose'> => {
  const gate: EditorGate = { left: false };
  return {
    body: <GoalEditor {...p} gate={gate} />,
    onClose: () => {
      gate.left = true;
      gate.onLeave?.();
    },
  };
};

/**
 * Where a day's goal can start: the day's session from the plan, a P1 to-do, the week's goal (the day as its proximal
 * step). One tap fills the field; the review still runs on Set goal.
 */
const useStarters = (level: GoalLevel, period: string) => {
  const today = useToday();
  const month = useMonth(monthOf(level === 'day' || level === 'week' ? period : `${period.slice(0, 7)}-01`));
  const todos = useTodos();
  const goals = useGoals();
  if (level !== 'day') return [];
  const out: Array<{ label: string; text: string; icon: React.ReactNode }> = [];
  const sess = (month.data?.sessions ?? []).filter((x) => x.date === period && !(x as { deletedAt?: string | null }).deletedAt);
  const when = dayEnd(period, today);
  for (const x of sess.slice(0, 2)) {
    const name = x.title || [x.type, x.miles ? `${x.miles}` : null].filter(Boolean).join(' ') || 'the session';
    // the miles once: not again when the name already carries the number
    const miles = x.miles && !name.includes(String(x.miles)) && !/mi\b/.test(name) ? ` (${x.miles} mi)` : '';
    out.push({ label: name, text: x.kind === 'run' ? `Run ${name}${miles} ${when}.` : `Get ${name} done ${when}.`, icon: x.kind === 'run' ? <Footprints size={14} aria-hidden="true" /> : <Dumbbell size={14} aria-hidden="true" /> });
  }
  const p1 = (todos.data ?? []).filter((t) => t.priority === 3 && !t.doneOn && !t.deletedOn).slice(0, 2);
  for (const t of p1) out.push({ label: t.text, text: `${t.text}.`.replace(/\.\.$/, '.'), icon: <Flag size={14} aria-hidden="true" className="gs-chip-p1" /> });
  const week = goalOf(goals.data, 'week', periodOf('week', period));
  if (week) out.push({ label: 'Toward the week’s goal', text: `Part of the week: ${week.text}`, icon: <Target size={14} aria-hidden="true" /> });
  return out.slice(0, 4);
};

const EVENT_WORD: Record<GoalEventKind, string> = { set: 'Set', sharpened: 'Sharpened by the assistant', kept: 'Kept in your words', edited: 'Edited', done: 'Marked done', partly: 'Marked partly done', missed: 'Marked missed', reopened: 'Reopened', cleared: 'Cleared', step: 'Checked off', unstep: 'Unchecked' };
/** A clock time as the phone shows them (12 or 24 hour, from its region settings). */
const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
export const timeOf = (iso: string) => CLOCK.format(new Date(iso));
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

/** `Starts tomorrow`, `Starts Mon, Nov 16`, `Starts in December`: a goal whose period is still ahead. */
const startsWords = (level: GoalLevel, period: string, today: string) => {
  const from = periodStart(level, period);
  if (level === 'month') return `Starts in ${periodSpan(level, period).split(' ')[0]}`;
  if (level === 'year') return `Starts in ${period}`;
  return from === shiftDays(today, 1) ? 'Starts tomorrow' : `Starts ${fmtDate('short', from)}`;
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
  // tomorrow's goal, next week's: nothing to answer yet, and no clock running
  const ahead = periodStart(g.level, g.period) > today;
  const now = new Date(`${today}T00:00:00`).getTime() + minutes * 60e3;
  const saveNote = () => {
    const v = note.trim();
    if (v !== (g.reflection ?? '')) review.mutate({ id: g.id, reflection: v || null });
  };
  const log = events.data?.events ?? [];
  return (
    <div className="gsheet k-sheet">
      <section className="k-card gs-card g-gauge-card" aria-label="Where it stands">
        <HalfGauge goal={g} now={now} starts={ahead ? startsWords(g.level, g.period, today) : undefined} />
        <hr className="k-rule" />
        <p className="gs-sentence serif">{g.text}</p>
        {g.original ? (
          <p className="k-foot gs-from">
            <span className="gs-from-ai">
              Sharpened by the assistant
            </span>{' '}
            from your words: “{g.original}”{g.why ? <span className="gs-from-why"> {g.why}</span> : null}
          </p>
        ) : null}
      </section>
      <h3 className="k-sheet-label">What counts toward it</h3>
      <GoalSteps goal={g} editable />
      {ahead ? null : (
        <>
          <h3 className="k-sheet-label">{past ? 'Did you hit it?' : 'How is it going?'}</h3>
          <ReviewButtons goal={g} />
        </>
      )}
      {!ahead && (g.status !== 'open' || g.reflection) ? (
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
        <Button variant="primary" block onClick={() => sheet.push({ eyebrow: periodCaps(g.level, g.period, today), title: 'Edit goal', ...editorPanel({ level: g.level, period: g.period, initial: g.text }) })}>
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
  const { clear, set, review } = useGoalMutations();
  const qc = useQueryClient();
  const toast = useToast();
  const g = goals.data?.find((x) => x.id === id) ?? null;
  /** Undo: the words and steps come back with the PUT (which revives the row as open), then its answer and its note. */
  const restore = async (was: Aim) => {
    await set.mutateAsync({ level: was.level, period: was.period, text: was.text, original: was.original, why: was.why, steps: was.steps });
    if (was.status === 'open' && !was.reflection) return;
    // the cache may hold a provisional id while offline: the answer goes on whatever row stands for the period
    qc.setQueryData<Aim[]>(['goals'], (list) => list?.map((x) => (x.level === was.level && x.period === was.period ? { ...x, status: was.status, reflection: was.reflection, closedAt: was.closedAt } : x)));
    review.mutate({ id: was.id, status: was.status, reflection: was.reflection });
  };
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
            toast('Goal cleared', { label: 'Undo', fn: () => void restore(was).catch(() => undefined) });
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
    else if (g) sheet.open({ eyebrow, title: 'Edit goal', ...editorPanel({ level, period, initial: g.text }), sticky: true });
    // a new goal: set it myself (the editor, pushed) or ask the assistant for one. The title stays short enough to fit at
    // 320; the question itself is the serif line in the body
    else {
      const title = `${LEVEL[level].label} goal`;
      sheet.open({ eyebrow, title, body: <NewGoalChoice level={level} period={period} onMine={() => sheet.push({ eyebrow, title, ...editorPanel({ level, period, closeOnSave: true }), sticky: true })} /> });
    }
  };
};

