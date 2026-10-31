import { monthOf, periodOf, periodPast, type Aim, type GoalLevel, type GoalRefinement, type GoalStatus } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Flag, Footprints, Target } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { refineGoal, useGoalMutations, useGoals, useMonth, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { Button, ChipButton } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { deadlineWords, goalOf, LEVEL, periodCaps, STATUS_WORD } from './model';
import { DraftSteps, GoalSteps, newStepId, stepsOf } from './Steps';
import './goals.css';

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true);

/**
 * Setting a goal: the words as you would say them (serif), a starter chip or two for a day, the steps you already know, and
 * one Set goal. It saves at once; the review (Claude) is no longer a gate but an offer in the goal's sheet ("Suggest steps").
 */
export const GoalEditor = ({ level, period, initial }: { level: GoalLevel; period: string; initial?: string }) => {
  const today = useToday();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const { set } = useGoalMutations();
  const [text, setText] = useState(initial ?? '');
  const field = useRef<HTMLTextAreaElement>(null);
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  const words = text.trim();
  const existing = goalOf(useGoals().data, level, period);
  const [steps, setSteps] = useState<string[]>([]);
  const chips = useStarters(level, period);
  const save = () => {
    if (!words) return;
    // new steps go in with the goal; an edit of the words keeps the steps it had
    set.mutate({ level, period, text: words, original: null, why: null, chose: 'own', ...(steps.length || !existing ? { steps: stepsOf(steps) } : {}) });
    haptics.drop();
    done();
  };
  return (
    <div className="gsheet">
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
              save();
            }
          }}
        />
      </label>
      {chips.length && !words ? (
        <div className="gs-chips" role="group" aria-label="Start from">
          {chips.map((c) => (
            <ChipButton key={c.text} onClick={() => setText(c.text)}>
              {c.icon}
              <span className="gs-chip-text">{c.label}</span>
            </ChipButton>
          ))}
        </div>
      ) : null}
      {!existing?.steps.length ? (
        <div className="gs-field">
          <span className="caps">Steps</span>
          <DraftSteps steps={steps} onChange={setSteps} />
        </div>
      ) : null}
      <p className="gs-hint">Due {deadlineWords(level, period, today)}. Write it as you’d say it.</p>
      <div className="sheet-foot">
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!words}>
            Set goal
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Where a day's goal can start: the day's session from the plan, a P1 to-do, the week's goal (the day as its proximal
 * step). One tap fills the field.
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
  for (const t of p1) out.push({ label: t.text, text: `${t.text}.`.replace(/\.\.$/, '.'), icon: <Flag size={14} aria-hidden="true" /> });
  const week = goalOf(goals.data, 'week', periodOf('week', period));
  if (week) out.push({ label: 'Toward this week’s goal', text: `Today’s part of the week: ${week.text}`, icon: <Target size={14} aria-hidden="true" /> });
  return out.slice(0, 4);
};

/** The three answers to "did you hit it?" as one row of quiet buttons; the chosen one is lit. A second tap reopens it. */
export const ReviewButtons = ({ goal, onAnswer }: { goal: Aim; onAnswer?: (s: GoalStatus) => void }) => {
  const { review } = useGoalMutations();
  const answer = (s: GoalStatus) => {
    const next = goal.status === s ? 'open' : s;
    review.mutate({ id: goal.id, status: next, ...(next === 'done' && goal.steps.some((x) => !x.done) ? { steps: goal.steps.map((x) => ({ ...x, done: true })) } : {}) });
    if (next === 'done') haptics.success();
    onAnswer?.(next);
  };
  return (
    <div className="g-answers" role="group" aria-label="How did it go?">
      {(['done', 'partly', 'missed'] as const).map((s) => (
        <Button key={s} variant={goal.status === s ? 'soft' : 'quiet'} className="g-answer" aria-pressed={goal.status === s} onClick={() => answer(s)}>
          {STATUS_WORD[s]}
        </Button>
      ))}
    </div>
  );
};

/**
 * "Suggest steps": the existing refine endpoint, offered after the goal is saved. It lists the steps it found to add (each
 * one, or all), and shows sharper wording only as an offer behind "Use this wording"; it never rewrites on its own. Offline
 * the button waits with "Needs a connection".
 */
