import { NAV_EVENT } from './nav';

/*
 * The Orb's shared run loop and state switch (guide 2.1, "Rendering in the app"). Nothing is painted here any more: the Orb
 * is the brand SVG art (ui/Orb.tsx) and its breath and orbit are CSS keyframes on the compositor. This module only decides
 * which animated marks may run: an element is marked `data-run` while it is in view, actually drawn (a hidden tab or a page
 * under another is not), the page is shown and Reduce Motion is off. CSS runs the keyframes only under `[data-run]`, so an
 * idle screen has no running animation, no requestAnimationFrame and no timer: still Orbs (the dock's) never register, and
 * the one-second re-check exists only while an animated mark is mounted (plan 4.1, D11).
 */

type Runner = { el: HTMLElement; inView: boolean };
const runners = new Set<Runner>();
let timer: ReturnType<typeof setInterval> | 0 = 0;

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
/** Drawn at all: an element in a hidden tab (visibility: hidden) still intersects the viewport. */
const drawn = (el: HTMLElement) => {
  const e = el as HTMLElement & { checkVisibility?: (o?: { visibilityProperty?: boolean }) => boolean };
  return e.isConnected && (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true }) : true);
};
const apply = () => {
  const off = (typeof document !== 'undefined' && document.hidden) || reduced();
  for (const r of runners) {
    if (!off && r.inView && drawn(r.el)) r.el.setAttribute('data-run', '');
    else r.el.removeAttribute('data-run');
  }
};
const keepTimer = () => {
  if (runners.size && !timer) timer = setInterval(apply, 1000);
  else if (!runners.size && timer) {
    clearInterval(timer);
    timer = 0;
  }
};
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', apply);
  // a tab change or a push shows other marks: the shell hides the old tab in the task after its frame, so look a beat later
  window.addEventListener(NAV_EVENT, () => setTimeout(apply, 120));
  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply);
  } catch {
    /* an old engine: the one-second check catches it */
  }
}

/** Let an animated mark run while it is seen; returns the unregister. */
export const registerRunner = (el: HTMLElement): (() => void) => {
  const r: Runner = { el, inView: true };
  runners.add(r);
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => {
          r.inView = es.some((e) => e.isIntersecting);
          apply();
        })
      : null;
  io?.observe(el);
  apply();
  keepTimer();
  return () => {
    runners.delete(r);
    io?.disconnect();
    el.removeAttribute('data-run');
    keepTimer();
  };
};
