import { AFTER_LABELS, AFTER_ORDER, buildMorning, shiftDays, durationWords, isAfterKey, MAX_STEPS, newStepId, normalizeAfterOrder, routineOf, STEP_MINS_MAX, STEP_NAME_MAX, type MorningDay, type MorningSettings, type MorningStep, type RoutineKey } from '@logbook/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMorningMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { Button, ChipButton, Segmented, Stepper, useToast } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { parseWake, short, WAKE_MAX, WAKE_MIN, WAKE_STEP } from './model';

/*
 * The schedule's editors: one small sheet for each kind of row, so a tap edits exactly the thing tapped. Each keeps a draft
 * and writes once, on Save (the sheet holds itself open while there is something unsaved).
 */

const mins = (v: number) => `${v} min`;
const int = (s: string) => {
  const v = Math.round(Number(s.replace(/[^\d.]/g, '')));
  return Number.isFinite(v) ? v : null;
};
const LENGTHS = [5, 10, 15, 20, 30, 45];
/** Steps people add most, offered as one-tap starts in the Add sheet (with any built-in block that is switched off). */
const IDEAS: Array<[string, number]> = [
  ['Breakfast', 15],
  ['Coffee', 5],
  ['Stretch', 10],
  ['Meditate', 10],
  ['Pack lunch', 5],
  ['Walk the dog', 15],
];

/** Run `fn` once the next frame has been painted. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

/**
 * The writes a sheet's Save makes, sent once the sheet has closed (its body unmounts when the close completes), a painted
 * frame later (code review 1 F3). A write's optimistic patch re-renders Today's three mounted pages and this one; inside the
 * close it took the closing slide's frames (a 250 ms frame at 4×). The page answers when the sheet is gone, as the alarm
 * drag's release and Skip already do.
 */
export const useOnClosed = (): ((fn: () => void) => void) => {
  const q = useRef<Array<() => void>>([]);
  useEffect(
    () => () => {
      const list = q.current;
      q.current = [];
      if (list.length) afterPaint(() => list.forEach((f) => f()));
    },
    [],
  );
  return (fn) => void q.current.push(fn);
};

