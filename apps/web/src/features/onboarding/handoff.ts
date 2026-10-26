/**
 * The first-run hand-off (§8, §0.2 "First launch", contracts §A.5): `Open Today` is a state change under the mounting shell,
 * not a route cut with a leave animation. On the tap:
 *
 * 1. a still copy of the payoff screen (`.ob`, deep-cloned, the halo included) is laid over everything as a plain DOM layer,
 *    so it outlives Welcome's unmount; the copy's hero sits on exactly the same rect as the hero it copies;
 * 2. the framed app mounts under it at once (`cut()`: react-router's `/today`), so Today's first frame is built while the
 *    copy is still on screen;
 * 3. inside the copy the week rows fall away (translateY 40 + fade, 200 ms) and the headline, foot and halo fade with them;
 * 4. once Today has painted its hero, the copy fades out (200 ms): the bar, the strip and the tab bar fade in around a hero
 *    that does not move (Today's hero slot is at the payoff hero's y: 157 + safe-t at 390 × 844).
 *
 * Only `opacity` and `transform` animate (WAAPI). Reduced motion: no translate, 150 ms fades. The layer never takes a tap
 * and is removed after 2.5 s whatever happens.
 */
const FADE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface HandOff {
  /** The payoff screen (`.ob`). */
  screen: HTMLElement;
  /** Selectors, inside the screen, of what falls away (translateY 40 + fade) and of what only fades. */
  falls: string;
  fades: string;
  reduce: boolean;
  /** Mount the framed app (navigate to /today). */
  cut: () => void;
  /** Today's hero is painted (default: a `.hero` or `.aura` in Today's scroller that is not a skeleton). */
  ready?: () => boolean;
  /** After the layer is gone (e.g. open a sheet the tap asked for). */
  after?: () => void;
}

const todayPainted = () => {
  const el = document.querySelector<HTMLElement>('.tab[data-tab="today"] .tab-scroll :is(.hero, .aura):not(.hero-skel):not([aria-busy="true"])');
  return !!el && el.getBoundingClientRect().height > 0;
};

export const handOff = ({ screen, falls, fades, reduce, cut, ready = todayPainted, after }: HandOff): void => {
  const D = reduce ? 150 : 200;
  const layer = document.createElement('div');
  layer.className = 'ob-handoff';
  layer.setAttribute('aria-hidden', 'true');
  const copy = screen.cloneNode(true) as HTMLElement;
  layer.appendChild(copy);
  document.body.appendChild(layer);
  copy.scrollTop = screen.scrollTop;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    layer.remove();
    after?.();
  };
  const safety = window.setTimeout(finish, 2500);
  // 3. the rows fall and the words fade, inside the copy (the live screen is about to unmount under it)
  const fall: Keyframe[] = reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px)' }];
  for (const el of copy.querySelectorAll<HTMLElement>(falls)) el.animate(fall, { duration: D, easing: FADE, fill: 'forwards' });
  for (const el of copy.querySelectorAll<HTMLElement>(fades)) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, easing: FADE, fill: 'forwards' });
  const fallen = performance.now() + D;
  // 2. the framed app mounts under the copy now, so its first frame is ready by the time the rows have gone
  cut();
  // 4. Today painted and the rows gone: the copy fades, and Today's chrome fades in around the hero
  const wait = () => {
    if (done) return;
    if ((!ready() || performance.now() < fallen) && performance.now() < fallen + 1500) {
      requestAnimationFrame(wait);
      return;
    }
    const a = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, easing: FADE, fill: 'forwards' });
    a.onfinish = () => {
      window.clearTimeout(safety);
      finish();
    };
  };
  requestAnimationFrame(wait);
};
