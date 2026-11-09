import { useEffect, useRef, useState } from 'react';

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

/** The finger: a soft disc that glides to (x, y) in the stage (percent) and presses (`down`). Hidden when `x` is null. */
export const Finger = ({ at, down = false, hold = false }: { at: [number, number] | null; down?: boolean; hold?: boolean }) => (
  <span
    className={`tf ${at ? '' : 'is-off'} ${down ? 'is-down' : ''} ${hold ? 'is-hold' : ''}`}
    style={at ? { left: `${at[0]}%`, top: `${at[1]}%` } : undefined}
    aria-hidden="true"
  >
    <i />
  </span>
);

/** A demo's stage: a miniature screen card the finger plays over. */
export const Stage = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`tstage ${className}`} aria-hidden="true">
    {children}
  </div>
);
