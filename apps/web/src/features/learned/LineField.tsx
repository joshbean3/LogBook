import type * as React from 'react';
import { counts, LEARNING_MAX, sessionStatus } from '@logbook/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGoals } from '@/api/queries';
import { fitHeight } from '@/lib/fitHeight';
import { haptics } from '@/lib/haptics';
import { revealField, useKeyboardOpen } from '@/lib/keyboard';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { goalOf } from '../goals/model';
import { longPaste } from '../journal/days';
import { useLog } from '../log/useLog';
import { submitDraft, todayDraft } from './draft';
import { Limit, pasteCut, useGrow } from './LearnedParts';
import { useLearnedMutations } from './queries';
import { hasOwnWords, lineStarter, type Starter } from './starter';
import './learned.css';

const NO_MONTHS: string[] = [];
export const QUESTION = 'What did you learn today?';

/** The field's first words, from the person's own day (starter.ts): the facts are gathered here, the words chosen there. */
export const useStarter = (today: string): Starter => {
  const log = useLog(NO_MONTHS);
  const goals = useGoals();
  const session = log.fitness ? (log.snap.sessionsOn(today).find((s) => counts(sessionStatus(log.snap, today, s))) ?? null) : null;
  const habit = log.habits.find((h) => log.snap.isHabitDone(today, h.id))?.name ?? null;
  const goal = goalOf(goals.data, 'day', today)?.text ?? null;
  const kind = session?.kind;
  const type = session?.type ?? null;
  const title = session?.title ?? null;
  return useMemo(() => lineStarter({ fitness: log.fitness, session: kind ? { kind, type, title } : null, habit, goal }), [log.fitness, kind, type, title, habit, goal]);
};

export interface LineFieldHandle {
  /** Put the caret in the field, after its words. */
  focus: () => void;
}

export interface LineFieldProps {
  /** The day the line is saved under (the page's day: draft.ts `lineDay`). */
  today: string;
  starter: Starter;
  /** Under the button: one quiet link (the Journal's "Write a longer entry"). */
  more?: React.ReactNode;
  /**
   * A paste too long for a line (days.ts `longPaste`): with this, the field does not cut it; it offers "Save as an entry"
   * and hands the whole words over on a tap. Without it the paste is cut to fit and the field says so.
   */
  onLong?: (words: string) => void;
  /** In the Save task, before the field empties: the caller may copy what is on screen (the Close card's still). */
  onSaving?: () => void;
  /** After a save was sent (the line is already on the page). */
  onSaved?: () => void;
  /** The server refused the save: the words are back in the field (and the toast has said so). */
  onRefused?: () => void;
  ref?: React.Ref<LineFieldHandle>;
}

/**
 * The line, before it is kept: the field, already started from the day, and the one Sky button. The starter is not the
 * person's words: the field shows it until they change anything (they may clear it and write what they like), and the
 * button only saves once there is more than the starter; before that it puts the caret in the field. While the field has
 * focus the question is printed over it, so it is in view with the keyboard up, and the field with its button is kept
 * above the keyboard. ⌘/Ctrl+Enter saves. The Journal's poster and the evening's Close card both write the line here, on
 * one draft (draft.ts), so words begun in one are in the other.
 */
