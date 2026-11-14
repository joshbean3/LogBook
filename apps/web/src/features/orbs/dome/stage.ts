import { haptics } from '@/lib/haptics';
import type { DomeBody } from './bodies';
import { addBody, advance, createWorld, drag, grab, nearest, pour, release, resting, setFloating, setGravity, settle, stir as stirWorld, unit, wake, type World } from './physics';
import { DROP, FELT, FLING, GLASS, GRAVITY, HOLD, REST, TILT, TIME } from './rules';
import { loadSprite, spriteKey, spriteNow, type Sprite } from './sprites';
import { askMotion, DOWN, follow, gravityFrom, turned, type Pull } from './tilt';

/**
 * The glass, alive: one canvas, the physics world behind it, the finger, the three keys and the phone's lean. Plain DOM,
 * no React: the component (Dome.tsx) hands it three elements and the spheres, and takes it down when it leaves.
 *
 * What it promises:
 *   - Everything from before today is at rest when it is first seen (the pile is settled off screen, a few milliseconds
 *     a frame so the page's own slide is not held up, and painted once it is still). Today's Orbs then drop in.
 *   - A frame only copies pictures (sprites.ts). When every sphere sleeps the frames stop: no timer, no battery. A
 *     touch, a key, a turn of the phone or a new Orb starts them again.
 *   - While the page is hidden, off screen, or under another page or a sheet (an `inert` ancestor), nothing runs.
 *   - With Reduce Motion there is no loop at all: the settled pile is drawn once, and a tap still names a sphere.
 *   - `destroy` takes down everything it put up.
 */
export interface StageParts {
  /** The touch surface: the canvas's box, clipped to the glass's shape. */
  glass: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The small label a tap shows, placed by the stage (it lies over the glass, unclipped). */
  caption: HTMLElement;
}
export interface StageOpts {
  reduce: boolean;
}
export type TiltAnswer = 'on' | 'off' | 'failed';
export interface Stage {
  /** The spheres, as `domeBodies` gives them. New ones drop in; ones that are gone leave; the rest stay where they lie. */
  setBodies: (bodies: readonly DomeBody[]) => void;
  stir: () => void;
  setFloat: (on: boolean) => void;
  /** Call from the tap itself: turning it on may ask for motion access. `failed`: refused, missing, or no reading came. */
  setTilt: (on: boolean) => Promise<TiltAnswer>;
  destroy: () => void;
  /** For tests and measurements: is a frame scheduled, and how many spheres are in the glass. */
  running: () => boolean;
  count: () => number;
}

/** A settled pile, remembered for as long as the page lives: the same spheres in the same glass settle the same way. */
const layouts = new Map<string, { x: Float64Array; y: Float64Array }>();
const signature = (bodies: readonly DomeBody[], h: number): string => `${Math.round(h)}|${bodies.map((b) => `${b.id}:${b.r}`).join(',')}`;

interface Held {
  pointer: number;
  id: string;
  /** From the finger to the sphere's center, in units: it stays where it was taken. */
  ox: number;
  oy: number;
  /** Where the touch began, in px, and when. */
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
  samples: Array<[t: number, x: number, y: number]>;
}

