import { animate, motionValue, type MotionValue } from 'motion/react';
import { forScale, LIFT_SCALE, springs } from '@/lib/motion';

type AnimationPlaybackControls = ReturnType<typeof animate>;

/**
 * The in-place lift (docs/feel.md §11.2, contracts §C.3–C.4): the REAL element scales to 1.03 on `springs.lift`; no clone,
 * no z-index. One handle per element, shared by whoever needs it (the hold that lifted it, the menu whose cut-out scrim
 * tracks it): `scale` is the motion value the menu's `.cm-hole` binds to, `rest` the element's rect at scale 1 (read at the
 * lift, before any lift scale). Reference counted: the element settles home when the last holder lets go.
 *
 * The scale is written to the element's individual `scale` property (it composes with any transform the element has, a
 * drag's translate included); `[data-lifting]` turns the element's CSS transitions off so the pre-grow's `transform:
 * scale(1.02)` hands over to `scale: 1.02` on the same frame.
 */
export interface LiftHandle {
  readonly el: HTMLElement;
  readonly scale: MotionValue<number>;
  /** The element's rect at scale 1, read when the lift began. */
  readonly rest: DOMRect;
  /** Its computed border-radius, for the hole. */
  readonly radius: string;
}
interface Entry extends LiftHandle {
  refs: number;
  anim: AnimationPlaybackControls | null;
  off: () => void;
}
const lifted = new Map<HTMLElement, Entry>();

/** The visual scale in a computed style: its transform's and its `scale`'s (1 when neither scales it). */
const scaleOf = (cs: CSSStyleDeclaration) => {
  let s = 1;
  const m = cs.transform;
  if (m && m !== 'none') {
    const v = m.startsWith('matrix3d(') ? m.slice(9, -1).split(',').map(Number) : m.slice(7, -1).split(',').map(Number);
    s = Math.hypot(v[0] ?? 1, v[1] ?? 0) || 1;
  }
  const sp = cs.scale;
  if (sp && sp !== 'none') s *= Number(sp.split(' ')[0]) || 1;
  return s;
};
/** The scale an inline transform (someone else's motion style) gives the element, without a style recalc. */
const inlineScale = (el: HTMLElement) => {
  const t = el.style.transform;
  if (!t || t === 'none') return 1;
  const m = /scale\(([-\d.]+)/.exec(t);
  return m ? Number(m[1]) || 1 : 1;
};

/**
 * Lift `el` in place (or take another reference to its lift). `reduce`: no scale (the hole still cuts it out).
 */
export const lift = (el: HTMLElement, { reduce = false }: { reduce?: boolean } = {}): LiftHandle => {
  const have = lifted.get(el);
  if (have) {
    have.refs++;
    return have;
  }
  // read before anything changes: the pre-grow may have it at 1.02 (rect and scale are taken around the centre); one style read
  const cs = getComputedStyle(el);
  const s0 = scaleOf(cs);
  const radius = cs.borderRadius;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const w = r.width / s0;
  const h = r.height / s0;
  const rest = new DOMRect(cx - w / 2, cy - h / 2, w, h);
  // the press and the pre-grow hand over on this frame ([data-lifting] turns the element's CSS transitions off)
  el.setAttribute('data-lifting', '');
  el.removeAttribute('data-pressed');
  el.removeAttribute('data-preholding');
  const sRest = inlineScale(el);
  let scale: MotionValue<number>;
  let anim: AnimationPlaybackControls | null = null;
  let off = () => undefined as void;
  if (Math.abs(sRest - 1) > 0.002) {
    // something else scales it inline already (an old drag lift): leave it alone; the hole takes its scale
    scale = motionValue(sRest);
  } else {
    scale = motionValue(reduce ? 1 : s0);
    el.style.scale = String(scale.get());
    off = scale.on('change', (v) => {
      el.style.scale = String(v);
    });
    if (!reduce) anim = animate(scale, LIFT_SCALE, forScale(springs.lift));
  }
  const e: Entry = { el, scale, rest, radius, refs: 1, anim, off };
  lifted.set(el, e);
  return e;
};

/** The lift `el` is in, if any (the menu reads it to bind its hole). */
export const liftOf = (el: HTMLElement | null | undefined): LiftHandle | null => (el ? (lifted.get(el) ?? null) : null);

/** Release one reference; the last one settles the element home on `springs.settle` and clears its attributes. */
export const drop = (el: HTMLElement, { instant = false }: { instant?: boolean } = {}) => {
  const e = lifted.get(el);
  if (!e) return;
  e.refs--;
  if (e.refs > 0) return;
  lifted.delete(el);
  e.anim?.stop();
  const done = () => {
    e.off();
    // a newer lift of the same element owns the attributes now
    if (lifted.has(el)) return;
    el.style.scale = '';
    el.removeAttribute('data-lifting');
    el.removeAttribute('data-dragging');
  };
  if (instant || e.scale.get() === 1) return done();
  e.anim = animate(e.scale, 1, forScale(springs.settle));
  void e.anim.then(done);
};
