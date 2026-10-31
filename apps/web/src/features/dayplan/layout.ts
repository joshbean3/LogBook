import { DAY_BANDS, emptyBands, type DayBands } from '@logbook/shared';
import type { DayPlanBody, DaySettings, DaySlot } from './types';

/**
 * The timeline's geometry and words (docs/today-v6.md §1, §2, §5), pure: a slot to its box, the overlap indent, the
 * 15-minute snap, the day's window and the tray's derivation. Nothing here touches the DOM.
 */

/** 56 px per hour; 40 px for the hour labels; a block is never shorter than 24 px; every edge snaps to 15 min. */
export const PX_PER_HOUR = 56;
export const PX_PER_MIN = PX_PER_HOUR / 60;
export const LABEL_W = 40;
export const MIN_BLOCK_PX = 24;
export const SNAP_MIN = 15;
export const MIN_SLOT_MIN = 15;
export const MAX_SLOT_MIN = 720;
/** The overlap indent per level, and the most levels drawn. */
export const INDENT_PX = 12;
export const MAX_INDENT = 2;
/** What a dropped chip gets by kind. */
export const DEFAULT_MINUTES = { todo: 30, step: 45, session: 60 } as const;
/** The page auto-scrolls while the finger is this close to the viewport's top or bottom. */
export const AUTO_SCROLL_EDGE = 64;

export interface DayWindow {
  start: number;
  end: number;
}
export const DEFAULT_WINDOW: DayWindow = { start: 360, end: 1380 };

const floorHour = (m: number) => Math.floor(m / 60) * 60;
const ceilHour = (m: number) => Math.ceil(m / 60) * 60;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The window the timeline shows: the settings' (06:00 to 23:00 by default), from the morning's wake rounded down to the
 * hour when that is earlier, and stretched to the hour around any slot that would fall outside it.
 */
export const windowOf = (settings: Pick<DaySettings, 'window'> | null | undefined, morning: { wake: number; leave?: number } | null | undefined, slots: readonly Pick<DaySlot, 'start' | 'minutes'>[] = []): DayWindow => {
  let start = settings?.window?.start ?? DEFAULT_WINDOW.start;
  let end = settings?.window?.end ?? DEFAULT_WINDOW.end;
  if (morning) {
    start = Math.min(start, floorHour(morning.wake));
    if (morning.leave != null) end = Math.max(end, ceilHour(morning.leave));
  }
  for (const s of slots) {
    start = Math.min(start, floorHour(s.start));
    end = Math.max(end, ceilHour(s.start + s.minutes));
  }
  start = Math.max(0, start);
  end = Math.min(1440, Math.max(end, start + 60));
  return { start, end };
};

export const heightOf = (w: DayWindow) => (w.end - w.start) * PX_PER_MIN;

/** A slot's box inside the timeline: top from the window's start, height by its minutes, never under 24 px. */
export const slotRect = (slot: Pick<DaySlot, 'start' | 'minutes'>, w: DayWindow): { top: number; height: number } => ({
  top: Math.round((slot.start - w.start) * PX_PER_MIN),
  height: Math.max(MIN_BLOCK_PX, Math.round(slot.minutes * PX_PER_MIN)),
});

/** To the nearest quarter hour. */
export const snap15 = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN;
/** The minutes under a y inside the timeline (unsnapped). */
export const minutesAtY = (y: number, w: DayWindow) => w.start + y / PX_PER_MIN;
/** A start that keeps the whole block inside the window. */
export const clampStart = (start: number, minutes: number, w: DayWindow) => Math.max(w.start, Math.min(w.end - minutes, start));
/** A length in 15-minute steps, 15 min at least, never past the window's end. */
export const clampMinutes = (minutes: number, start: number, w: DayWindow) => Math.max(MIN_SLOT_MIN, Math.min(MAX_SLOT_MIN, w.end - start, snap15(minutes)));

/** The hour labels and lines from the window's first hour to its last, as minutes from midnight. */
export const hoursOf = (w: DayWindow): number[] => {
  const out: number[] = [];
  for (let m = ceilHour(w.start); m <= w.end; m += 60) out.push(m);
  return out;
};

/**
 * Overlap (§2): a block that starts inside another is indented one level under it and drawn above it, two levels at most.
 * Ordered by start, the longer first among equals, so the container comes before what it holds.
 */
export const overlapIndent = (slots: readonly DaySlot[]): Map<string, number> => {
  const sorted = [...slots].sort((a, b) => a.start - b.start || b.minutes - a.minutes);
  const level = new Map<string, number>();
  const open: Array<{ end: number; level: number }> = [];
  for (const s of sorted) {
    let lv = 0;
    for (const o of open) if (s.start < o.end) lv = Math.max(lv, Math.min(MAX_INDENT, o.level + 1));
    level.set(s.ref, lv);
    open.push({ end: s.start + s.minutes, level: lv });
  }
  return level;
};

/** The order blocks are painted in: by level, then by start (a later block over an earlier one at the same level). */
export const paintOrder = (slots: readonly DaySlot[], levels: Map<string, number>): DaySlot[] => [...slots].sort((a, b) => (levels.get(a.ref) ?? 0) - (levels.get(b.ref) ?? 0) || a.start - b.start);

// ---------- the tray ----------
/** Anything live for the day with a reference the plan can hold (`altRefs`: the provisional id a to-do was born with). */
export interface Referenced {
  ref: string;
  altRefs?: readonly string[];
  /** A done item is never "to place": it leaves the tray (a placed one stays on the timeline, struck). */
  done?: boolean;
}

