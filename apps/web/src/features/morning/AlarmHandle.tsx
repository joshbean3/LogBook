import { clockOfDay } from '@logbook/shared';
import { animate } from 'motion/react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ALARM_PX_PER_STEP, lockAxis, LOCK_PX } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { short, WAKE_MAX, WAKE_MIN, WAKE_STEP } from './model';

/** Past WAKE_MIN / WAKE_MAX the stamp follows the finger at a quarter of its travel (spec §4.2). */
const PAST_RANGE = 0.25;
/** The keyboard's steps go up as one write after this long without another key. */
const KEY_IDLE_MS = 700;

export interface AlarmHandleProps {
  /** The alarm the stamp shows (an alarm being dragged included). */
  wake: number;
  /** Past mornings: the stamp only. */
  disabled?: boolean;
  /** Every 5-minute step, while the finger (or the keyboard) moves the alarm: the page recomputes every row from it. */
  onStep: (wake: number, from: number) => void;
  /** Released (or the keyboard went quiet) on `wake`, `from` being where it began: one write when they differ. */
  onCommit: (wake: number, from: number) => void;
  /** A release before the lock, Enter or Space: the alarm sheet (the drag's fallback). */
  onTap: () => void;
  /** The drag began (the 10 px vertical lock) or ended. */
  onDragging?: (on: boolean) => void;
  /** The stamp lights while the alarm moves (the rows below light theirs). */
  moved?: boolean;
}

/**
 * The alarm, dragged by its stamp (spec §4.2): the Wake row's 48 × 60 time cell is a handle with `touch-action: none` on it
 * alone. A pointer locks after 10 px inside the 40° vertical cone (a horizontal lock lets go: the edge swipe has it); from
 * then each 14 px below the `pointerdown` point is 5 minutes later (`trunc(dy / 14)`, no re-base on the lock), one
 * `haptics.select()` a step, the digits crossfading 120 ms, and `onStep` re-laying the whole morning on the same frame
 * (`flushSync`). Past the alarm's range the stamp rubber-bands at 0.25×. The release writes once (`onCommit`). A release
 * before the lock is a tap. For the keyboard and VoiceOver it is a slider: ArrowUp / ArrowDown move 5 minutes (one write
 * after they stop), Enter opens the alarm sheet.
 */
