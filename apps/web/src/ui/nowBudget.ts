import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useNavInternal, useTabOrNull } from '@/app/NavController';

/**
 * The Sunrise budget (guide 3.5, plan 5.2 and D13). Sunrise means now, and at most three Sunrise elements show on a screen.
 * Every now-mark registers while it is on screen with `useNowMark(kind, visible)` and paints what it is told:
 *
 *   'now'  Sunrise with its Paper keyline
 *   'ink'  the same shape in Night Ink with its keyline (it yields)
 *
 * Priority, highest first (ties by registration order): 1 'strip', today's dot in the week strip; 2 'pointer', the gauge
 * pointer, a live node on a timeline, a chart's now dot and NOW tick (each its own element); 3 'stamp', the milestone stamp
 * or a legend swatch; 4 'badge', a badge dot. The first three elements stay Sunrise; and of the badges, only the first
 * (the dock's, which registers first) may: the shell shows at most one Sunrise badge. It counts elements, not jobs.
 *
 * A module-level map and `useSyncExternalStore`: no layout effect measures anything, nothing renders unless a mark comes,
 * goes or changes its visibility. Elements set `data-now="ink"` from the result, and CSS paints it.
 */
export type NowKind = 'strip' | 'pointer' | 'stamp' | 'badge';
export type NowPaint = 'now' | 'ink';

const PRIORITY: Record<NowKind, number> = { strip: 1, pointer: 2, stamp: 3, badge: 4 };
/** How many Sunrise elements a screen may show (guide 3.5). */
export const NOW_BUDGET = 3;

interface Mark {
  kind: NowKind;
  seq: number;
}
const marks = new Map<number, Mark>();
const listeners = new Set<() => void>();
let paints = new Map<number, NowPaint>();
let nextId = 1;
let nextSeq = 1;

const recompute = () => {
  const sorted = [...marks.entries()].sort((a, b) => PRIORITY[a[1].kind] - PRIORITY[b[1].kind] || a[1].seq - b[1].seq);
  const next = new Map<number, NowPaint>();
  let lit = 0;
  let badges = 0;
  for (const [id, m] of sorted) {
    const isBadge = m.kind === 'badge';
    const ok = lit < NOW_BUDGET && (!isBadge || badges === 0);
    if (ok) lit += 1;
    if (isBadge && ok) badges += 1;
    next.set(id, ok ? 'now' : 'ink');
  }
  paints = next;
  for (const l of listeners) l();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** For tests and the gallery: what the store holds now. */
export const nowBudgetState = (): ReadonlyArray<{ kind: NowKind; paint: NowPaint }> =>
  [...marks.entries()].sort((a, b) => a[1].seq - b[1].seq).map(([id, m]) => ({ kind: m.kind, paint: paints.get(id) ?? 'now' }));

/** For tests: forget every mark. */
export const resetNowBudget = (): void => {
  marks.clear();
  paints = new Map();
  for (const l of listeners) l();
};

/** Plain registration, for code outside React (and the tests). Returns the unregister function. */
export const registerNowMark = (kind: NowKind): { id: number; release: () => void } => {
  const id = nextId++;
  marks.set(id, { kind, seq: nextSeq++ });
  recompute();
  return {
    id,
    release: () => {
      if (marks.delete(id)) recompute();
    },
  };
};
export const paintOf = (id: number): NowPaint => paints.get(id) ?? 'now';

/**
 * Register a now-mark while `visible` and read how to paint it. A mark that is not visible does not count, and reads 'now'
 * (it is not drawn, or not seen). The registration happens in a layout effect, so a yielding mark never paints a frame in
 * Sunrise.
 */
export const useNowMark = (kind: NowKind, visible = true): NowPaint => {
  const id = useRef(0);
  useLayoutEffect(() => {
    if (!visible) return;
    const r = registerNowMark(kind);
    id.current = r.id;
    return () => {
      id.current = 0;
      r.release();
    };
  }, [kind, visible]);
  const get = () => (id.current ? paintOf(id.current) : 'now');
  return useSyncExternalStore(subscribe, get, get);
};

/**
 * True while the caller's page is the one on screen: its tab is active and, for a tab root, nothing is pushed over it.
 * Outside a tab (the dock, a sheet's provider) it is true. A selector: it re-renders only when the answer flips.
 */
export const usePageShown = (): boolean => {
  const ctl = useNavInternal();
  const tab = useTabOrNull();
  const get = () => {
    if (!tab) return true;
    const st = ctl.state;
    return st.active === tab && (st.tabs[tab]?.stack.length ?? 0) === 0;
  };
  return useSyncExternalStore(ctl.subscribe, get, get);
};
