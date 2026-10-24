import type { Transition } from 'motion/react';
import { springs } from '@/lib/motion';
import { springAdvance, springParams } from '@/ui/springSim';

/**
 * The FLIP rule (docs/feel.md §10.1) on the compositor: a row whose slot moved is drawn where it was and springs home on
 * `springs.settle` by `transform` alone. The spring is sampled (WP1's integrator, the physics motion runs) into a WAAPI
 * animation, so it keeps running while the main thread is busy: a Skip's or a drop's write re-renders every page that reads
 * the month, Today's under this one included, and a main-thread spring would freeze through that and jump.
 */
const running = new WeakMap<HTMLElement, Animation>();
const FRAME = 1 / 120;

/** The element's drawn translateY right now: its running FLIP's, or its inline transform's. */
export const drawnY = (el: HTMLElement): number => {
  const a = running.get(el);
  if (a && a.playState === 'running') {
    const m = getComputedStyle(el).transform;
    if (m && m !== 'none') {
      const v = m.startsWith('matrix3d(') ? m.slice(9, -1).split(',') : m.slice(7, -1).split(',');
      return Number(v[m.startsWith('matrix3d(') ? 13 : 5]) || 0;
    }
    return 0;
  }
  return Number(/translateY\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1] ?? 0);
};

/** Stop the element's FLIP where it is drawn (its inline transform then holds that place). */
export const stopFlip = (el: HTMLElement): number => {
  const y = drawnY(el);
  running.get(el)?.cancel();
  running.delete(el);
  el.style.transform = Math.abs(y) < 0.01 ? '' : `translateY(${y.toFixed(2)}px)`;
  return y;
};

/** Spring the element from `from` px (translateY) to its slot; `done` on the frame it rests. */
export const flipY = (el: HTMLElement, from: number, done?: () => void, t: Transition = springs.settle): void => {
  running.get(el)?.cancel();
  el.style.transform = '';
  if (Math.abs(from) < 0.5) {
    running.delete(el);
    done?.();
    return;
  }
  const p = springParams(t);
  const ys = [from];
  let pos = from;
  let vel = 0;
  for (let i = 0; i < 240; i++) {
    [pos, vel] = springAdvance(p, pos, vel, 0, FRAME);
    ys.push(pos);
    if (Math.abs(pos) <= p.rd && Math.abs(vel) <= p.rs) break;
  }
  ys[ys.length - 1] = 0;
  const frames = ys.map((y, i) => ({ transform: `translateY(${y.toFixed(2)}px)`, offset: i / (ys.length - 1) }));
  const a = el.animate(frames, { duration: (ys.length - 1) * FRAME * 1000, easing: 'linear' });
  running.set(el, a);
  a.onfinish = () => {
    if (running.get(el) === a) running.delete(el);
    done?.();
  };
};
