import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A tiny film engine for the tour's demos: a loop of beats (ms each), a finger that travels and presses, text that types
 * itself, and a stage that shows a tall page through a window and scrolls it. Every demo is the real page drawn with its
 * own parts at their own sizes, played like a short video: it runs only while its page is the one on screen, and under
 * Reduce Motion it holds still on its finished frame with the captions carrying the steps.
 */

/** How many times a demo plays before it rests on its finished frame (a11y-16: nothing loops for ever). */
export const LOOPS = 2;
/**
 * The beat index over `beats`, played `LOOPS` times and then resting on the last beat (the finished frame); `rest` when
 * paused or under Reduce Motion.
 */
export const useLoop = (beats: readonly number[], running: boolean, rest: number): number => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!running) return;
    setI(0);
    let k = 0;
    let played = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        k = (k + 1) % beats.length;
        if (k === 0) played += 1;
        setI(k);
        // the last beat of the last loop is the finished frame: stay on it
        if (played >= LOOPS - 1 && k === beats.length - 1) return;
        tick();
      }, beats[k]);
    };
    tick();
    return () => clearTimeout(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  return running ? i : rest;
};

/** Types `text` a character at a time while `on`; the whole text when `full`; nothing otherwise. */
export const useTyped = (text: string, on: boolean, full: boolean, cps = 22): string => {
  const [n, setN] = useState(full ? text.length : 0);
  const ref = useRef(0);
  useEffect(() => {
    if (full) return setN(text.length);
    if (!on) return setN(0);
    ref.current = 0;
    setN(0);
    const id = setInterval(() => {
      ref.current += 1;
      setN(ref.current);
      if (ref.current >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [on, full, text, cps]);
  return text.slice(0, n);
};

/**
 * The finger: a soft disc that glides to the element marked `data-spot={spot}` inside its stage (measured on every change
 * and again when the stage has finished a scroll, so it finds rows that have moved) and presses (`down`) or holds (`hold`).
 */
export const Finger = ({ spot, down = false, hold = false }: { spot: string | null; down?: boolean; hold?: boolean }) => {
  const ref = useRef<HTMLSpanElement>(null);
  // where it is, and whether it shows: hidden, it keeps its place, so it comes back from where it left
  const [at, setAt] = useState<[number, number] | null>(null);
  const [on, setOn] = useState(false);
  const [, again] = useState(0);
  // the stage scrolled, or something in it finished moving: look again
  useEffect(() => {
    const stage = ref.current?.closest('.tstage');
    if (!stage) return;
    const look = () => again((n) => n + 1);
    stage.addEventListener('transitionend', look);
    return () => stage.removeEventListener('transitionend', look);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    const stage = el?.closest('.tstage');
    const box = el?.offsetParent;
    // a spot is a `data-spot` name, or (for a part of the app drawn as it is, which carries no such name) a class selector
    const t = spot && stage ? stage.querySelector(spot.startsWith('.') ? spot : `[data-spot="${spot}"]`) : null;
    // set only on a real change: this runs after every render, so an unconditional set would loop
    if (!t || !box) return setOn((cur) => (cur ? false : cur));
    const s = box.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const x = Math.round(r.left - s.left + r.width / 2);
    const y = Math.round(r.top - s.top + r.height / 2);
    setAt((cur) => (cur && cur[0] === x && cur[1] === y ? cur : [x, y]));
    setOn((cur) => (cur ? cur : true));
  });
  return (
    <span ref={ref} className={`tf ${on && at ? '' : 'tis-off'} ${down ? 'tis-down' : ''} ${hold ? 'tis-hold' : ''}`} style={at ? { transform: `translate(${at[0]}px, ${at[1]}px)` } : undefined} aria-hidden="true">
      <i />
    </span>
  );
};

/** The steps under a demo, lit in turn as the demo plays them (all lit when it holds still). */
export const Steps = ({ items, on }: { items: readonly string[]; on: number }) => (
  <ol className="tour-steps">
    {items.map((t, i) => (
      <li key={t} className={on < 0 || i === on ? 'tis-on' : ''}>
        <b>{i + 1}</b>
        <span>{t}</span>
      </li>
    ))}
  </ol>
);

/** Where an element sits inside `root`, by layout alone: a transform on the way (the stage's own scroll, a row settling) does not move it. */
const topIn = (el: HTMLElement, root: HTMLElement): number => {
  let t = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    t += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return t;
};

/**
 * How far a page is scrolled so that a part of it shows: the scroll that brings the part (from `top` to `bottom` in the
 * page) wholly into a window `view` tall, moving as little as possible from `y`, never past the page's ends. A part
 * taller than the window shows from its top.
 */
export const scrollFor = (y: number, top: number, bottom: number, view: number, page: number, air = 8): number => {
  const max = Math.max(0, page - view);
  let next = y;
  if (bottom + air > next + view) next = bottom + air - view;
  if (top - air < next) next = top - air;
  return Math.min(max, Math.max(0, Math.round(next)));
};

/**
 * A demo's stage: a window onto the page being shown. The page (`children`) is as tall as it needs; the window is as tall
 * as the screen has room for, and `show` names the part (`data-spot`) that must be in it: the page scrolls there, as a
 * thumb would scroll it ('top': the start of the page). `over` is what does not scroll with the page: the finger, a sheet,
 * a toast. `still` (Reduce Motion): no window at all, the whole page is drawn and nothing scrolls.
 */
export const Stage = ({ children, over, className = '', show = 'top', still = false }: { children: React.ReactNode; over?: React.ReactNode; className?: string; show?: string; still?: boolean }) => {
  const win = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);
  const [more, setMore] = useState(false);
  // the window keeps the tallest height it has had, so the steps under it stay put when the page inside gets shorter
  const [held, setHeld] = useState(0);
  useLayoutEffect(() => {
    const w = win.current;
    const p = page.current;
    if (!w || !p) return;
    if (still) {
      if (y) setY(0);
      if (more) setMore(false);
      return;
    }
    const view = w.clientHeight;
    const tall = p.offsetHeight;
    if (view > held) setHeld(view);
    const el = show === 'top' ? null : p.querySelector<HTMLElement>(`[data-spot="${show}"]`);
    const top = el ? topIn(el, p) : 0;
    const next = show === 'top' ? 0 : el ? scrollFor(y, top, top + el.offsetHeight, view, tall) : Math.min(y, Math.max(0, tall - view));
    if (next !== y) setY(next);
    const under = tall - view - next > 4;
    if (under !== more) setMore(under);
  });
  return (
    <div className={`tstage ${className}${still ? ' tis-still' : ''}`} aria-hidden="true" inert>
      <div ref={win} className={`tstage-win${y > 0 ? ' tis-cut-top' : ''}${more ? ' tis-cut-end' : ''}`} style={!still && held ? { minHeight: held } : undefined}>
        <div ref={page} className="tstage-page" style={{ transform: `translateY(${-y}px)` }}>
          {children}
        </div>
      </div>
      <div className="tstage-over">{over}</div>
    </div>
  );
};