/**
 * The tray (§5): everything live for the day that is in neither the slots nor a band, after the bands' refs in band order.
 * `items` come in their own priority order (the goal's steps, then the to-dos by priority).
 */
export const trayOf = <T extends Referenced>(plan: Pick<DayPlanBody, 'bands' | 'slots'> | null | undefined, items: readonly T[]): T[] => {
  const by = new Map<string, T>();
  for (const it of items) {
    by.set(it.ref, it);
    for (const a of it.altRefs ?? []) by.set(a, it);
  }
  const placed = new Set<T>();
  for (const s of plan?.slots ?? []) {
    const it = by.get(s.ref);
    if (it) placed.add(it);
  }
  const out: T[] = [];
  const seen = new Set<T>();
  for (const b of DAY_BANDS)
    for (const r of plan?.bands[b] ?? []) {
      const it = by.get(r);
      if (it && !it.done && !placed.has(it) && !seen.has(it)) {
        seen.add(it);
        out.push(it);
      }
    }
  for (const it of items) if (!it.done && !placed.has(it) && !seen.has(it)) out.push(it);
  return out;
};

/** The slots that name something live, with each slot's ref written under the item's current id. */
export const placedOf = <T extends Referenced>(plan: Pick<DayPlanBody, 'slots'> | null | undefined, items: readonly T[]): Array<{ slot: DaySlot; item: T }> => {
  const by = new Map<string, T>();
  for (const it of items) {
    by.set(it.ref, it);
    for (const a of it.altRefs ?? []) by.set(a, it);
  }
  const out: Array<{ slot: DaySlot; item: T }> = [];
  const seen = new Set<T>();
  for (const slot of plan?.slots ?? []) {
    const item = by.get(slot.ref);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push({ slot: slot.ref === item.ref ? slot : { ...slot, ref: item.ref as DaySlot['ref'] }, item });
  }
  return out;
};

// ---------- plan edits (each returns the whole body for one PUT) ----------
const withoutRef = (bands: DayBands, ref: string): DayBands => {
  const out = emptyBands();
  for (const b of DAY_BANDS) out[b] = bands[b].filter((r) => r !== ref);
  return out;
};
const bodyOf = (plan: Pick<DayPlanBody, 'bands' | 'slots'> | null | undefined): DayPlanBody => ({ bands: plan?.bands ?? emptyBands(), slots: plan?.slots ?? [] });

/** Place (or move / resize) one ref: its slot replaced, the ref out of the bands. */
export const placeSlot = (plan: Pick<DayPlanBody, 'bands' | 'slots'> | null | undefined, slot: DaySlot): DayPlanBody => {
  const p = bodyOf(plan);
  return { bands: withoutRef(p.bands, slot.ref), slots: [...p.slots.filter((s) => s.ref !== slot.ref), slot] };
};
/** Back to the tray. */
export const unscheduleSlot = (plan: Pick<DayPlanBody, 'bands' | 'slots'> | null | undefined, ref: string): DayPlanBody => {
  const p = bodyOf(plan);
  return { bands: p.bands, slots: p.slots.filter((s) => s.ref !== ref) };
};

/** The first quarter hour at or after `from` where `minutes` fit without overlapping a slot, inside the window; null when none. */
export const nextFree = (slots: readonly DaySlot[], from: number, minutes: number, w: DayWindow): number | null => {
  let t = Math.max(w.start, Math.ceil(from / SNAP_MIN) * SNAP_MIN);
  const busy = [...slots].sort((a, b) => a.start - b.start);
  while (t + minutes <= w.end) {
    const hit = busy.find((s) => t < s.start + s.minutes && s.start < t + minutes);
    if (!hit) return t;
    t = Math.ceil((hit.start + hit.minutes) / SNAP_MIN) * SNAP_MIN;
  }
  return null;
};

// ---------- words ----------
/** "7:30" (no meridiem: the hour labels carry it). */
export const clockShort = (m: number): string => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(v / 60);
  return `${h % 12 || 12}:${pad(v % 60)}`;
};
/** "7:30 – 8:00". */
export const rangeWords = (start: number, minutes: number) => `${clockShort(start)} – ${clockShort(start + minutes)}`;
/** "30 min", "1 h 30 min", "2 h". */
export const minutesWords = (m: number): string => {
  const v = Math.round(m);
  if (v < 60) return `${v} min`;
  const r = v % 60;
  return `${Math.floor(v / 60)} h${r ? ` ${r} min` : ''}`;
};
/** The head's "3 h 45" (the unit after the hours only). */
export const plannedWords = (m: number): string => {
  const v = Math.round(m);
  if (v < 60) return `${v} min`;
  const r = v % 60;
  return `${Math.floor(v / 60)} h${r ? ` ${pad(r)}` : ''}`;
};
/** "3 of 7 done · 3 h 45 planned"; nothing with nothing in the day. */
export const metaWords = (done: number, total: number, planned: number): string | null => {
  if (!total) return null;
  const parts = [`${done} of ${total} done`];
  if (planned > 0) parts.push(`${plannedWords(planned)} planned`);
  return parts.join(' · ');
};
/** "6 AM", "12 PM": the label column's caps. */
export const hourLabel = (m: number): string => {
  const h = Math.floor((((m % 1440) + 1440) % 1440) / 60);
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};
/** "Add at 2:30". */
export const addAtWords = (m: number) => `Add at ${clockShort(m)}`;
