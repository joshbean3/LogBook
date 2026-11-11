import { fmtDate } from '@logbook/shared';
import { BellRing, BellOff, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { Pressable } from '@/ui';
import { blockLine, hm, type BlockShape } from './model';

/**
 * The beats that make first run feel built for you (docs/onboarding-research.md):
 *
 *   SetupBar      a segmented bar with the account already filled in, so the first question opens on progress made
 *                 (endowed progress, Nunes & Drèze 2006) and the end is always in sight
 *   BlockPreview  the plan the answers so far would build, read off the real template, moving as they change (Noom's moving
 *                 goal date): every answer visibly does something
 *   BuildBeat     the plan being written, one real step at a time, a selection tick per step, and the reveal on success
 *   NudgeChoice   one nudge a morning, previewed as the notification itself, chosen before the system asks
 */

// ---------- the setup bar ----------
export const SetupBar = ({ steps, index }: { steps: number; index: number }) => {
  // the account is segment one, already done; the questions follow
  const total = steps + 1;
  const at = index + 1;
  return (
    <div className="obx-bar" role="progressbar" aria-label="Setup" aria-valuemin={1} aria-valuemax={total} aria-valuenow={at + 1} aria-valuetext={`Step ${at + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`obx-seg ${i < at ? 'done' : i === at ? 'on' : ''}`}>
          <i />
        </span>
      ))}
    </div>
  );
};

// ---------- the block's shape ----------
const KIND_WORD: Record<BlockShape['bars'][number]['kind'], string> = { 'lead-in': 'Warm-up week', build: 'Build', down: 'Easier week', taper: 'Taper', race: 'Race' };

/** `compact`: bars and the line only. `bare`: the same, without a card of its own (inside the race-day card). */
export const BlockPreview = ({ shape, compact = false, bare = false }: { shape: BlockShape | null; compact?: boolean; bare?: boolean }) => {
  const reduce = useReducedMotion();
  if (!shape) return null;
  const head = shape.raceDate ? fmtDate('short', shape.raceDate) : `${shape.weeks} weeks`;
  return (
    <div className={`${bare ? '' : 'card '}obx-block ${compact || bare ? 'is-compact' : ''} ${bare ? 'is-bare' : ''}`} aria-live="polite">
      {compact || bare ? null : (
        <div className="obx-block-head">
          <span className="caps">{shape.raceDate ? 'Race day' : 'Your plan'}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.b key={head} className="obx-block-big" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
              {head}
            </motion.b>
          </AnimatePresence>
        </div>
      )}
      <div className="obx-bars" aria-hidden="true">
        {shape.bars.map((b, i) => (
          <span key={i} className={`obx-b k-${b.kind}`} style={{ transform: `scaleY(${b.h})`, transitionDelay: reduce ? '0ms' : `${Math.min(i, 24) * 12}ms` }} title={KIND_WORD[b.kind]} />
        ))}
      </div>
      <p className="obx-block-line">{blockLine(shape)}</p>
    </div>
  );
};

// ---------- the plan being written ----------
const STEP_MS = 520;

/**
 * One line a beat, each checking in with a selection tick. Holds on the last line until `ready` (the plan is saved: the
 * wait is the real one), then hands over with `onDone`. A tap anywhere hurries it to the end; reduced motion shortens the
 * beat and fades instead of sliding. When the save fails (`failed`: the reason, in plain words) the ticking stops where it
 * is and the title says so, with the reason 8 under it; nothing more is marked done until a retry
 * clears it. `title` words the beat for a setup with no plan.
 */
export const BuildBeat = ({ steps, ready, failed, onDone, title }: { steps: string[]; ready: boolean; failed: string | null; onDone: () => void; title?: { writing: string; done: string } }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);
  const beat = reduce ? 240 : STEP_MS;
  useEffect(() => {
    if (shown >= steps.length || failed) return;
    const id = setTimeout(() => {
      setShown((n) => n + 1);
      haptics.select();
    }, shown === 0 ? 260 : beat);
    return () => clearTimeout(id);
  }, [shown, steps.length, beat, failed]);
  useEffect(() => {
    if (doneRef.current || shown < steps.length || !ready) return;
    const id = setTimeout(() => {
      doneRef.current = true;
      onDone();
    }, reduce ? 120 : 420);
    return () => clearTimeout(id);
  }, [shown, steps.length, ready, onDone, reduce]);
  const all = shown >= steps.length;
  return (
    <div className="obx-build" onPointerDown={() => (failed ? undefined : setShown(steps.length))}>
      <h1 className="obx-build-title display" tabIndex={-1}>
        {failed ? (title ? 'Couldn’t save your answers' : 'Couldn’t save your plan') : all && ready ? (title?.done ?? 'Your week is written.') : (title?.writing ?? 'Writing your plan')}
      </h1>
      {/* why, 8 under the headline it explains (layout standard 3.3; plan O1); the buttons stay pinned at the foot */}
      {failed ? (
        <p className="obx-build-reason" role="alert">
          {failed}
        </p>
      ) : null}
      <ol className="obx-build-list" aria-live="polite">
        {steps.slice(0, shown).map((s, i) => (
          <motion.li key={s} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
            <motion.span className="obx-tick" initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={springs.complete}>
              <Check size={14} aria-hidden="true" />
            </motion.span>
            <span className={i === shown - 1 && !all ? 'is-live' : ''}>{s}</span>
          </motion.li>
        ))}
      </ol>
      <p className="obx-build-foot" aria-live="polite">
        {!failed && all && !ready ? 'Saving it to your plan…' : ' '}
      </p>
    </div>
  );
};

// ---------- one nudge a morning ----------
/**
 * The choice, made in the app before iOS asks (HIG Privacy: the explanation and any opt-out come before the system
 * alert, never on a screen that only leads into it). The preview is the notification as it will arrive, at the time it
 * will arrive: fifteen minutes after the alarm the person just set.
 */
export const NudgeChoice = ({ on, at, onChange }: { on: boolean; at: number; onChange: (on: boolean) => void }) => {
  const reduce = useReducedMotion();
  const pick = (v: boolean) => {
    if (v !== on) haptics.select();
    onChange(v);
  };
  return (
    <>
      <div className="obx-lock" aria-hidden="true">
        <span className="obx-lock-time">{hm(at)}</span>
        <motion.div className="obx-note" animate={on ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.35, y: reduce ? 0 : 6, scale: reduce ? 1 : 0.97 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
          <span className="obx-note-app">
            <img className="obx-note-icon" src={`${import.meta.env.BASE_URL}icons/apple-touch-icon.png`} alt="" width={16} height={16} draggable={false} />
            Orby
            <small>now</small>
          </span>
          <b>Set today’s goal</b>
          <span>One thing that would make today a win.</span>
        </motion.div>
      </div>
      <div className="card obx-choice" role="radiogroup" aria-label="Morning nudge">
        <Pressable className={`obx-opt ${on ? 'on' : ''}`} role="radio" aria-checked={on} onPress={() => pick(true)}>
          <span className="obx-opt-ic">
            <BellRing size={18} aria-hidden="true" />
          </span>
          <span className="obx-opt-text">
            <b>Nudge me at {hm(at)}</b>
            <span>Once a morning, only on days without a goal.</span>
          </span>
          <span className="obx-radio" aria-hidden="true" />
        </Pressable>
        <Pressable className={`obx-opt ${!on ? 'on' : ''}`} role="radio" aria-checked={!on} onPress={() => pick(false)}>
          <span className="obx-opt-ic">
            <BellOff size={18} aria-hidden="true" />
          </span>
          <span className="obx-opt-text">
            <b>No nudges</b>
            <span>The dot on Goals is enough.</span>
          </span>
          <span className="obx-radio" aria-hidden="true" />
        </Pressable>
      </div>
    </>
  );
};