export const LineField = ({ today, starter, more, onLong, onSaving, onSaved, onRefused, ref: handle }: LineFieldProps): React.JSX.Element => {
  const { add } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  /** A paste that was too long for a line, held until it is saved as an entry or the field is typed in again. */
  const [long, setLong] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  /** Did this tap bring the focus in (and not land in a field already being typed in)? */
  const entering = useRef(false);
  const text = useSyncExternalStore(todayDraft.subscribe, todayDraft.get, todayDraft.get);
  const touched = useSyncExternalStore(todayDraft.subscribe, todayDraft.touched, todayDraft.touched);
  const value = touched ? text : `${starter.text} `;
  useGrow(ref, value, 2, box);
  // the keyboard's height is known only once it is up: the field and its button go clear of it together
  const kb = useKeyboardOpen();
  useEffect(() => {
    if (kb && box.current && document.activeElement === ref.current) revealField(box.current, 80);
  }, [kb]);
  // the box changed size without the words changing (the text size, the width): the field is fitted to its words again
  useEffect(() => {
    const el = ref.current;
    if (!el || !box.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => void fitHeight(el));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const ready = touched && hasOwnWords(text, starter);
  const toEnd = () => {
    const el = ref.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  };
  const start = () => {
    ref.current?.focus({ preventScroll: true });
    toEnd();
  };
  useImperativeHandle(handle, () => ({ focus: start }));
  const save = () => {
    // nothing of their own yet: the button's job is to start the line
    if (!ready) return start();
    onSaving?.();
    // the save's one haptic, as tonight's light comes in: only for a save that was sent (a second tap in the same
    // moment finds the field already empty)
    const failed = () => {
      toast('Couldn’t save that. Your words are back in the field.');
      onRefused?.();
    };
    if (!submitDraft(todayDraft, (words) => add.mutateAsync({ date: today, text: words }), failed)) return;
    haptics.success();
    onSaved?.();
  };
  return (
    <div ref={box} className="ln-entry">
      <p className="ln-ask caps" aria-hidden="true">
        {QUESTION}
      </p>
      <div className="ln-entry-field">
        <textarea
          ref={ref}
          className="ln-field ln-entry-in"
          rows={2}
          maxLength={LEARNING_MAX}
          aria-label={QUESTION}
          aria-describedby={starter.note ? 'ln-entry-note' : undefined}
          enterKeyHint="enter"
          value={value}
          onPaste={(e) => {
            const el = e.currentTarget;
            const words = onLong ? longPaste({ value: el.value, start: el.selectionStart, end: el.selectionEnd, pasted: e.clipboardData.getData('text'), own: touched && hasOwnWords(text, starter) }) : null;
            if (words) {
              // too long for a line: it is not cut. The field keeps what it had, and the words are offered as an entry
              e.preventDefault();
              setLong(words);
              return;
            }
            setCut(pasteCut(e));
          }}
          onChange={(e) => {
            if (e.target.value.length < LEARNING_MAX) setCut(false);
            setLong(null);
            todayDraft.set(e.target.value, today);
          }}
          onPointerDown={() => {
            entering.current = document.activeElement !== ref.current;
          }}
          onClick={() => {
            // the tap that brings the focus in puts the caret after the starter, wherever it landed (the browser places
            // its own caret after the focus event, so this is done here); a tap in a field already in use is left alone
            if (entering.current && !touched) toEnd();
            entering.current = false;
          }}
          onFocus={() => {
            setFocused(true);
            if (box.current) revealField(box.current);
            // focus from the button or a key: the caret goes after the starter
            if (!touched) requestAnimationFrame(toEnd);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
        />
        {/* at rest the caret already waits after the starter (the picture of the field); the real one takes over on focus */}
        {!touched && !focused ? (
          <span className="ln-entry-ghost" aria-hidden="true">
            <span className="ln-entry-ghost-words">{starter.text}</span>
            <i className="ln-caret" />
          </span>
        ) : null}
      </div>
      {long && onLong ? (
        <p className="ln-long" role="status">
          <span>That is longer than one line holds.</span>
          <Button
            variant="quiet"
            size="sm"
            className="ln-long-btn"
            onClick={() => {
              setLong(null);
              onLong(long);
            }}
          >
            Save as an entry
          </Button>
        </p>
      ) : (
        <Limit text={value} cut={cut} />
      )}
      {/* where the first words came from: a caption under the field */}
      {starter.note ? (
        <p id="ln-entry-note" className="caps ln-entry-note">
          {starter.note}
        </p>
      ) : null}
      <div className="ln-entry-foot">
        {more ? <span className="ln-entry-more">{more}</span> : null}
        {/* the press does not take the focus from the field, so the keyboard stays and nothing moves under the thumb */}
        <Button variant="primary" className="ln-finish" onMouseDown={(e) => e.preventDefault()} onClick={save}>
          Finish the line
        </Button>
      </div>
    </div>
  );
};
