import { num } from '@logbook/shared';
import { motion } from 'motion/react';
import type * as React from 'react';
import { memo, useRef } from 'react';
import type { DragPoint } from '@/lib/useDrag';
import { Mark, onOwnControl } from '@/ui/primitives';
import { useBlockHold, useSwipeLeft, type BlockMode } from './gestures';
import { INDENT_PX, rangeWords } from './layout';
import type { DayItem } from './model';
import type { DaySlot } from './types';

/** What the host does with a block's gestures; one object for every block, read through a ref so blocks stay memoised. */
export interface BlockHost {
  arm: (mode: BlockMode, ref: string, el: HTMLElement) => void;
  start: (mode: BlockMode, ref: string, p: DragPoint, el: HTMLElement) => void;
  move: (mode: BlockMode, ref: string, p: DragPoint) => void;
  drop: (mode: BlockMode, ref: string) => void;
  /** Armed and released unmoved: the menu; dragging and taken away: revert. */
  cancel: (mode: BlockMode, ref: string, menu: boolean, el: HTMLElement | null) => void;
  toggle: (ref: string) => void;
  open: (ref: string) => void;
  unschedule: (ref: string) => void;
}

export interface BlockProps {
  item: DayItem;
  slot: DaySlot;
  top: number;
  height: number;
  level: number;
  /** A session block laid out from the morning (door → back): it moves the alarm, cannot be resized or unscheduled. */
  derived?: boolean;
  editable: boolean;
  /** This block is in the air (moving or resizing). */
  live: BlockMode | null;
  /** The Mark's haptic: `toggle`, or none when the host fires `success` for the last open block. */
  markHaptic: 'toggle' | false;
  markDisabled: boolean;
  host: React.RefObject<BlockHost>;
}

/** A block with 45 minutes or more has room for its caption under the title. */
const CAPTION_MIN = 45;

/**
 * One block on the timeline (docs/today-v6.md §2): absolutely placed, the 3 px kind bar at its left edge, the title (one
 * line), the caption "7:30 – 8:15", the Mark at the right (square for a to-do, circle for a step or a session). Done: struck,
 * on `--surface-2`. A hold lifts it (scale 1.02, `--shadow-menu`); a drag then moves it, or resizes it from the 24 px grab
 * zone at the bottom (the pill handle shows on hold or hover); let go unmoved for its menu. Swipe left: back to the tray.
 * Tap the body for the item's sheet. Overlap indents it 12 px per level. `data-no-page` keeps the pager off it.
 */
export const Block = memo(function Block({ item, slot, top, height, level, derived, editable, live, markHaptic, markDisabled, host }: BlockProps) {
  const ref = item.ref;
  const h = useBlockHold<HTMLDivElement>({
    disabled: !editable,
    resizable: !derived,
    onArm: (mode, el) => {
      quiet.current = true;
      host.current.arm(mode, ref, el);
    },
    onStart: (mode, p, el) => host.current.start(mode, ref, p, el),
    onMove: (mode, p) => host.current.move(mode, ref, p),
    onDrop: (mode) => host.current.drop(mode, ref),
    onCancel: (mode, phase, reason, el) => host.current.cancel(mode, ref, phase === 'armed' && reason === 'up', el),
  });
  const sw = useSwipeLeft({ disabled: !editable || derived || !!live, onCommit: () => host.current.unschedule(ref) });
  // a hold that came to a menu or a drag, or a swipe, owns its release: the click after it opens nothing
  const quiet = useRef(false);
  const done = item.done;
  const caption = item.kind === 'session' ? [rangeWords(slot.start, slot.minutes), item.session.kind === 'run' && item.session.miles ? `${num(item.session.miles)} mi` : item.session.minutes ? `${item.session.minutes} min` : null].filter(Boolean).join(' · ') : rangeWords(slot.start, slot.minutes);
  const tall = slot.minutes >= CAPTION_MIN;
  const status = item.kind === 'session' ? item.status : done ? 'done' : 'open';
  const markLabel = item.kind === 'session' ? (done ? `${item.title}, ${item.status}. Not done` : item.status === 'skipped' ? `${item.title}, skipped. Put it back` : `Mark ${item.title} done`) : done ? `${item.title}, done. Not done` : `Mark ${item.title} done`;
  const tone = item.kind === 'session' ? `t-${item.tone}` : '';
  return (
    <div
      ref={h.ref}
      className={`dy-block kind-${item.kind} ${tone} ${done ? 'is-done' : ''} ${h.held ? `is-held is-${h.held}` : ''} ${live ? `is-live is-${live}` : ''} ${sw.armed ? 'is-armed' : ''} ${sw.swiping ? 'is-swiping' : ''}`}
      style={{ top, height, '--dy-indent': `${level * INDENT_PX}px` } as React.CSSProperties}
      data-dy-block={ref}
      data-no-page=""
      role="group"
      aria-label={`${item.title}, ${caption}${done ? ', done' : ''}`}
      onPointerDown={(e) => {
        quiet.current = false;
        h.bind.onPointerDown(e);
        sw.bind.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        h.bind.onPointerMove(e);
        sw.bind.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        h.bind.onPointerUp();
        sw.bind.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        h.bind.onPointerCancel();
        sw.bind.onPointerCancel(e);
      }}
      onContextMenu={h.bind.onContextMenu}
      onClick={(e) => {
        if (h.consumeClick() || quiet.current || onOwnControl(e)) return;
        host.current.open(ref);
      }}
    >
      <div className="dy-swipe-pane" aria-hidden="true">
        <span className="dy-swipe-label">Back to tray</span>
      </div>
      <motion.div className="dy-block-in" style={{ x: sw.x }}>
        <div className="dy-block-main">
          <span className="dy-block-title">{item.title}</span>
          {tall ? <span className="dy-block-cap">{caption}</span> : null}
        </div>
        <span className="dy-block-mark">
          <Mark square={item.kind === 'todo'} status={status} label={markLabel} disabled={markDisabled} haptic={markHaptic} onClick={() => host.current.toggle(ref)} />
        </span>
      </motion.div>
      {!derived && editable ? (
        <span className="dy-grip" aria-hidden="true">
          <span className="dy-grip-pill" />
        </span>
      ) : null}
    </div>
  );
});
