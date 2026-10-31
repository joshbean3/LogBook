import type { ISODate } from '@logbook/shared';
import type * as React from 'react';
import { memo } from 'react';
import { QuickAddField } from '../todos/TodoList';
import { Block, type BlockHost } from './Block';
import type { BlockMode } from './gestures';
import { addAtWords, clockShort, DEFAULT_MINUTES, heightOf, hourLabel, hoursOf, LABEL_W, minutesAtY, overlapIndent, paintOrder, PX_PER_HOUR, slotRect, snap15, type DayWindow } from './layout';
import type { DayItem } from './model';
import type { DaySlot } from './types';

/** A placed block: its slot and the item it names; `derived` when it is the session laid out from the morning. */
export interface Placed {
  slot: DaySlot;
  item: DayItem;
  derived?: boolean;
}

/** The morning as a ghost: the alarm to the front door. */
export interface MorningGhost {
  wake: number;
  /** Out the door (the run or the walk to the gym); null on a rest morning. */
  door: number | null;
  leave: number;
}

export interface TimelineProps {
  date: ISODate;
  today: ISODate;
  window: DayWindow;
  /** The clock, when the shown day is today. */
  now: number | null;
  editable: boolean;
  blocks: Placed[];
  morning: MorningGhost | null;
  /** The ref in the air and how. */
  live: { ref: string; mode: BlockMode } | null;
  /** A chip is over the timeline: where it would land. */
  target: { start: number; minutes: number } | null;
  /** The inline Add field's time, when it is up. */
  adding: number | null;
  onAddAt: (minutes: number | null) => void;
  onAdded: (id: string, at: number) => void;
  /** Which blocks are the last open one (the Mark fires `success` through the host instead of `toggle`). */
  lastOpen: string | null;
  host: React.RefObject<BlockHost>;
  tlRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The day as a vertical timeline (docs/today-v6.md §1): hour labels in caps down a 40 px column, a hairline per hour, a
 * dashed line per half hour, 56 px an hour, the now line when the day is today (past labels dimmed), the morning as a ghost
 * block behind everything, then the blocks. It scrolls with the page. A tap on an empty spot opens the inline Add field
 * at that quarter hour.
 */
export const Timeline = memo(function Timeline({ date, today, window: w, now, editable, blocks, morning, live, target, adding, onAddAt, onAdded, lastOpen, host, tlRef }: TimelineProps) {
  const H = heightOf(w);
  const hours = hoursOf(w);
  const levels = overlapIndent(blocks.map((b) => b.slot));
  const order = paintOrder(blocks.map((b) => b.slot), levels).map((s) => blocks.find((b) => b.slot === s)!);
  const past = (m: number) => (now != null ? m < now : date < today);
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return;
    const t = e.target as Element;
    if (t.closest('.dy-block, .dy-add, .dy-target')) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < LABEL_W) return;
    const at = Math.max(w.start, Math.min(w.end - 30, snap15(minutesAtY(e.clientY - r.top, w))));
    onAddAt(at);
  };
  const morningBox = morning ? slotRect({ start: morning.wake, minutes: Math.max(15, morning.leave - morning.wake) }, w) : null;
  return (
    <div ref={tlRef} className="dy-tl" style={{ height: H }} onClick={onTap} role="presentation">
      {hours.map((m) => {
        const top = (m - w.start) * (PX_PER_HOUR / 60);
        return (
          <div key={m} className={`dy-hour ${past(m) ? 'is-past' : ''}`} style={{ top }} aria-hidden="true">
            <span className="caps dy-hour-label">{hourLabel(m)}</span>
            <span className="dy-hour-line" />
            {m + 30 < w.end ? <span className="dy-half-line" /> : null}
          </div>
        );
      })}
      {morning && morningBox ? (
        <div className="dy-morning" style={{ top: morningBox.top, height: morningBox.height }} aria-label={`Morning, ${clockShort(morning.wake)} to ${clockShort(morning.leave)}`}>
          <span className="dy-morning-label">{morning.door != null ? `Morning · out the door ${clockShort(morning.door)}` : `Morning · leave ${clockShort(morning.leave)}`}</span>
        </div>
      ) : null}
      {order.map((b) => {
        const box = slotRect(b.slot, w);
        return <Block key={b.item.ref} item={b.item} slot={b.slot} top={box.top} height={box.height} level={levels.get(b.slot.ref) ?? 0} derived={b.derived} editable={editable} live={live?.ref === b.item.ref ? live.mode : null} markHaptic={lastOpen === b.item.ref ? false : 'toggle'} markDisabled={b.item.kind === 'session' ? b.item.auto || date > today : !editable && date !== today} host={host} />;
      })}
      {target ? (
        <div className="dy-target" style={slotRect(target, w)} aria-hidden="true">
          <span className="dy-target-cap">{clockShort(target.start)}</span>
        </div>
      ) : null}
      {now != null && now >= w.start && now <= w.end ? (
        <div className="dy-now" style={{ top: (now - w.start) * (PX_PER_HOUR / 60) }} aria-hidden="true">
          <span className="dy-now-dot" />
        </div>
      ) : null}
      {adding != null ? (
        <div className="dy-add" style={{ top: slotRect({ start: adding, minutes: DEFAULT_MINUTES.todo }, w).top }}>
          <QuickAddField key={adding} date={today} due={date !== today ? date : undefined} placeholder={addAtWords(adding)} autoFocus onClose={() => onAddAt(null)} onAdd={(id) => onAdded(id, adding)} />
        </div>
      ) : null}
    </div>
  );
});