export const AlarmHandle = ({ wake, disabled, onStep, onCommit, onTap, onDragging, moved }: AlarmHandleProps): React.JSX.Element => {
  const reduce = useReduced();
  const el = useRef<HTMLButtonElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const g = useRef({ id: -1, x0: 0, y0: 0, from: 0, cur: 0, phase: 'idle' as 'idle' | 'pending' | 'drag' | 'off', swallow: false });
  const keys = useRef<{ from: number; cur: number; t: ReturnType<typeof setTimeout> | 0 } | null>(null);
  const wakeRef = useRef(wake);
  wakeRef.current = wake;
  const cb = useRef({ onStep, onCommit, onDragging });
  cb.current = { onStep, onCommit, onDragging };

  // the two stacked labels: the new one fades in over the old one (120 ms), both in the same box
  const text = short(wake);
  const [labels, setLabels] = useState({ cur: text, prev: null as string | null, n: 0 });
  if (labels.cur !== text) setLabels({ cur: text, prev: labels.cur, n: labels.n + 1 });

  const band = (px: number) => {
    const s = stamp.current;
    if (s) s.style.transform = px ? `translateY(${px.toFixed(2)}px)` : '';
  };
  const bandHome = () => {
    const s = stamp.current;
    if (!s) return;
    const m = /translateY\((-?[\d.]+)px\)/.exec(s.style.transform);
    const from = m ? Number(m[1]) : 0;
    if (!from || reduce) return band(0);
    void animate(from, 0, { ...springs.settle, onUpdate: (v) => band(v) });
  };

  const step = (to: number, from: number) => {
    if (to === g.current.cur) return;
    g.current.cur = to;
    haptics.select();
    // every row below, the Now card and the Leave row recompute from this alarm on this frame
    flushSync(() => cb.current.onStep(to, from));
  };

  const end = (commit: boolean) => {
    const s = g.current;
    const was = s.phase;
    s.phase = 'idle';
    s.id = -1;
    el.current?.removeAttribute('data-pressed');
    if (was !== 'drag') return;
    s.swallow = true;
    bandHome();
    cb.current.onDragging?.(false);
    if (!commit && s.cur !== s.from) flushSync(() => cb.current.onStep(s.from, s.from));
    cb.current.onCommit(commit ? s.cur : s.from, s.from);
  };

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const down = (e: PointerEvent) => {
      if (disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const s = g.current;
      s.id = e.pointerId;
      s.x0 = e.clientX;
      s.y0 = e.clientY;
      s.from = s.cur = wakeRef.current;
      s.phase = 'pending';
      s.swallow = false;
      node.setAttribute('data-pressed', '');
    };
    const move = (e: PointerEvent) => {
      const s = g.current;
      if (e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;
      if (s.phase === 'pending') {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        const axis = lockAxis(dx, dy);
        if (axis === 'x') {
          // the edge swipe (or nothing) has it
          s.phase = 'off';
          s.swallow = true;
          node.removeAttribute('data-pressed');
          return;
        }
        if (axis !== 'y') return;
        s.phase = 'drag';
        node.removeAttribute('data-pressed');
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          /* gone */
        }
        cb.current.onDragging?.(true);
      }
      if (s.phase !== 'drag') return;
      const steps = Math.trunc(dy / ALARM_PX_PER_STEP);
      const want = s.from + steps * WAKE_STEP;
      const to = Math.min(WAKE_MAX, Math.max(WAKE_MIN, want));
      // past the range the stamp follows a quarter of the way; inside it, it rolls in steps and stays put
      const over = to === want ? 0 : dy - ((to - s.from) / WAKE_STEP) * ALARM_PX_PER_STEP;
      band(reduce ? 0 : over * PAST_RANGE);
      step(to, s.from);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== g.current.id) return;
      end(true);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== g.current.id) return;
      end(false);
    };
    // a touch is captured implicitly by the element under it (the digits): taking the capture onto the handle makes that
    // child lose it, which is not the handle losing the pointer
    const lost = (e: PointerEvent) => {
      if (e.target === node) cancel(e);
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', cancel);
    node.addEventListener('lostpointercapture', lost);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('lostpointercapture', lost);
    };
  }, [disabled, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  // the keyboard's steps: one write once the keys go quiet, or when the handle loses focus
  const flushKeys = () => {
    const k = keys.current;
    if (!k) return;
    keys.current = null;
    if (k.t) clearTimeout(k.t);
    cb.current.onCommit(k.cur, k.from);
  };
  useEffect(() => () => flushKeys(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? WAKE_STEP : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -WAKE_STEP : 0;
    if (!d) return;
    e.preventDefault();
    const k = (keys.current ??= { from: wake, cur: wake, t: 0 });
    const to = Math.min(WAKE_MAX, Math.max(WAKE_MIN, k.cur + d));
    if (to !== k.cur) {
      k.cur = to;
      haptics.select();
      flushSync(() => cb.current.onStep(to, k.from));
    }
    if (k.t) clearTimeout(k.t);
    k.t = setTimeout(flushKeys, KEY_IDLE_MS);
  };

  return (
    <button
      ref={el}
      type="button"
      role="slider"
      className={`alarm-handle ${moved ? 'is-moved' : ''}`}
      aria-label="Alarm"
      aria-valuemin={WAKE_MIN}
      aria-valuemax={WAKE_MAX}
      aria-valuenow={wake}
      aria-valuetext={clockOfDay(wake)}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onBlur={flushKeys}
      onClick={(e) => {
        // the click a drag (or a horizontal let-go) leaves behind is not a tap
        if (g.current.swallow) {
          g.current.swallow = false;
          e.preventDefault();
          return;
        }
        if (!disabled) onTap();
      }}
    >
      <span ref={stamp} className="ah-stamp sch-time">
        <span key={`c${labels.n}`} className={`ah-d ${labels.n ? 'in' : ''}`}>
          {labels.cur}
        </span>
        <span className="sch-flash" aria-hidden="true" data-t={labels.cur} />
        {labels.prev != null ? (
          <span key={`p${labels.n}`} className="ah-d out" aria-hidden="true" onAnimationEnd={() => setLabels((l) => (l.n === labels.n ? { ...l, prev: null } : l))}>
            {labels.prev}
          </span>
        ) : null}
      </span>
    </button>
  );
};
