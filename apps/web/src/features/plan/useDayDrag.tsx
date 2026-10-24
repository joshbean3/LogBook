import { tone, type Session } from '@logbook/shared';
import { motionValue } from 'motion/react';
import { useRef, type RefObject } from 'react';
import { useTabScroller } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { LIFT_SCALE } from '@/lib/motion';
import { settleEasing } from './flip';
import type { DragPoint } from '@/ui/useHold';

/**
 * Plan's drag after the hold (docs/feel.md §7.2, §11.2; build plan §5.2 item 2). The row is a `Pressable` with a hold
 * menu: at 450 ms it lifts in place (useHold) and the menu opens; a move past 8 px closes the menu and hands the session
 * to the finger. This hook supplies Pressable's three drag callbacks:
 *
 * - **start**: a `.drag-pill` (the session's tone and name) appears above the finger, portalled to `body`, and follows it
 *   1:1: its transform is written synchronously on every pointer move (no React render while it flies);
 * - **move**: the day under the finger is lit (`.is-target`: the 2 px accent ring and `--accent-tint`), one `select` per
 *   row crossed; near the scroller's top or bottom edge the page scrolls under the drag;
 * - **end**: on another day the pill shrinks into the day's slot on `springs.settle` (a compositor animation: transform
 *   only, its easing the spring itself, so a busy main thread cannot stall it) while the row it left stays dimmed; on the
 *   landing frame `onDrop(to)` runs (the caller reshapes, fires `drop` or `warning`, raises the toast), the new row renders
 *   under the pill with its content held back (`data-landing`), and the two cross over in 120 ms while the displaced rows
 *   FLIP (flip.ts). On its own day, off any day, or cancelled, the pill springs back to where it came from.
 *
 * Every day that takes a drop carries `data-plan-day="YYYY-MM-DD"`; every session row `data-session-id`.
 */
export const PLAN_DAY = 'data-plan-day';

/** How far above the finger the pill rides, so the day under the finger stays readable. */
const RISE = 36;
const EDGE = 64;
const MAX_STEP = 14;

const dayAt = (x: number, y: number): HTMLElement | null => document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${PLAN_DAY}]`) ?? null;

/** The session that has just been dropped: its new row hides its content until the pill lands in it. */
let landing: { id: string; at: number } | null = null;
export const isLanding = (id: string) => !!landing && landing.id === id && performance.now() - landing.at < 1500;
const endLanding = (id: string) => {
  if (landing?.id === id) landing = null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-session-id="${CSS.escape(id)}"][data-landing]`))) el.removeAttribute('data-landing');
};

interface Flight {
  pill: HTMLElement;
  w: number;
  h: number;
  x: ReturnType<typeof motionValue<number>>;
  y: ReturnType<typeof motionValue<number>>;
  s: ReturnType<typeof motionValue<number>>;
  over: HTMLElement | null;
  overDay: string | null;
  fx: number;
  fy: number;
  raf: number;
  off: () => void;
}

/** The pill's top-left for a finger at (fx, fy). */
const anchor = (f: Pick<Flight, 'w' | 'h'>, fx: number, fy: number) => ({ x: fx - f.w / 2, y: fy - RISE - f.h / 2 });

