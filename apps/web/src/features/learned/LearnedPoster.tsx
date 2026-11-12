import type * as React from 'react';
import { counts, fmtDate, LEARNING_MAX, sessionStatus, type Learning } from '@logbook/shared';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGoals } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField, useKeyboardOpen } from '@/lib/keyboard';
import { Poster, WeekLights } from '@/ui/poster';
import { Button } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Ticker } from '@/ui/Ticker';
import { useToast } from '@/ui/Toast';
import { goalOf } from '../goals/model';
import { useLog } from '../log/useLog';
import { submitDraft, todayDraft } from './draft';
import { Limit, Line, pasteCut, useGrow } from './LearnedParts';
import { useLearnedMutations } from './queries';
import { hasOwnWords, lineStarter, type Starter } from './starter';
import { bandWords, learnedWeek, lightsLabel } from './week';

const NO_MONTHS: string[] = [];
const QUESTION = 'What did you learn today?';

/** The field's first words, from the person's own day (starter.ts): the facts are gathered here, the words chosen there. */
const useStarter = (today: string): Starter => {
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

/**
 * Before tonight's line: the field, already started from the day, and the one Sky button. The starter is not the person's
 * words: the field shows it until they change anything (they may clear it and write what they like), and the button only
 * saves once there is more than the starter; before that it puts the caret in the field. While the field has focus the
 * question is printed over it, so it is in view with the keyboard up, and the field with its button is kept above the
 * keyboard. ⌘/Ctrl+Enter saves.
 */
const Entry = ({ today, starter }: { today: string; starter: Starter }) => {
  const { add } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  const [focused, setFocused] = useState(false);
  const text = useSyncExternalStore(todayDraft.subscribe, todayDraft.get, todayDraft.get);
  const touched = useSyncExternalStore(todayDraft.subscribe, todayDraft.touched, todayDraft.touched);
  const value = touched ? text : `${starter.text} `;
  useGrow(ref, value, 2, box);
  // the keyboard's height is known only once it is up: the field and its button go clear of it together
  const kb = useKeyboardOpen();
  useEffect(() => {
    if (kb && box.current && document.activeElement === ref.current) revealField(box.current, 80);
  }, [kb]);
  const ready = touched && hasOwnWords(text, starter);
  const toEnd = () => {
    const el = ref.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  };
  const save = () => {
    if (!ready) {
      // nothing of their own yet: the button's job is to start the line
      ref.current?.focus({ preventScroll: true });
      toEnd();
      return;
    }
    // the save's one haptic, as tonight's light comes in
    haptics.success();
    submitDraft(todayDraft, (words) => add.mutateAsync({ date: today, text: words }), () => toast('Couldn’t save that. Your words are back in the field.'));
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
          aria-describedby="ln-entry-note"
          enterKeyHint="enter"
          value={value}
          onPaste={(e) => setCut(pasteCut(e))}
          onChange={(e) => {
            if (e.target.value.length < LEARNING_MAX) setCut(false);
            todayDraft.set(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            if (box.current) revealField(box.current);
            // the caret goes after the starter, wherever the tap landed
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
      <Limit text={value} cut={cut} />
      <div className="ln-entry-foot">
        <span id="ln-entry-note" className="caps ln-entry-note">
          {starter.note}
        </span>
        {/* the press does not take the focus from the field, so the keyboard stays and nothing moves under the thumb */}
        <Button variant="primary" className="ln-finish" onMouseDown={(e) => e.preventDefault()} onClick={save}>
          Finish the line
        </Button>
      </div>
    </div>
  );
};

/**
 * After: tonight's line as a quote in the saved style (Fraunces italic), "Saved" with the date, and Edit. A tap on the
 * words or on Edit opens the line's sheet (change it, delete it, add another for today). More than one line today: each
 * is a quote, a hairline between them, and Edit opens the newest. `fresh`: it has just been saved, so it fades in.
 */
const Kept = ({ today, items, onOpen, fresh }: { today: string; items: Learning[]; onOpen: (l: Learning) => void; fresh: boolean }) => (
  <div className={`ln-kept ${fresh ? 'is-fresh' : ''}`.trim()}>
    <div className="ln-kept-lines">
      {items.map((l) => (
        <Line key={l.id} item={l} onOpen={onOpen} className="is-quote" clamp />
      ))}
    </div>
    <div className="ln-kept-foot">
      <span className="ln-kept-mark">
        <i aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </i>
        Saved · {fmtDate('short', today)}
      </span>
      <Button variant="quiet" className="ln-kept-edit" aria-label={items.length > 1 ? 'Edit the newest line' : 'Edit tonight’s line'} onClick={() => onOpen(items[items.length - 1]!)}>
        Edit
      </Button>
    </div>
  </div>
);

export interface LearnedPosterProps {
  today: string;
  /** Today's lines, in the order they were written. */
  items: Learning[];
  /** The days with a line, at least across the last seven. */
  lit: ReadonlySet<string>;
  /** Every line ever kept (the stats), for the first-line invitation. */
  total: number;
  onOpen: (l: Learning) => void;
}

/**
 * What I learned, the poster (guide 6.5a; A2): the dusk card the page leads with. Before tonight's line: the question, the
 * week's seven lights with tonight's ring waiting, the band's count of lines kept and which light tonight's would be, then
 * the field and "Finish the line". After: tonight lights, "One more thing you know.", the band counts up, and the line is
 * a quote with Saved and Edit. The same poster stays mounted across the save, so the light comes in once (WeekLights) with
 * one success haptic; coming back later the same day it is simply lit. Counts are lines kept, never days in a row.
 */
export const LearnedPoster = ({ today, items, lit, total, onOpen }: LearnedPosterProps): React.JSX.Element => {
  const starter = useStarter(today);
  const saved = items.length > 0;
  // today's light follows today's lines (the save lands in the list at once), the six before it the loaded days
  const week = useMemo(() => {
    const days = new Set(lit);
    if (saved) days.add(today);
    else days.delete(today);
    return learnedWeek(today, days);
  }, [lit, saved, today]);
  // the save: tonight's line arrived while this poster was up
  const [prev, setPrev] = useState(saved);
  const [fresh, setFresh] = useState(false);
  if (prev !== saved) {
    setPrev(saved);
    setFresh(!prev && saved);
  }
  const band = bandWords(week, total > (saved ? items.length : 0));
  return (
    <Poster
      ground="dusk"
      className="ln-poster"
      label={saved ? 'Tonight’s line' : QUESTION}
      title={saved ? 'One more thing you know.' : QUESTION}
      meta={saved ? 'Tonight’s line is kept.' : 'One line is enough.'}
      scene={<WeekLights days={week.days} tonight={saved ? 'lit' : 'waiting'} label={lightsLabel(week)} />}
      band={{
        label: band.label,
        words: saved ? (
          <>
            <Ticker value={week.kept} from={fresh ? week.kept - 1 : undefined} /> {week.kept === 1 ? 'line' : 'lines'} kept
          </>
        ) : (
          band.words
        ),
      }}
    >
      {saved ? <Kept today={today} items={items} onOpen={onOpen} fresh={fresh} /> : <Entry today={today} starter={starter} />}
    </Poster>
  );
};

/** The poster's place while today's lines load: its height, so nothing jumps when it lands. */
export const LearnedPosterSkeleton = (): React.JSX.Element => (
  <SkeletonGroup label="Loading" className="card ln-poster-skel">
    <Skeleton w="70%" h={32} />
    <Skeleton w="45%" h={18} />
    <Skeleton w="100%" h={76} r="control" style={{ marginTop: 'auto' }} />
    <Skeleton w={148} h={48} r="pill" style={{ marginLeft: 'auto' }} />
  </SkeletonGroup>
);