export const createStage = ({ glass, canvas, caption }: StageParts, { reduce }: StageOpts): Stage => {
  const ctx = canvas.getContext('2d');
  let W: World | null = null;
  /** What each sphere of the world is, by its index. */
  let list: DomeBody[] = [];
  let sprites: Array<Sprite | null | undefined> = [];
  /** Everything the glass should hold, as last given. */
  let all: readonly DomeBody[] = [];
  /** Waiting to drop in. */
  let queue: DomeBody[] = [];
  let scale = 1;
  let k = 1;
  let wide = 0;
  let tall = 0;
  let ready = false;
  let building = 0;
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let nextDrop = 0;
  let felt = 0;
  let lastFelt = 0;
  let held: Held | null = null;
  let said: string | null = null;
  let saidTimer: ReturnType<typeof setTimeout> | undefined;
  let tiltOn = false;
  let tiltWait: ReturnType<typeof setTimeout> | undefined;
  let heard = false;
  let pull: Pull = DOWN;
  let target: Pull = DOWN;
  let wokeAt: Pull = DOWN;
  let floating = false;
  let inView = true;
  let plain = '';

  // ---------- the page: is the glass to be seen at all? ----------
  const shown = (): boolean => !document.hidden && inView && !glass.closest('[inert]');

  // ---------- size ----------
  const measure = (): boolean => {
    const w = glass.clientWidth;
    const h = glass.clientHeight;
    if (w < 8 || h < 8) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, GLASS.dprCap);
    wide = w;
    tall = h;
    scale = w / GLASS.w;
    k = scale * dpr;
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    return true;
  };
  const px = (b: DomeBody): number => Math.max(2, Math.round(b.r * 2 * k));

  // ---------- drawing: copy each sphere's picture to where it is ----------
  const draw = (still: boolean): void => {
    if (!ctx || !W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < W.n; i++) {
      const s = sprites[i];
      const cx = W.x[i]! * k;
      const cy = W.y[i]! * k;
      if (s) {
        let x = cx - s.side / 2;
        let y = cy - s.side / 2;
        if (still) {
          // at rest, on whole pixels: the art is as sharp as it was drawn
          x = Math.round(x);
          y = Math.round(y);
        }
        ctx.drawImage(s.img, x, y);
      } else if (s === null) {
        // the art could not be cut: a plain disc, so the sphere is still there to take
        plain ||= getComputedStyle(glass).getPropertyValue('--pencil').trim();
        ctx.fillStyle = plain;
        ctx.beginPath();
        ctx.arc(cx, cy, W.r[i]! * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  /** The picture for a sphere: at once when it is cut already; otherwise it is cut, and drawn when it is. Null: its art cannot be drawn. */
  const failed = new Set<string>();
  const look = (b: DomeBody): Sprite | null | undefined => {
    const size = px(b);
    const have = spriteNow(b.gem, size);
    if (have) return have;
    const key = spriteKey(b.gem, size);
    if (failed.has(key)) return null;
    void loadSprite(b.gem, size).then((sp) => {
      if (destroyed) return;
      if (!sp) failed.add(key);
      const at = list.indexOf(b);
      if (at < 0) return;
      sprites[at] = sp;
      if (ready && !raf) draw(true);
    });
    return undefined;
  };
  const dress = (): void => {
    sprites = list.map(look);
  };

  // ---------- the caption ----------
  const place = (): void => {
    if (!said || !W) return;
    const i = list.findIndex((b) => b.id === said);
    if (i < 0) return hush();
    const w = caption.offsetWidth;
    const h = caption.offsetHeight;
    const cx = W.x[i]! * scale;
    const r = W.r[i]! * scale;
    const cy = W.y[i]! * scale;
    const x = Math.max(4, Math.min(wide - w - 4, cx - w / 2));
    // over the sphere; under it when there is no room over it
    const over = cy - r - 8 - h;
    const y = over >= 4 ? over : Math.min(tall - h - 4, cy + r + 8);
    caption.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  };
  const hush = (): void => {
    said = null;
    clearTimeout(saidTimer);
    caption.removeAttribute('data-on');
  };
  const say = (b: DomeBody): void => {
    clearTimeout(saidTimer);
    said = b.id;
    caption.textContent = b.caption;
    caption.setAttribute('data-on', '');
    place();
    saidTimer = setTimeout(hush, HOLD.captionMs);
  };

  // ---------- what is felt ----------
  const feel = (now: number): void => {
    if (!W) return;
    if (W.landed) {
      // one of today's Orbs touched down
      if (felt++ < FELT.orbs) haptics.orb();
      else haptics.tick();
      lastFelt = now;
      return;
    }
    if (now - lastFelt < FELT.gapMs) return;
    if (W.glass > FELT.glass) {
      haptics.select();
      lastFelt = now;
    } else if (W.clack > FELT.clack) {
      haptics.tick();
      lastFelt = now;
    }
  };

  // ---------- the loop ----------
  const drop = (now: number): void => {
    if (!W) return;
    const b = queue[0]!;
    const u = unit(W.n + 31);
    addBody(W, W.R + (u * 2 - 1) * DROP.spread, b.r + 6, b.r, { fresh: b.fresh, vx: (u - 0.5) * 60, vy: 140 });
    queue.shift();
    list.push(b);
    sprites.push(look(b));
    nextDrop = now + DROP.everyMs;
  };
  const frame = (now: number): void => {
    raf = 0;
    if (destroyed || !W || !ready) return;
    if (!shown()) {
      last = 0;
      return;
    }
    const dt = last ? (now - last) / 1000 : TIME.step * 8;
    last = now;
    if (tiltOn) {
      pull = follow(pull, target, dt);
      setGravity(W, pull.x, pull.y);
      if (turned(wokeAt, pull)) {
        wake(W);
        wokeAt = pull;
      }
    }
    if (queue.length && now >= nextDrop) drop(now);
    advance(W, dt);
    feel(now);
    const still = resting(W) && !queue.length && !(tiltOn && turned(pull, target));
    draw(still);
    place();
    if (still) {
      last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const kick = (): void => {
    if (raf || destroyed || reduce || !ready || !W || !shown()) return;
    if (resting(W) && !queue.length && !(tiltOn && turned(wokeAt, target))) return;
    raf = requestAnimationFrame(frame);
  };

  // ---------- building the pile ----------
  const build = (): void => {
    const token = ++building;
    ready = false;
    held = null;
    hush();
    cancelAnimationFrame(raf);
    raf = 0;
    if (!measure()) return;
    const world = createWorld(GLASS.w, tall / scale, all.length + 16);
    W = world;
    // with Reduce Motion nothing drops: today's Orbs lie in the pile with the rest
    const lying = reduce ? [...all] : all.filter((b) => !b.fresh);
    queue = reduce ? [] : all.filter((b) => b.fresh);
    list = lying;
    pour(world, lying.map((b) => b.r));
    const sig = signature(lying, world.h);
    const hit = layouts.get(sig);
    if (hit && hit.x.length === world.n) {
      world.x.set(hit.x);
      world.y.set(hit.y);
      for (let i = 0; i < world.n; i++) world.asleep[i] = 1;
    }
    if (floating) setFloating(world, true);
    setGravity(world, pull.x, pull.y);
    let simmed = 0;
    let cut = false;
    const done = (): void => {
      if (token !== building || destroyed || !cut) return;
      if (!resting(world) && simmed < REST.settle && !floating) return;
      if (!hit) {
        if (layouts.size > 6) layouts.clear();
        layouts.set(sig, { x: world.x.slice(0, world.n), y: world.y.slice(0, world.n) });
      }
      ready = true;
      felt = 0;
      draw(true);
      glass.setAttribute('data-ready', '');
      nextDrop = performance.now() + DROP.afterMs;
      kick();
    };
    // the pictures and the settling go on side by side; the first paint waits for both
    void Promise.all(all.map((b) => loadSprite(b.gem, px(b)).then((sp) => void (sp || failed.add(spriteKey(b.gem, px(b))))))).then(() => {
      if (token !== building || destroyed) return;
      dress();
      cut = true;
      done();
    });
    const slice = (): void => {
      if (token !== building || destroyed) return;
      const t0 = performance.now();
      // a few milliseconds a frame: the page's own slide keeps its frames
      while (!resting(world) && simmed < REST.settle && !floating && performance.now() - t0 < 5) simmed += settle(world, 0.04);
      if (resting(world) || simmed >= REST.settle || floating) done();
      else requestAnimationFrame(slice);
    };
    slice();
  };
  const setBodies = (next: readonly DomeBody[]): void => {
    if (destroyed) return;
    if (next === all && W) return;
    const first = !W;
    all = next;
    if (first || !ready || !W || reduce) {
      build();
      return;
    }
    // the store changed while the glass is open: keep every sphere that is still there where it lies
    const world = W;
    const at = new Map(list.map((b, i) => [b.id, i]));
    const ids = new Set(next.map((b) => b.id));
    let changed = false;
    if (list.some((b) => !ids.has(b.id))) {
      if (held) {
        release(world);
        held = null;
      }
      const fresh = createWorld(world.w, world.h, next.length + 16);
      const kept: DomeBody[] = [];
      for (const b of next) {
        const i = at.get(b.id);
        if (i === undefined) continue;
        addBody(fresh, world.x[i]!, world.y[i]!, b.r, { vx: world.vx[i]!, vy: world.vy[i]!, seed: world.seed[i]! });
        kept.push(b);
      }
      fresh.gx = world.gx;
      fresh.gy = world.gy;
      fresh.floating = world.floating;
      fresh.t = world.t;
      W = fresh;
      list = kept;
      changed = true;
    } else {
      for (const b of next) {
        const i = at.get(b.id);
        if (i === undefined) continue;
        if (world.r[i] !== b.r) {
          world.r[i] = b.r;
          world.im[i] = 1 / (b.r * b.r);
          changed = true;
        }
        list[i] = b;
      }
      if (changed) wake(world);
    }
    queue = next.filter((b) => !at.has(b.id));
    // Orbs earned while the glass is open are felt as the first ones were
    if (queue.length) felt = 0;
    dress();
    if (said && !ids.has(said)) hush();
    nextDrop = Math.max(nextDrop, performance.now());
    kick();
    if (!raf) draw(true);
  };

  // ---------- the finger ----------
  const point = (e: PointerEvent | MouseEvent): [number, number] => {
    const box = glass.getBoundingClientRect();
    return [(e.clientX - box.left) / scale, (e.clientY - box.top) / scale];
  };
  const down = (e: PointerEvent): void => {
    if (reduce || !W || !ready || held || e.button > 0 || !e.isPrimary) return;
    const [x, y] = point(e);
    const i = nearest(W, x, y, HOLD.slop / scale);
    if (i < 0) return;
    e.preventDefault();
    held = { pointer: e.pointerId, id: list[i]!.id, ox: W.x[i]! - x, oy: W.y[i]! - y, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, moved: false, samples: [[e.timeStamp, x, y]] };
    grab(W, i, W.x[i]!, W.y[i]!);
    try {
      glass.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    kick();
  };
  const move = (e: PointerEvent): void => {
    if (!held || !W || e.pointerId !== held.pointer) return;
    const [x, y] = point(e);
    drag(W, x + held.ox, y + held.oy);
    held.samples.push([e.timeStamp, x, y]);
    if (held.samples.length > 8) held.samples.shift();
    if (!held.moved && Math.hypot(e.clientX - held.x0, e.clientY - held.y0) > HOLD.tapPx) {
      held.moved = true;
      hush();
      haptics.lift();
    }
    kick();
  };
  const up = (e: PointerEvent): void => {
    if (!held || !W || e.pointerId !== held.pointer) return;
    const h = held;
    held = null;
    try {
      glass.releasePointerCapture(e.pointerId);
    } catch {
      /* it was never captured */
    }
    const tap = e.type === 'pointerup' && !h.moved && e.timeStamp - h.t0 < HOLD.tapMs;
    if (tap) {
      release(W);
      const b = list.find((it) => it.id === h.id);
      if (b) say(b);
    } else {
      // the finger's speed over its last moments, in units a second
      const lastS = h.samples[h.samples.length - 1]!;
      const from = h.samples.find((s) => lastS[0] - s[0] <= FLING.windowMs) ?? lastS;
      const span = (lastS[0] - from[0]) / 1000;
      // a finger that stopped before it lifted lets the sphere fall where it is
      const stale = e.timeStamp - lastS[0] > FLING.windowMs;
      if (e.type === 'pointerup' && span > 0.008 && !stale) release(W, (lastS[1] - from[1]) / span, (lastS[2] - from[2]) / span);
      else release(W);
    }
    kick();
  };
  /** With Reduce Motion nothing is dragged, and the page scrolls over the glass: a tap is a click. */
  const click = (e: MouseEvent): void => {
    if (!reduce || !W || !ready) return;
    const [x, y] = point(e);
    const i = nearest(W, x, y, HOLD.slop / scale);
    if (i >= 0) say(list[i]!);
    else hush();
  };
  glass.addEventListener('pointerdown', down);
  glass.addEventListener('pointermove', move);
  glass.addEventListener('pointerup', up);
  glass.addEventListener('pointercancel', up);
  glass.addEventListener('click', click);

  // ---------- the keys ----------
  const stir = (): void => {
    if (!W || !ready || reduce) return;
    stirWorld(W);
    kick();
  };
  const setFloat = (on: boolean): void => {
    floating = on;
    if (!W || reduce) return;
    setFloating(W, on);
    kick();
  };
  const angle = (): number => {
    try {
      const a = window.screen?.orientation?.angle;
      if (typeof a === 'number') return a;
      const old = (window as Window & { orientation?: number }).orientation;
      return typeof old === 'number' ? old : 0;
    } catch {
      return 0;
    }
  };
  const lean = (e: DeviceOrientationEvent): void => {
    if (typeof e.beta !== 'number' || typeof e.gamma !== 'number') return;
    heard = true;
    target = gravityFrom(e.beta, e.gamma, angle());
    if (tiltOn) kick();
  };
  const level = (): void => {
    window.removeEventListener('deviceorientation', lean);
    clearTimeout(tiltWait);
    tiltOn = false;
    pull = target = wokeAt = DOWN;
    if (W) {
      setGravity(W, 0, 1);
      wake(W);
    }
    kick();
  };
  const setTilt = async (on: boolean): Promise<TiltAnswer> => {
    if (!on || reduce || destroyed) {
      level();
      return 'off';
    }
    const answer = await askMotion();
    if (destroyed) return 'off';
    if (answer !== 'granted') return 'failed';
    heard = false;
    window.addEventListener('deviceorientation', lean);
    const began = performance.now();
    const came = await new Promise<boolean>((resolve) => {
      const look = (): void => {
        if (heard) resolve(true);
        else if (destroyed || performance.now() - began > TILT.waitMs) resolve(false);
        else tiltWait = setTimeout(look, 50);
      };
      look();
    });
    if (destroyed) return 'off';
    if (!came) {
      level();
      return 'failed';
    }
    tiltOn = true;
    pull = W ? { x: W.gx / GRAVITY, y: W.gy / GRAVITY } : DOWN;
    wokeAt = pull;
    if (W) wake(W);
    kick();
    return 'on';
  };

  // ---------- pausing and coming back ----------
  const again = (): void => kick();
  document.addEventListener('visibilitychange', again);
  const io =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((es) => {
          inView = es.some((en) => en.isIntersecting);
          kick();
        });
  io?.observe(glass);
  // a page pushed over this one, or a sheet, makes an ancestor inert; when it lets go the glass picks up where it was
  const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(again);
  mo?.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['inert'] });
  const ro =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (destroyed) return;
          const w = glass.clientWidth;
          const h = glass.clientHeight;
          if (Math.abs(w - wide) < 1 && Math.abs(h - tall) < 1) return;
          if (all.length || W) build();
        });
  ro?.observe(glass);

  return {
    setBodies,
    stir,
    setFloat,
    setTilt,
    running: () => raf !== 0,
    count: () => W?.n ?? 0,
    destroy: () => {
      destroyed = true;
      building++;
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(saidTimer);
      clearTimeout(tiltWait);
      window.removeEventListener('deviceorientation', lean);
      document.removeEventListener('visibilitychange', again);
      glass.removeEventListener('pointerdown', down);
      glass.removeEventListener('pointermove', move);
      glass.removeEventListener('pointerup', up);
      glass.removeEventListener('pointercancel', up);
      glass.removeEventListener('click', click);
      io?.disconnect();
      mo?.disconnect();
      ro?.disconnect();
      W = null;
      list = [];
      sprites = [];
      queue = [];
    },
  };
};