export const useDayDrag = ({ date, session, title, row, onDrop, disabled }: { date: string; session: Session; title: string; row: RefObject<HTMLElement | null>; onDrop: (to: string) => void; disabled?: boolean }) => {
  const scroller = useTabScroller();
  const fl = useRef<Flight | null>(null);
  const o = useRef({ date, onDrop });
  o.current = { date, onDrop };

  const light = (f: Flight, el: HTMLElement | null) => {
    const day = el?.getAttribute(PLAN_DAY) ?? null;
    // the source day is not a target (dropping there puts it back), but crossing it is a row crossed
    const lit = day && day !== o.current.date ? el : null;
    if (f.over !== lit) {
      f.over?.classList.remove('is-target');
      lit?.classList.add('is-target');
      f.over = lit;
    }
    if (day !== f.overDay) {
      if (day && f.overDay !== null) haptics.select();
      if (day) f.overDay = day;
    }
  };
  const write = (f: Flight) => {
    f.pill.style.transform = `translate3d(${f.x.get().toFixed(2)}px, ${f.y.get().toFixed(2)}px, 0) scale(${f.s.get().toFixed(4)})`;
  };
  /** Scroll the tab under a drag held near its top or bottom edge; the lit day follows the content. */
  const edgeScroll = (f: Flight) => {
    const sc = scroller.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    const bar = sc.querySelector<HTMLElement>('.nb-bar');
    const top = r.top + (bar ? bar.offsetHeight : 0);
    let step = 0;
    if (f.fy < top + EDGE) step = -Math.min(MAX_STEP, ((top + EDGE - f.fy) / EDGE) * MAX_STEP);
    else if (f.fy > r.bottom - EDGE) step = Math.min(MAX_STEP, ((f.fy - (r.bottom - EDGE)) / EDGE) * MAX_STEP);
    if (step) {
      const before = sc.scrollTop;
      sc.scrollTop = before + step;
      if (sc.scrollTop !== before) light(f, dayAt(f.fx, f.fy));
    }
    f.raf = requestAnimationFrame(() => edgeScroll(f));
  };

  const start = (p: DragPoint) => {
    if (disabled) return;
    const pill = document.createElement('div');
    pill.className = `drag-pill t-${tone(session)}`;
    pill.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('i');
    dot.className = 'drag-pill-dot';
    const name = document.createElement('span');
    name.className = 'drag-pill-name';
    name.textContent = title;
    pill.append(dot, name);
    document.body.appendChild(pill);
    const w = pill.offsetWidth;
    const h = pill.offsetHeight;
    const a = anchor({ w, h }, p.x, p.y);
    const f: Flight = { pill, w, h, x: motionValue(a.x), y: motionValue(a.y), s: motionValue(LIFT_SCALE), over: null, overDay: o.current.date, fx: p.x, fy: p.y, raf: 0, off: () => undefined };
    const offs = [f.x.on('change', () => write(f)), f.y.on('change', () => write(f)), f.s.on('change', () => write(f))];
    f.off = () => offs.forEach((x) => x());
    write(f);
    pill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    fl.current = f;
    f.raf = requestAnimationFrame(() => edgeScroll(f));
  };
  const move = (p: DragPoint) => {
    const f = fl.current;
    if (!f) return;
    f.fx = p.x;
    f.fy = p.y;
    const a = anchor(f, p.x, p.y);
    f.x.set(a.x);
    f.y.set(a.y);
    light(f, dayAt(p.x, p.y));
  };
  /** The pill's transform for its centre-left on a slot's name (the slot's left + 16, its centre line), at `scale`. */
  const onto = (f: Flight, r: DOMRect, scale: number) => {
    const tx = r.left + 16 + (f.w * scale) / 2 - f.w / 2;
    const ty = r.top + r.height / 2 - f.h / 2;
    return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale})`;
  };
  /** Fly the pill onto `r` on springs.settle (WAAPI, transform only); resolves on the landing frame. */
  const fly = (f: Flight, r: DOMRect | null, scale: number) => {
    f.off();
    if (!r) return Promise.resolve();
    const a = f.pill.animate([{ transform: f.pill.style.transform }, { transform: onto(f, r, scale) }], { ...settleEasing, fill: 'forwards' });
    return a.finished.then(
      () => undefined,
      () => undefined,
    );
  };
  const fadeOut = (f: Flight) => {
    const a = f.pill.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' });
    void a.finished.finally(() => f.pill.remove()).catch(() => undefined);
  };
  const end = (p: DragPoint, cancelled: boolean) => {
    const f = fl.current;
    if (!f) return;
    fl.current = null;
    cancelAnimationFrame(f.raf);
    f.over?.classList.remove('is-target');
    const src = row.current;
    const back = () => void fly(f, src?.getBoundingClientRect() ?? null, 1).then(() => fadeOut(f));
    if (cancelled) return back();
    // the release point is the last word: a final move can be coalesced away before the up
    const el = dayAt(p.x, p.y);
    const to = el?.getAttribute(PLAN_DAY) ?? null;
    if (!to || to === o.current.date) return back();
    const id = session.id;
    // the slot it goes into: the day's first row (the session leads the day it lands on)
    const slotEl = el?.querySelector<HTMLElement>('.pl-line') ?? el;
    src?.classList.add('is-moving');
    // the row it left keeps its placeholder look until the data moves it (or, if the write never lands, for 1.5 s)
    setTimeout(() => src?.classList.remove('is-moving'), 1500);
    void fly(f, slotEl?.getBoundingClientRect() ?? null, 0.9).then(() => {
      landing = { id, at: performance.now() };
      o.current.onDrop(to);
      // the new row renders under the pill (its content held back); then they cross over
      const t0 = performance.now();
      const wait = () => {
        const there = document.querySelector(`[${PLAN_DAY}="${to}"] [data-session-id="${CSS.escape(id)}"]`);
        if (!there && performance.now() - t0 < 1000) return void requestAnimationFrame(wait);
        endLanding(id);
        fadeOut(f);
      };
      requestAnimationFrame(wait);
    });
  };

  return {
    onDragStart: (p: DragPoint) => start(p),
    onDragMove: (p: DragPoint) => move(p),
    onDragEnd: (p: DragPoint, _e: PointerEvent, cancelled: boolean) => end(p, cancelled),
  };
};
