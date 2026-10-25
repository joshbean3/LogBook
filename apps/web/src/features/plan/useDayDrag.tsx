import { tone, type Session } from '@logbook/shared';
import { motionValue } from 'motion/react';
import { useRef, type RefObject } from 'react';
import { useTabScroller } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { fadeIn, fadeOut as fadeOutT, LIFT_SCALE, reducedFade } from '@/lib/motion';
import { settleFor, waapiOf } from './flip';
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
 *   only, its easing the spring itself ending on the contract's 1 px rest, so a busy main thread cannot stall it), its name
 *   landing on the row's name. The write happens at the release (`onDrop(to, landed)`; an empty day's `Rest`/`+` fades
 *   100 ms first): the displaced rows FLIP (flip.ts) during the flight, together with the pill, and the new row is already
 *   there under it with its content held back (`data-landing`). On the frame the pill comes to rest `landed` resolves (the
 *   caller fires `drop` or `warning` and raises the toast) and the two cross over in 120 ms (review-feel-1 #2, code review
 *   1 #3). On its own day, off any day, or cancelled, the pill springs back to where it came from.
 *
 * Every day that takes a drop carries `data-plan-day="YYYY-MM-DD"`; every session row `data-session-id`.
 */
export const PLAN_DAY = 'data-plan-day';

/** How far above the finger the pill rides, so the day under the finger stays readable. */
const RISE = 36;
const EDGE = 64;
const MAX_STEP = 14;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/** A row of another day still sliding (a FLIP) over the slot: the crossover waits for it to pass (feel review 2 E). */
const covered = (slot: HTMLElement) => {
  const r = slot.getBoundingClientRect();
  const day = slot.closest(`[${PLAN_DAY}]`);
  for (const d of Array.from(slot.closest('.pl-wgroup')?.children ?? [])) {
    if (d === day || d.classList.contains('pl-wsurf') || !d.getAnimations().some((a) => a.playState === 'running')) continue;
    const q = d.getBoundingClientRect();
    if (q.bottom > r.top + 1 && q.top < r.bottom - 1) return true;
  }
  return false;
};

/** The pill's top-left for a finger at (fx, fy). */
const anchor = (f: Pick<Flight, 'w' | 'h'>, fx: number, fy: number) => ({ x: fx - f.w / 2, y: fy - RISE - f.h / 2 });

/**
 * `onDrop(to, landed)` writes the drop at the release and says whether it wrote; `landed` resolves on the frame the pill
 * rests in the slot (the haptic and the toast belong there).
 */
export const useDayDrag = ({
  date,
  session,
  title,
  row,
  onDrop,
  slotFor,
  disabled,
}: {
  date: string;
  session: Session;
  title: string;
  row: RefObject<HTMLElement | null>;
  onDrop: (to: string, landed: Promise<void>) => boolean;
  /** The row the session will occupy on `to` (0 = first; the count of rows there = a new row after the last). Default 0. */
  slotFor?: (to: string) => number;
  disabled?: boolean;
}) => {
  const scroller = useTabScroller();
  const fl = useRef<Flight | null>(null);
  const o = useRef({ date, onDrop, slotFor });
  o.current = { date, onDrop, slotFor };

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
    pill.animate([{ opacity: 0 }, { opacity: 1 }], waapiOf(fadeIn));
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
  /**
   * Where the pill goes for a row `line` of the slot: its name's left edge on the row name's left edge and its centre on
   * the name's centre line (the source row's own name offset, in layout px: the row may be scaled), at `scale` about the
   * pill's centre. Returns the transform and the distance it travels.
   */
  const onto = (f: Flight, line: HTMLElement, scale: number, below = false) => {
    const r0 = line.getBoundingClientRect();
    // a new row after the day's last one: the slot one row under it
    const r = below ? new DOMRect(r0.left, r0.top + r0.height, r0.width, r0.height) : r0;
    const src = row.current;
    const nm = src?.querySelector<HTMLElement>('.pl-name');
    const sr = src?.getBoundingClientRect();
    const k = src && sr && src.offsetWidth ? sr.width / src.offsetWidth : 1;
    const nr = nm?.getBoundingClientRect();
    const dx = nr && sr ? (nr.left - sr.left) / k : 16;
    const dy = nr && sr ? (nr.top + nr.height / 2 - sr.top) / k : r.height / 2;
    const pn = f.pill.querySelector<HTMLElement>('.drag-pill-name');
    const nameX = pn ? pn.offsetLeft : 0;
    const tx = r.left + dx - f.w / 2 - (nameX - f.w / 2) * scale;
    const ty = r.top + dy - f.h / 2;
    return { tf: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale})`, travel: Math.hypot(tx - f.x.get(), ty - f.y.get()) };
  };
  /**
   * Fly the pill onto `line` on springs.settle (WAAPI, transform only): `done` resolves on the rest frame, `ready` once the
   * flight runs on the compositor (so main-thread work after it cannot delay its start).
   */
  const fly = (f: Flight, line: HTMLElement | null, scale: number, below = false) => {
    f.off();
    // reduced motion: no travel; the pill fades where it is (§10.2)
    if (!line || reduced()) return { done: Promise.resolve(), ready: Promise.resolve() };
    const to = onto(f, line, scale, below);
    const a = f.pill.animate([{ transform: f.pill.style.transform }, { transform: to.tf }], { ...settleFor(to.travel), fill: 'forwards' });
    const ok = () => undefined;
    return { done: a.finished.then(ok, ok), ready: a.ready.then(ok, ok) };
  };
  const fadeOut = (f: Flight) => {
    const a = f.pill.animate([{ opacity: 1 }, { opacity: 0 }], { ...waapiOf(reduced() ? reducedFade : fadeIn), fill: 'forwards' });
    void a.finished.finally(() => f.pill.remove()).catch(() => undefined);
  };
  const end = (p: DragPoint, cancelled: boolean) => {
    const f = fl.current;
    if (!f) return;
    fl.current = null;
    cancelAnimationFrame(f.raf);
    f.over?.classList.remove('is-target');
    const src = row.current;
    const back = () => void fly(f, src ?? null, 1).done.then(() => fadeOut(f));
    if (cancelled) return back();
    // the release point is the last word: a final move can be coalesced away before the up
    const el = dayAt(p.x, p.y);
    const to = el?.getAttribute(PLAN_DAY) ?? null;
    if (!to || to === o.current.date) return back();
    const id = session.id;
    // the slot it goes into: the row it will occupy there (a swap leads the day; a move onto a day from the past joins what
    // is there, after it: feel review 2 E)
    const lines = el ? Array.from(el.querySelectorAll<HTMLElement>('.pl-lines > .pl-slot > .pl-line, .pl-lines > .pl-line')) : [];
    const idx = Math.max(0, o.current.slotFor?.(to) ?? 0);
    const below = lines.length > 0 && idx >= lines.length;
    const slotEl = lines[Math.min(idx, lines.length - 1)] ?? el;
    src?.classList.add('is-moving');
    // the row it left keeps its placeholder look until the data moves it (or, if the write never lands, for 1.5 s)
    setTimeout(() => src?.classList.remove('is-moving'), 1500);
    let land = () => undefined as void;
    const landed = new Promise<void>((r) => (land = r));
    // the write at the release: the rows reflow under the flight; an empty day's `Rest` / `+` fades out first (100 ms)
    const write = () => {
      landing = { id, at: performance.now() };
      if (!o.current.onDrop(to, landed)) {
        landing = null;
        for (const a of hush) a.cancel();
        return false;
      }
      return true;
    };
    // only an empty day's row goes (its `Rest` / `+`); a run off the plan, or a session that stays, keeps its row (code
    // review 2 #2): the fills are dropped once the new row is in
    const replaced = !below && slotEl?.classList.contains('is-rest') ? slotEl : null;
    const hush = replaced && !reduced() ? Array.from(replaced.children).map((c) => c.animate([{ opacity: getComputedStyle(c).opacity }, { opacity: 0 }], { ...waapiOf(fadeOutT), fill: 'forwards' })) : [];
    const flight = fly(f, slotEl ?? null, 0.9, below);
    // the flight (and the hush) start on the compositor first, and the write comes one `fadeOut` (100 ms) into the flight:
    // the pill's first frames leave the finger on an idle main thread, and the write's render cannot hold them back
    let wrote = true;
    void flight.ready.then(() => {
      if (hush.length) void hush[0]!.finished.then(() => (wrote = write()), () => undefined);
      else if (reduced()) wrote = write();
      else setTimeout(() => (wrote = write()), waapiOf(fadeOutT).duration);
    });
    void flight.done.then(() => {
      if (!wrote) return back();
      land();
      // the new row is under the pill (its content held back): they cross over once no row sliding past is over it
      const t0 = performance.now();
      const wait = () => {
        const there = document.querySelector<HTMLElement>(`[${PLAN_DAY}="${to}"] [data-session-id="${CSS.escape(id)}"]`);
        if ((!there || covered(there)) && performance.now() - t0 < 1000) return void requestAnimationFrame(wait);
        for (const a of hush) a.cancel();
        endLanding(id);
        fadeOut(f);
      };
      wait();
    });
  };

  return {
    onDragStart: (p: DragPoint) => start(p),
    onDragMove: (p: DragPoint) => move(p),
    onDragEnd: (p: DragPoint, _e: PointerEvent, cancelled: boolean) => end(p, cancelled),
  };
};
