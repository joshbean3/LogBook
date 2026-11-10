import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A tiny film engine for the tour's demos: a loop of beats (ms each), a finger that travels and presses, and text that
 * types itself. Every demo is real Logbook UI in miniature, played like a short video: it runs only while its page is the
 * one on screen, and under Reduce Motion it holds still on its finished frame with the captions carrying the steps.
 */

/** The beat index, looping over `beats`; `rest` (the finished frame) when paused or under Reduce Motion. */
export const useLoop = (beats: readonly number[], running: boolean, rest: number): number => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!running) return;
    setI(0);
    let k = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        k = (k + 1) % beats.length;
        setI(k);
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
 * The finger: a soft disc that glides to the element marked `data-spot={spot}` inside its stage (measured on every change,
 * so it finds rows that have moved) and presses (`down`) or holds (`hold`). `carry` rides under it: a run being dragged.
 */
export const Finger = ({ spot, down = false, hold = false, carry }: { spot: string | null; down?: boolean; hold?: boolean; carry?: React.ReactNode }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const stage = el?.closest('.tstage');
    const t = spot && stage ? stage.querySelector(`[data-spot="${spot}"]`) : null;
    // set only on a real change: this runs after every render, so an unconditional set would loop
    if (!t || !stage) return setAt((cur) => (cur ? null : cur));
    const s = stage.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const x = Math.round(r.left - s.left + r.width / 2);
    const y = Math.round(r.top - s.top + r.height / 2);
    setAt((cur) => (cur && cur[0] === x && cur[1] === y ? cur : [x, y]));
  });
  return (
    <span ref={ref} className={`tf ${at ? '' : 'tis-off'} ${down ? 'tis-down' : ''} ${hold ? 'tis-hold' : ''}`} style={at ? { left: at[0], top: at[1] } : undefined} aria-hidden="true">
      {carry ? <span className="tf-carry">{carry}</span> : null}
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
        {t}
      </li>
    ))}
  </ol>
);

/** A demo's stage: a miniature screen card the finger plays over. */
export const Stage = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`tstage ${className}`} aria-hidden="true">
    {children}
  </div>
);
