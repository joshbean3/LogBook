import { Target } from 'lucide-react';
import type * as React from 'react';
import { memo, useRef } from 'react';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { useContextMenu } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import type { DragPoint } from '@/ui/useHold';
import { PriorityFlag } from '../todos/PriorityDots';
import type { DayItem } from './model';

/** What the host does with a chip: the drag into the timeline, the tap, the menu. */
export interface TrayHost {
  /** The hold is up: the chip lifts into the ghost at its rect. */
  lift: (item: DayItem, el: HTMLElement) => void;
  start: (item: DayItem, p: DragPoint) => void;
  move: (item: DayItem, p: DragPoint) => void;
  /** The finger let go: a drop, or (cancelled, or never moved) the ghost comes home. */
  end: (item: DayItem, cancelled: boolean) => void;
  open: (item: DayItem) => void;
  menu: (item: DayItem) => ContextMenuItem[];
}

/** The words of a chip: the priority dot or the Target, then the text. Drawn in the tray and in the ghost. */
export const ChipFace = ({ item }: { item: DayItem }) => (
  <>
    {item.kind === 'step' ? <Target size={14} strokeWidth={2.4} className="dy-chip-ic" aria-hidden="true" /> : item.kind === 'todo' ? <PriorityFlag level={item.todo.priority} decorative /> : null}
    <span className="dy-chip-text">{item.title}</span>
  </>
);

const Chip = memo(function Chip({ item, editable, hole, host }: { item: DayItem; editable: boolean; hole: boolean; host: React.RefObject<TrayHost> }) {
  const cm = useContextMenu();
  const el = useRef<HTMLElement>(null);
  // the hold is up and nothing moved yet: the release opens the menu (a drag takes the chip instead)
  const armed = useRef(false);
  const label = item.kind === 'step' ? `${item.title}, a step of today’s goal` : item.title;
  const openMenu = (anchor: HTMLElement, haptic: boolean) => {
    const items = host.current.menu(item);
    if (items.length) cm.open({ items, anchor, lift: anchor, label: `${item.title} actions`, haptic });
  };
  return (
    <Pressable
      ref={el}
      as="div"
      className={`chip-btn dy-chip ${hole ? 'is-hole' : ''} ${item.done ? 'is-done' : ''}`}
      press="scale"
      data-dy-chip={item.ref}
      label={editable ? `${label}. Hold to place` : label}
      onPress={() => host.current.open(item)}
      onHold={(info) => {
        if (info.source === 'keyboard' || !editable) return openMenu(info.target, false);
        armed.current = true;
        host.current.lift(item, info.target);
      }}
      onDragStart={
        editable
          ? (p) => {
              armed.current = false;
              host.current.start(item, p);
            }
          : undefined
      }
      onDragMove={editable ? (p) => host.current.move(item, p) : undefined}
      onDragEnd={editable ? (_p, _e, cancelled) => host.current.end(item, cancelled) : undefined}
      onPointerUp={() => {
        if (!armed.current) return;
        armed.current = false;
        host.current.end(item, true);
        if (el.current) openMenu(el.current, false);
      }}
      onPointerCancel={() => {
        if (!armed.current) return;
        armed.current = false;
        host.current.end(item, true);
      }}
    >
      <ChipFace item={item} />
    </Pressable>
  );
});

/**
 * "To place" (docs/today-v6.md §1): the unscheduled to-dos and the goal's steps as chips that wrap, each a Pressable. Hold
 * one and it lifts into a ghost that follows the finger onto the timeline (or the goal row); tap it for its sheet; hold
 * and let go for its menu. Empty: "Everything has a time."
 */
export const Tray = memo(function Tray({ items, editable, hole, host }: { items: DayItem[]; editable: boolean; hole: string | null; host: React.RefObject<TrayHost> }) {
  return (
    <div className="dy-tray" role="group" aria-label="To place">
      <span className="caps dy-tray-head">To place</span>
      {items.length ? (
        <div className="dy-chips">
          {items.map((it) => (
            <Chip key={it.ref} item={it} editable={editable} hole={hole === it.ref} host={host} />
          ))}
        </div>
      ) : (
        <p className="dy-tray-empty">Everything has a time.</p>
      )}
    </div>
  );
});