/** Hold the sheet open while the draft differs from what was saved. */
const useSticky = (dirty: boolean) => {
  const sheet = useSheet();
  useEffect(() => sheet.update({ sticky: dirty }), [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
};

/** The minutes a length chip row and a stepper share: the common ones one tap away, any other typed or stepped. */
const Length = ({ value, onChange, label, min = 1, max = STEP_MINS_MAX, chips = LENGTHS }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; chips?: number[] }) => (
  <div className="se-length">
    <Stepper value={value} onChange={onChange} step={5} min={min} max={max} format={mins} parse={int} label={label} inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
    <div className="se-chips" role="group" aria-label={`Common lengths for ${label.toLowerCase()}`}>
      {chips.map((c) => (
        <ChipButton
          key={c}
          on={c === value}
          onClick={() => {
            if (c === value) return;
            onChange(c);
          }}
        >
          {c ? `${c}` : 'Off'}
        </ChipButton>
      ))}
    </div>
  </div>
);

/** "You leave at 8:35, 5 min later": what the draft does to the morning, said as it changes. */
const LeaveLine = ({ day, dayAfter = day, before, after }: { day: MorningDay; dayAfter?: MorningDay; before: MorningSettings; after: MorningSettings }) => {
  const a = buildMorning(day, before).leave;
  const b = buildMorning(dayAfter, after).leave;
  const d = b - a;
  return (
    <p className="se-leave" aria-live="polite">
      You leave at <span className="stamp">{short(b)}</span>
      {d ? <span className={d > 0 ? 'later' : 'sooner'}>{` · ${durationWords(Math.abs(d))} ${d > 0 ? 'later' : 'sooner'}`}</span> : null}
    </p>
  );
};

/** The order the routine is saved in: the steps on the schedule in `visible`'s order, then the ones switched off. */
export const fullOrder = (st: MorningSettings, visible: RoutineKey[]): RoutineKey[] => {
  const all = normalizeAfterOrder(st.after.order, st.after.steps ?? []);
  return [...visible, ...all.filter((k) => !visible.includes(k))];
};

/** The `after` patch that takes a step off the schedule, and the one that puts it back as it was. */
export const removal = (st: MorningSettings, key: RoutineKey) => {
  const A = st.after;
  if (isAfterKey(key)) return { off: { [key]: 0 }, undo: { [key]: A[key], order: A.order } };
  const steps = A.steps ?? [];
  return { off: { steps: steps.filter((s) => s.id !== key), order: A.order.filter((k) => k !== key) }, undo: { steps, order: A.order } };
};

/**
 * One step of the back-home routine: its name and its length, or a new step (no `stepKey`). A new one goes on the end of
 * the routine. Removing a built-in block switches it off (it comes back from the Add sheet); removing your own deletes it.
 */
export const StepEditor = ({ settings: st, day, stepKey }: { settings: MorningSettings; day: MorningDay; stepKey?: RoutineKey }) => {
  const sheet = useSheet();
  const toast = useToast();
  const { settings } = useMorningMutations();
  const later = useOnClosed();
  const steps = st.after.steps ?? [];
  const current = stepKey ? routineOf(st).find((r) => r.key === stepKey) : undefined;
  const [name, setName] = useState(current?.name ?? '');
  const [len, setLen] = useState(current?.mins ?? 10);
  const adding = !stepKey;
  const visible = routineOf(st).map((r) => r.key);
  // built-in blocks that are switched off can come back from here, under their own name
  const offBuiltins = AFTER_ORDER.filter((k) => !(st.after[k] > 0));
  const full = adding && steps.length >= MAX_STEPS;
  const trimmed = name.trim();
  const revive = adding ? offBuiltins.find((k) => AFTER_LABELS[k].toLowerCase() === trimmed.toLowerCase()) : undefined;
  const dirty = adding ? !!trimmed : trimmed !== current?.name || len !== current?.mins;
  useSticky(dirty);

  /** The `after` patch for the draft. */
  const patch = useMemo((): Record<string, unknown> | null => {
    if (!trimmed) return null;
    if (adding) {
      if (revive) return { [revive]: len, order: fullOrder(st, [...visible, revive]) };
      const step: MorningStep = { id: newStepId(), name: trimmed.slice(0, STEP_NAME_MAX), mins: len };
      return { steps: [...steps, step], order: fullOrder({ ...st, after: { ...st.after, steps: [...steps, step] } }, [...visible, step.id]) };
    }
    if (!stepKey) return null;
    if (isAfterKey(stepKey)) return { [stepKey]: len, names: { [stepKey]: trimmed === AFTER_LABELS[stepKey] ? '' : trimmed.slice(0, STEP_NAME_MAX) } };
    return { steps: steps.map((s) => (s.id === stepKey ? { ...s, name: trimmed.slice(0, STEP_NAME_MAX), mins: len } : s)) };
  }, [trimmed, len, adding, revive, stepKey, st]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo<MorningSettings>(() => {
    if (!patch) return st;
    const after = { ...st.after, ...patch, names: { ...st.after.names, ...((patch.names as object) ?? {}) } } as MorningSettings['after'];
    return { ...st, after };
  }, [patch, st]);

  const save = () => {
    if (!patch || !dirty) return;
    // the row answering on the page is the confirmation (only Undo and errors raise toasts, §8), once the sheet has closed
    const after = patch;
    later(() => settings.mutate({ after }));
    sheet.close();
  };
  const remove = () => {
    if (!stepKey || !current) return;
    const r = removal(st, stepKey);
    const name = current.name;
    haptics.delete();
    later(() => {
      settings.mutate({ after: r.off });
      toast(`${name} removed`, { label: 'Undo', fn: () => settings.mutate({ after: r.undo }) });
    });
    sheet.close();
  };

  // a tap on a step is mostly to change its length: editing, How long comes first (the sheet's first focus is its stepper,
  // no keyboard); adding, the name does (focused, the keyboard up)
  const nameField = (
    <label className="se-field">
      <span className="caps">Name</span>
      <input className="in se-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={STEP_NAME_MAX} placeholder={adding ? 'Walk the dog' : current?.name} autoCapitalize="sentences" enterKeyHint="done" autoFocus={adding} />
    </label>
  );
  const lengthField = (
    <div className="se-field">
      <span className="caps">How long</span>
      <Length value={len} onChange={setLen} label="Length" />
    </div>
  );
  const ideas = adding ? [...offBuiltins.map((k) => [AFTER_LABELS[k], st.after[k] || 15] as [string, number]), ...IDEAS.filter(([n]) => !routineOf(st).some((r) => r.name.toLowerCase() === n.toLowerCase()))].slice(0, 8) : [];

  return (
    <form
      className="se"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {adding ? nameField : lengthField}
      {ideas.length ? (
        <div className="se-chips se-ideas" role="group" aria-label="Ideas">
          {ideas.map(([n, m]) => (
            <ChipButton
              key={n}
              on={trimmed.toLowerCase() === n.toLowerCase()}
              onClick={() => {
                setName(n);
                setLen(m);
              }}
            >
              {n}
            </ChipButton>
          ))}
        </div>
      ) : null}
      {adding ? lengthField : nameField}
      <LeaveLine day={day} before={st} after={preview} />
      {full ? <p className="se-note">That’s {MAX_STEPS} steps of your own, the most a morning holds. Remove one to add another.</p> : null}
      <div className="sheet-foot">
        {adding ? (
          <span />
        ) : (
          <Button variant="ghost" className="danger" onClick={remove}>
            Remove
          </Button>
        )}
        <div className="foot-right">
          <Button variant="primary" type="submit" disabled={!dirty || !trimmed || full}>
            {adding ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
};

/**
 * The alarm (the drag's fallback, spec §4.2): when it goes off, and nothing else (the wake-up routine's length is a routine
 * setting, in Timings: here it rewrote every morning behind a button that said `Just today`, feel review 1 FL3). The sheet
 * ends in its two choices, `Just today` and `Every morning` (no segmented switch to set first): each saves. `Just today`
 * writes this date's `{ wake }` (or, set back to the routine's alarm, gives the day back to the routine); `Every morning`
 * moves the routine's alarm and gives this morning back to it (its own alarm is deleted, code review 1 F2), so the page
 * reads `Every morning` and the day follows the routine from then on. `preselect` (contracts §F) makes that choice the
 * filled one: `today` on tomorrow's date reads `Just tomorrow` (the Close card's alarm row). No toast: the page answering is
 * the confirmation, once the sheet has closed.
 */
export const WakeEditor = ({ settings: st, day, date, dayName, preselect }: { settings: MorningSettings; day: MorningDay; date: string; dayName: string; preselect?: 'today' | 'every' }) => {
  const sheet = useSheet();
  const today = useToday();
  const justName = date === today ? 'today' : date === shiftDays(today, 1) ? 'tomorrow' : dayName;
  const { settings, setDay } = useMorningMutations();
  const later = useOnClosed();
  const [wake, setWake] = useState(day.wake);
  const lead: 'day' | 'usual' = preselect === 'every' ? 'usual' : 'day';
  const dayDirty = wake !== day.wake;
  const usualDirty = wake !== st.wake || day.own;
  useSticky(dayDirty);
  const save = (scope: 'day' | 'usual') => {
    const own = day.own;
    later(() => {
      if (scope === 'usual') {
        if (wake !== st.wake) settings.mutate({ wake });
        if (own) setDay.mutate({ date, day: null });
      } else if (wake === st.wake) {
        // the routine's own alarm is no alarm of the day's own
        if (own) setDay.mutate({ date, day: null });
      } else setDay.mutate({ date, day: { wake } });
    });
    sheet.close();
  };
  const choice = (scope: 'day' | 'usual') => (
    <Button key={scope} variant={scope === lead ? 'primary' : 'ghost'} onClick={() => save(scope)} disabled={scope === 'day' ? !dayDirty : !usualDirty}>
      {scope === 'day' ? `Just ${justName}` : 'Every morning'}
    </Button>
  );
  return (
    <div className="se">
      <div className="se-field">
        <span className="caps">Alarm</span>
        <Stepper value={wake} onChange={setWake} step={WAKE_STEP} min={WAKE_MIN} max={WAKE_MAX} format={short} parse={parseWake} label="Alarm" inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
      </div>
      <LeaveLine day={day} dayAfter={{ ...day, wake }} before={st} after={st} />
      <div className="sheet-foot se-choices">
        {choice('usual')}
        {choice('day')}
      </div>
    </div>
  );
};

/** When the back-home routine starts: as soon as you are back, or at a set time (so a long run shows as late). */
export const StartEditor = ({ settings: st, day }: { settings: MorningSettings; day: MorningDay }) => {
  const sheet = useSheet();
  const { settings } = useMorningMutations();
  const later = useOnClosed();
  const [mode, setMode] = useState(st.after.showerMode);
  const [at, setAt] = useState(st.after.showerAt);
  const dirty = mode !== st.after.showerMode || (mode === 'fixed' && at !== st.after.showerAt);
  useSticky(dirty);
  const preview = useMemo(() => ({ ...st, after: { ...st.after, showerMode: mode, showerAt: at } }), [st, mode, at]);
  const save = () => {
    later(() => settings.mutate({ after: { showerMode: mode, showerAt: at } }));
    sheet.close();
  };
  return (
    <div className="se">
      <Segmented
        className="se-scope"
        label="When the routine starts"
        options={[
          ['after', 'When I’m back'],
          ['fixed', 'At a set time'],
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'fixed' ? (
        <div className="se-field">
          <span className="caps">Starts at</span>
          <Stepper value={at} onChange={setAt} step={5} min={WAKE_MIN} max={WAKE_MAX} format={short} parse={parseWake} label="Routine starts at" inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
          <span className="se-hint">Back late from a run and the morning says so, with a fix.</span>
        </div>
      ) : (
        <p className="se-hint">The routine runs straight after the workout, so the leave time moves with it.</p>
      )}
      <LeaveLine day={day} before={st} after={preview} />
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