const Suggest = ({ goal }: { goal: Aim }) => {
  const online = useOnline();
  const { set, review } = useGoalMutations();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<GoalRefinement | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const ask = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await refineGoal(goal.level, goal.period, goal.text);
      if (out.available === false) return toast('Needs a connection');
      setR(out);
      if (!out.steps.length && !out.changed) toast('Nothing to add: it already reads as a sharp goal.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The suggestion didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const room = 5 - goal.steps.length;
  const offer = (r?.steps ?? []).filter((s) => !added.includes(s) && !goal.steps.some((x) => x.text === s));
  const addSteps = (texts: string[]) => {
    const take = texts.slice(0, Math.max(0, room));
    if (!take.length) return;
    review.mutate({ id: goal.id, steps: [...goal.steps, ...take.map((text) => ({ id: newStepId(), text, done: false }))] });
    setAdded((a) => [...a, ...take]);
  };
  if (!r || (!offer.length && !r.changed))
    return (
      <div className="gs-suggest">
        <Button variant="soft" onClick={() => void ask()} disabled={!online || busy} aria-busy={busy}>
          {busy ? 'Thinking…' : 'Suggest steps'}
        </Button>
        {!online ? <span className="gs-caption">Needs a connection</span> : null}
      </div>
    );
  return (
    <div className="gs-field">
      {offer.length ? (
        <>
          <span className="caps">Suggested steps</span>
          <ul className="g-steps is-draft" aria-label="Suggested steps">
            {offer.map((s) => (
              <li key={s} className="g-step">
                <span className="g-step-text">{s}</span>
                <Button variant="quiet" size="sm" onClick={() => addSteps([s])} disabled={room <= 0}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
          {offer.length > 1 && room > 1 ? (
            <Button variant="soft" size="sm" onClick={() => addSteps(offer)}>
              Add all
            </Button>
          ) : null}
        </>
      ) : null}
      {r.changed ? (
        <>
          <span className="caps">Sharper wording</span>
          <p className="gs-sentence serif">{r.text}</p>
          {r.why ? <p className="gs-why">{r.why}</p> : null}
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              set.mutate({ level: goal.level, period: goal.period, text: r.text, original: goal.text, why: r.why, chose: 'sharpened' });
              setR({ ...r, changed: false });
            }}
          >
            Use this wording
          </Button>
        </>
      ) : null}
    </div>
  );
};

/** A goal opened: its words, its steps to check or add, Suggest steps, Done · Partly · Missed, one line on how it went, Edit and Clear. */
export const GoalDetail = ({ id }: { id: string }) => {
  const today = useToday();
  const sheet = useSheet();
  const goals = useGoals();
  const qc = useQueryClient();
  const { review, clear, set } = useGoalMutations();
  const toast = useToast();
  const g = goals.data?.find((x) => x.id === id) ?? null;
  const [note, setNote] = useState(g?.reflection ?? '');
  useEffect(() => setNote(g?.reflection ?? ''), [g?.reflection]);
  if (!g) return <p className="gs-hint">This goal was cleared.</p>;
  const past = periodPast(g.level, g.period, today);
  const saveNote = () => {
    const v = note.trim();
    if (v !== (g.reflection ?? '')) review.mutate({ id: g.id, reflection: v || null });
  };
  const clearIt = () => {
    const was = g;
    haptics.delete();
    clear.mutate(g.id);
    sheet.close();
    toast('Goal cleared', {
      label: 'Undo',
      fn: async () => {
        await set.mutateAsync({ level: was.level, period: was.period, text: was.text, original: was.original, why: was.why, steps: was.steps });
        // the goal comes back with its outcome, not as a fresh open one
        const back = qc.getQueryData<Aim[]>(['goals'])?.find((x) => x.level === was.level && x.period === was.period);
        if (back && (was.status !== 'open' || was.reflection)) review.mutate({ id: back.id, status: was.status, reflection: was.reflection });
      },
    });
  };
  return (
    <div className="gsheet">
      <p className="gs-sentence serif">{g.text}</p>
      {g.original ? <p className="gs-why">From your words: “{g.original}”</p> : null}
      <div className="gs-field">
        <span className="caps">Steps</span>
        <GoalSteps goal={g} editable />
      </div>
      <Suggest goal={g} />
      <div className="gs-field">
        <span className="caps">{past ? 'Did you hit it?' : 'How is it going?'}</span>
        <ReviewButtons goal={g} />
      </div>
      <label className="gs-field">
        <span className="caps">How it went</span>
        <input className="in gs-note" maxLength={500} placeholder="One line for the record" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} onFocus={(e) => revealField(e.currentTarget)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
      </label>
      <div className="sheet-foot">
        <Button variant="danger" onClick={clearIt}>
          Clear
        </Button>
        <div className="foot-right">
          <Button onClick={() => sheet.push({ eyebrow: periodCaps(g.level, g.period, today), title: 'Edit goal', body: <GoalEditor level={g.level} period={g.period} initial={g.text} /> })}>Edit</Button>
        </div>
      </div>
    </div>
  );
};

/** Open a period's goal: its sheet when it is set, the editor when it is not. */
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
