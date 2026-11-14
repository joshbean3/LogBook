import { AIR, BOUNCE, FLING, FLOAT, FRICTION, GRAVITY, HOLD, MAX_SPEED, REST, STIR, TIME } from './rules';

/**
 * The dome's physics, with no DOM in it: circles with weight inside a glass that has a floor, two straight walls and a
 * half-circle top. Pure arithmetic on typed arrays, so the same calls give the same pile on every phone.
 *
 * How it works. Time moves in small fixed steps (`TIME.step`, eight to a frame). Each step: every waking sphere takes
 * gravity and moves; every overlapping pair is pushed apart by weight, then every sphere is put back inside the glass
 * (the glass is a rule about where a center may be, so no speed can pass through it); speeds are read back from where
 * the spheres ended up; then each contact gets its bounce and its friction, and whatever speed the pushing apart added
 * is taken out again, which is what keeps a squeezed pile from bursting. A sphere that has been slow among slow
 * neighbors for a moment goes to sleep (it stops being moved at all, so a resting pile cannot shiver), and wakes when
 * something closes on it. When every sphere sleeps the world is at rest and the caller can stop its frames.
 *
 * Pairs are found by sorting the spheres by their left edge and sweeping (the order barely changes from one step to
 * the next, so the sort is nearly free): 200 spheres step in well under a millisecond.
 */
export interface World {
  /** The glass: `w` wide, `h` tall, its top a half circle of radius `R` centered at (`R`, `R`). The floor is at y = `h`. */
  readonly w: number;
  readonly h: number;
  readonly R: number;
  /** How many spheres. The arrays below are at least this long. */
  n: number;
  x: Float64Array;
  y: Float64Array;
  /** Where each was before the step. */
  px: Float64Array;
  py: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  r: Float64Array;
  /** One over the weight (a sphere weighs its radius squared). */
  im: Float64Array;
  /** How long each has stayed within a small circle about (`ax`, `ay`), in seconds. */
  still: Float64Array;
  ax: Float64Array;
  ay: Float64Array;
  moved: Uint8Array;
  asleep: Uint8Array;
  /** 1 while a sphere dropped in has touched nothing yet. */
  fresh: Uint8Array;
  /** Each sphere's own number from 0 to 1: its share of a stir, its height while floating. */
  seed: Float64Array;
  order: Int32Array;
  /** Gravity, in units per second squared. */
  gx: number;
  gy: number;
  floating: boolean;
  /** Simulated time, in seconds. */
  t: number;
  /** The held sphere, or -1, and where the finger wants it. */
  held: number;
  hx: number;
  hy: number;
  acc: number;
  /** What the last `advance` saw: the fastest closing of two spheres (or a sphere and the floor), of a sphere and the glass, and how many dropped spheres first touched something. */
  clack: number;
  glass: number;
  landed: number;
  // contacts of the step in hand
  ci: Int32Array;
  cj: Int32Array;
  cnx: Float64Array;
  cny: Float64Array;
  cvn: Float64Array;
  cc: Float64Array;
  nc: number;
}

const FLOOR = -1;
const WALL = -2;

const alloc = (cap: number) => ({
  x: new Float64Array(cap),
  y: new Float64Array(cap),
  px: new Float64Array(cap),
  py: new Float64Array(cap),
  vx: new Float64Array(cap),
  vy: new Float64Array(cap),
  r: new Float64Array(cap),
  im: new Float64Array(cap),
  still: new Float64Array(cap),
  ax: new Float64Array(cap),
  ay: new Float64Array(cap),
  moved: new Uint8Array(cap),
  asleep: new Uint8Array(cap),
  fresh: new Uint8Array(cap),
  seed: new Float64Array(cap),
  order: new Int32Array(cap),
  ci: new Int32Array(cap * 8 + 16),
  cj: new Int32Array(cap * 8 + 16),
  cnx: new Float64Array(cap * 8 + 16),
  cny: new Float64Array(cap * 8 + 16),
  cvn: new Float64Array(cap * 8 + 16),
  cc: new Float64Array(cap * 8 + 16),
});

/** An empty glass `w` by `h` (its top a half circle, so `h` is at least `w / 2`), with gravity straight down. */
export const createWorld = (w: number, h: number, cap = 64): World => ({ w, h: Math.max(h, w / 2), R: w / 2, n: 0, ...alloc(Math.max(8, cap)), gx: 0, gy: GRAVITY, floating: false, t: 0, held: -1, hx: 0, hy: 0, acc: 0, clack: 0, glass: 0, landed: 0, nc: 0 });

const grow = (W: World): void => {
  const next = alloc(W.x.length * 2);
  for (const k of ['x', 'y', 'px', 'py', 'vx', 'vy', 'r', 'im', 'still', 'ax', 'ay', 'asleep', 'fresh', 'seed', 'order'] as const) (next[k] as Float64Array).set(W[k] as Float64Array);
  Object.assign(W, next);
};

/** A number from 0 to 1 for an index: fixed, so nothing here is random. */
export const unit = (i: number): number => {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export interface BodyOpts {
  vx?: number;
  vy?: number;
  /** It is dropping in: its first touch is counted in `landed`. */
  fresh?: boolean;
  /** Its own number from 0 to 1 (by default from its index). */
  seed?: number;
  asleep?: boolean;
}
/** Put a sphere in the glass. Returns its index. A center outside the glass is brought inside by the first step. */
export const addBody = (W: World, x: number, y: number, r: number, o: BodyOpts = {}): number => {
  if (W.n >= W.x.length) grow(W);
  const i = W.n++;
  W.x[i] = W.px[i] = W.ax[i] = Number.isFinite(x) ? x : W.R;
  W.y[i] = W.py[i] = W.ay[i] = Number.isFinite(y) ? y : W.R;
  W.vx[i] = o.vx ?? 0;
  W.vy[i] = o.vy ?? 0;
  W.r[i] = r;
  W.im[i] = 1 / (r * r);
  W.still[i] = 0;
  W.asleep[i] = o.asleep ? 1 : 0;
  W.fresh[i] = o.fresh ? 1 : 0;
  W.seed[i] = o.seed ?? unit(i);
  W.order[i] = i;
  return i;
};

/** Wake every sphere (a touch, a key, the phone turning). */
export const wake = (W: World): void => {
  for (let i = 0; i < W.n; i++) {
    W.asleep[i] = 0;
    W.still[i] = 0;
  }
};
/** Is every sphere asleep, with nothing held and nothing floating? Then nothing will move until something wakes it. */
export const resting = (W: World): boolean => {
  if (W.held >= 0 || W.floating) return false;
  for (let i = 0; i < W.n; i++) if (!W.asleep[i]) return false;
  return true;
};

const step = (W: World, h: number): void => {
  const { x, y, px, py, vx, vy, r, im, still, asleep, fresh, seed, order, ci, cj, cnx, cny, cvn, cc, ax, ay, moved } = W;
  const n = W.n;
  const held = W.held;
  const floating = W.floating;
  const air = Math.max(0, 1 - (floating ? FLOAT.air : AIR) * h);
  const room = ci.length;

  // ---------- 1. gravity (or the drift, or the finger), then move ----------
  const phase = 0.35 * Math.sin(W.t * 0.17);
  for (let i = 0; i < n; i++) {
    px[i] = x[i]!;
    py[i] = y[i]!;
    if (asleep[i]) continue;
    let ux = vx[i]!;
    let uy = vy[i]!;
    if (i === held) {
      // toward the finger, with a finger's strength and no more: against a pile it leans, it does not hammer
      let wx = (W.hx - x[i]!) * HOLD.stiffness;
      let wy = (W.hy - y[i]!) * HOLD.stiffness;
      const want = Math.hypot(wx, wy);
      if (want > HOLD.speed) {
        wx *= HOLD.speed / want;
        wy *= HOLD.speed / want;
      }
      let dx = wx - ux;
      let dy = wy - uy;
      const dv = Math.hypot(dx, dy);
      const most = HOLD.force * h;
      if (dv > most) {
        dx *= most / dv;
        dy *= most / dv;
      }
      ux += dx;
      uy += dy;
    } else if (floating) {
      // a slow turn: up the middle, out along the top, down the walls; and each sphere is drawn to a height of its own
      const s = seed[i]!;
      const fx = (x[i]! / W.w) * 2 * Math.PI + phase;
      const fy = (y[i]! / W.h) * Math.PI;
      const tx = -FLOAT.speed * Math.sin(fx) * Math.cos(fy);
      const ty = FLOAT.speed * Math.cos(fx) * Math.sin(fy);
      const home = W.h * (0.16 + 0.68 * s) + 18 * Math.sin(W.t * (0.4 + 0.5 * s) + 6.283 * s);
      ux += (tx - ux) * FLOAT.pull * h;
      uy += (ty - uy) * FLOAT.pull * h + (home - y[i]!) * FLOAT.lift * h;
      ux *= air;
      uy *= air;
    } else {
      ux = (ux + W.gx * h) * air;
      uy = (uy + W.gy * h) * air;
    }
    const sp = ux * ux + uy * uy;
    if (!(sp < Infinity)) ux = uy = 0; // not a number, or no number at all: stop it where it is
    else if (sp > MAX_SPEED * MAX_SPEED) {
      const k = MAX_SPEED / Math.sqrt(sp);
      ux *= k;
      uy *= k;
    }
    vx[i] = ux;
    vy[i] = uy;
    x[i] = x[i]! + ux * h;
    y[i] = y[i]! + uy * h;
  }

  // ---------- 2. pairs: sort by left edge, sweep, push apart ----------
  for (let a = 1; a < n; a++) {
    const i = order[a]!;
    const key = x[i]! - r[i]!;
    let b = a - 1;
    while (b >= 0 && x[order[b]!]! - r[order[b]!]! > key) {
      order[b + 1] = order[b]!;
      b--;
    }
    order[b + 1] = i;
  }
  let nc = 0;
  for (let a = 0; a < n; a++) {
    const i = order[a]!;
    const ri = r[i]!;
    const right = x[i]! + ri + REST.push;
    for (let b = a + 1; b < n; b++) {
      const j = order[b]!;
      if (x[j]! - r[j]! >= right) break;
      const rr = ri + r[j]!;
      const dy = y[j]! - y[i]!;
      if (dy >= rr || dy <= -rr) continue;
      const dx = x[j]! - x[i]!;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      if (asleep[i] && asleep[j]) continue;
      let nx = 0;
      let ny = -1;
      let d = 0;
      if (d2 > 1e-12) {
        d = Math.sqrt(d2);
        nx = dx / d;
        ny = dy / d;
      }
      // closing when negative
      const vn = (vx[j]! - vx[i]!) * nx + (vy[j]! - vy[i]!) * ny;
      // a sleeper wakes when something that is really moving closes on it (a sphere wedged in a tight pocket can read
      // as fast while going nowhere: it has not left its own small circle, and wakes no one)
      if (vn < -REST.wake && ((asleep[i] && still[j]! < REST.moving) || (asleep[j] && still[i]! < REST.moving))) {
        asleep[i] = asleep[j] = 0;
        still[i] = still[j] = 0;
      }
      let wi = asleep[i] ? 0 : im[i]!;
      let wj = asleep[j] ? 0 : im[j]!;
      if (i === held) wi /= HOLD.weight;
      else if (j === held) wj /= HOLD.weight;
      const ws = wi + wj;
      if (ws === 0) continue;
      let c = rr - d;
      if (c > REST.push) c = REST.push;
      const pi = (c * wi) / ws;
      const pj = (c * wj) / ws;
      x[i] = x[i]! - nx * pi;
      y[i] = y[i]! - ny * pi;
      x[j] = x[j]! + nx * pj;
      y[j] = y[j]! + ny * pj;
      if (fresh[i]) {
        fresh[i] = 0;
        W.landed++;
      }
      if (fresh[j]) {
        fresh[j] = 0;
        W.landed++;
      }
      if (-vn > W.clack) W.clack = -vn;
      if (nc < room) {
        ci[nc] = i;
        cj[nc] = j;
        cnx[nc] = nx;
        cny[nc] = ny;
        cvn[nc] = vn;
        cc[nc] = c;
        nc++;
      }
    }
  }

  // ---------- 3. the glass: the floor, the walls, the round top ----------
  const R = W.R;
  const pairs = nc;
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    const ri = r[i]!;
    let hit = 0;
    if (y[i]! + ri > W.h) {
      const c = y[i]! + ri - W.h;
      y[i] = W.h - ri;
      hit = 1;
      if (vy[i]! > W.clack) W.clack = vy[i]!;
      if (nc < room) {
        ci[nc] = i;
        cj[nc] = FLOOR;
        cnx[nc] = 0;
        cny[nc] = -1;
        cvn[nc] = -vy[i]!;
        cc[nc] = c;
        nc++;
      }
    }
    if (y[i]! >= R) {
      let c = 0;
      let nx = 0;
      if (x[i]! - ri < 0) {
        c = ri - x[i]!;
        x[i] = ri;
        nx = 1;
      } else if (x[i]! + ri > W.w) {
        c = x[i]! + ri - W.w;
        x[i] = W.w - ri;
        nx = -1;
      }
      if (nx) {
        hit = 1;
        const vn = vx[i]! * nx;
        if (-vn > W.glass) W.glass = -vn;
        if (nc < room) {
          ci[nc] = i;
          cj[nc] = WALL;
          cnx[nc] = nx;
          cny[nc] = 0;
          cvn[nc] = vn;
          cc[nc] = c;
          nc++;
        }
      }
    } else {
      const dx = x[i]! - R;
      const dy = y[i]! - R;
      const d = Math.hypot(dx, dy);
      const lim = Math.max(0, R - ri);
      if (d > lim && d > 1e-9) {
        const nx = -dx / d;
        const ny = -dy / d;
        x[i] = R - nx * lim;
        y[i] = R - ny * lim;
        hit = 1;
        const vn = vx[i]! * nx + vy[i]! * ny;
        if (-vn > W.glass) W.glass = -vn;
        if (nc < room) {
          ci[nc] = i;
          cj[nc] = WALL;
          cnx[nc] = nx;
          cny[nc] = ny;
          cvn[nc] = vn;
          cc[nc] = d - lim;
          nc++;
        }
      }
    }
    if (hit && fresh[i]) {
      fresh[i] = 0;
      W.landed++;
    }
  }

  // ---------- 3b. once more over the same pairs, backwards, then the glass again: a tall pile's weight is passed
  // down to the floor and back up within the step, so a pile at rest is not left pressed into itself ----------
  for (let k = pairs - 1; k >= 0; k--) {
    const i = ci[k]!;
    const j = cj[k]!;
    const rr = r[i]! + r[j]!;
    const dx = x[j]! - x[i]!;
    const dy = y[j]! - y[i]!;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-12) continue;
    let wi = asleep[i] ? 0 : im[i]!;
    let wj = asleep[j] ? 0 : im[j]!;
    if (i === held) wi /= HOLD.weight;
    else if (j === held) wj /= HOLD.weight;
    const ws = wi + wj;
    if (ws === 0) continue;
    const d = Math.sqrt(d2);
    let c = rr - d;
    if (c > REST.push) c = REST.push;
    const nx = dx / d;
    const ny = dy / d;
    x[i] = x[i]! - (nx * c * wi) / ws;
    y[i] = y[i]! - (ny * c * wi) / ws;
    x[j] = x[j]! + (nx * c * wj) / ws;
    y[j] = y[j]! + (ny * c * wj) / ws;
    cc[k] = cc[k]! + c;
  }
  // the glass has the last word: nothing ends a step outside it
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    const ri = r[i]!;
    if (y[i]! + ri > W.h) y[i] = W.h - ri;
    if (y[i]! >= R) {
      if (x[i]! < ri) x[i] = ri;
      else if (x[i]! > W.w - ri) x[i] = W.w - ri;
    } else {
      const dx = x[i]! - R;
      const dy = y[i]! - R;
      const d = Math.hypot(dx, dy);
      const lim = Math.max(0, R - ri);
      if (d > lim && d > 1e-9) {
        x[i] = R + (dx / d) * lim;
        y[i] = R + (dy / d) * lim;
      }
    }
  }
  W.nc = nc;

  // ---------- 4. speeds, read back from where everything ended up ----------
  const inv = 1 / h;
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    vx[i] = (x[i]! - px[i]!) * inv;
    vy[i] = (y[i]! - py[i]!) * inv;
  }

  // ---------- 5. each contact's bounce and friction; the speed the pushing apart added is taken out ----------
  const e = floating ? BOUNCE.floating : BOUNCE.sphere;
  const eg = floating ? BOUNCE.floating : BOUNCE.glass;
  for (let k = 0; k < nc; k++) {
    const i = ci[k]!;
    const j = cj[k]!;
    const nx = cnx[k]!;
    const ny = cny[k]!;
    const pre = cvn[k]!;
    const most = cc[k]! * inv;
    if (j >= 0) {
      let wi = asleep[i] ? 0 : im[i]!;
      let wj = asleep[j] ? 0 : im[j]!;
      if (i === held) wi /= HOLD.weight;
      else if (j === held) wj /= HOLD.weight;
      const ws = wi + wj;
      if (ws === 0) continue;
      const rx = vx[j]! - vx[i]!;
      const ry = vy[j]! - vy[i]!;
      const vn = rx * nx + ry * ny;
      // what a finger holds is damped by the finger: it shoulders the pile aside, it does not strike it
      const bounce = i === held || j === held ? BOUNCE.held : e;
      const want = pre < -BOUNCE.floor ? -bounce * pre : pre < 0 ? 0 : Math.min(vn, pre);
      const vt = -rx * ny + ry * nx;
      const lim = FRICTION.sphere * most;
      const dt = vt > lim ? -lim : vt < -lim ? lim : -vt;
      const ax = nx * (want - vn) - ny * dt;
      const ay = ny * (want - vn) + nx * dt;
      const si = wi / ws;
      const sj = wj / ws;
      vx[i] = vx[i]! - ax * si;
      vy[i] = vy[i]! - ay * si;
      vx[j] = vx[j]! + ax * sj;
      vy[j] = vy[j]! + ay * sj;
    } else {
      const vn = vx[i]! * nx + vy[i]! * ny;
      const want = pre < -BOUNCE.floor ? -eg * pre : pre < 0 ? 0 : Math.min(vn, pre);
      const vt = -vx[i]! * ny + vy[i]! * nx;
      const lim = (j === FLOOR ? FRICTION.floor : FRICTION.glass) * most;
      const dt = vt > lim ? -lim : vt < -lim ? lim : -vt;
      vx[i] = vx[i]! + nx * (want - vn) - ny * dt;
      vy[i] = vy[i]! + ny * (want - vn) + nx * dt;
    }
  }

  // ---------- 6. sleep: all but still, among neighbors that are, for a moment ----------
  // "Still" is where a sphere is, not how fast: a pile at rest trembles by hundredths of a unit as its contacts are
  // solved, and a speed read from that never falls to nothing. A sphere that has not left a small circle has.
  const drift = REST.drift * REST.drift;
  for (let i = 0; i < n; i++) {
    moved[i] = 0;
    if (asleep[i]) continue;
    const dx = x[i]! - ax[i]!;
    const dy = y[i]! - ay[i]!;
    if (dx * dx + dy * dy > drift) {
      ax[i] = x[i]!;
      ay[i] = y[i]!;
      still[i] = 0;
      moved[i] = 1;
    } else still[i] = still[i]! + h;
  }
  for (let k = 0; k < nc; k++) {
    const j = cj[k]!;
    if (j < 0) continue;
    const i = ci[k]!;
    if (moved[i]) still[j] = 0;
    if (moved[j]) still[i] = 0;
  }
  if (!floating) {
    for (let i = 0; i < n; i++) {
      if (asleep[i] || i === held || still[i]! < REST.after) continue;
      asleep[i] = 1;
      vx[i] = vy[i] = 0;
    }
  }
};

/**
 * Move the world on by `dt` seconds of real time, in whole fixed steps (what is left over waits for the next call).
 * Returns how many steps were taken. `clack`, `glass` and `landed` say what happened in them.
 */
export const advance = (W: World, dt: number): number => {
  W.clack = 0;
  W.glass = 0;
  W.landed = 0;
  if (!(dt > 0)) return 0;
  W.acc += Math.min(dt, TIME.maxFrame);
  let steps = 0;
  while (W.acc >= TIME.step) {
    step(W, TIME.step);
    W.acc -= TIME.step;
    W.t += TIME.step;
    steps++;
  }
  return steps;
};

/** Run until everything is at rest, or `seconds` of simulated time have passed. Returns the simulated seconds it took. */
export const settle = (W: World, seconds: number = REST.settle): number => {
  const was = W.t;
  const most = Math.ceil(seconds / TIME.step);
  for (let k = 0; k < most && !resting(W); k++) {
    step(W, TIME.step);
    W.t += TIME.step;
  }
  W.clack = W.glass = W.landed = 0;
  return W.t - was;
};

/** The sphere under a point, or the nearest one within `slop` of its edge; -1 when there is none. */
export const nearest = (W: World, x: number, y: number, slop = 0): number => {
  let best = -1;
  let gap = slop;
  for (let i = 0; i < W.n; i++) {
    const d = Math.hypot(W.x[i]! - x, W.y[i]! - y) - W.r[i]!;
    if (d < gap || (d <= 0 && best < 0)) {
      gap = d;
      best = i;
    }
  }
  return best;
};

/** Take hold of sphere `i`: it follows (`x`, `y`) until it is let go. Everything wakes. */
export const grab = (W: World, i: number, x: number, y: number): void => {
  if (i < 0 || i >= W.n) return;
  wake(W);
  W.held = i;
  W.hx = x;
  W.hy = y;
};
/** Where the finger wants the held sphere now. */
export const drag = (W: World, x: number, y: number): void => {
  W.hx = x;
  W.hy = y;
};
/** Let go. With a speed, the sphere leaves with it (a flick), no faster than `FLING.max`. */
export const release = (W: World, vx?: number, vy?: number): void => {
  const i = W.held;
  W.held = -1;
  if (i < 0 || vx === undefined || vy === undefined || !Number.isFinite(vx) || !Number.isFinite(vy)) return;
  let ux = vx * FLING.gain;
  let uy = vy * FLING.gain;
  const sp = Math.hypot(ux, uy);
  if (sp > FLING.max) {
    ux *= FLING.max / sp;
    uy *= FLING.max / sp;
  }
  W.vx[i] = ux;
  W.vy[i] = uy;
  W.asleep[i] = 0;
  W.still[i] = 0;
};

/** One upward swirl: every sphere is lifted against gravity and turned about the middle of the pile. */
export const stir = (W: World): void => {
  wake(W);
  if (!W.n) return;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < W.n; i++) {
    mx += W.x[i]!;
    my += W.y[i]!;
  }
  mx /= W.n;
  my /= W.n;
  const g = Math.hypot(W.gx, W.gy);
  const upx = g > 1 ? -W.gx / g : 0;
  const upy = g > 1 ? -W.gy / g : -1;
  for (let i = 0; i < W.n; i++) {
    if (i === W.held) continue;
    const k = STIR.spread + (1 - STIR.spread) * W.seed[i]!;
    W.vx[i] = W.vx[i]! + upx * STIR.lift * k - (W.y[i]! - my) * STIR.turn;
    W.vy[i] = W.vy[i]! + upy * STIR.lift * k + (W.x[i]! - mx) * STIR.turn;
  }
};

/** Float on: gravity lets go and the spheres drift. Off: they fall again. */
export const setFloating = (W: World, on: boolean): void => {
  W.floating = on;
  wake(W);
};
/** Gravity as a share of its whole (`x` right, `y` down; (0, 1) is straight down). */
export const setGravity = (W: World, x: number, y: number): void => {
  W.gx = x * GRAVITY;
  W.gy = y * GRAVITY;
};

/** How far inside the glass's edge a point is (negative: outside). */
export const inside = (W: World, x: number, y: number): number => {
  const floor = W.h - y;
  if (y >= W.R) return Math.min(floor, x, W.w - x);
  return Math.min(floor, W.R - Math.hypot(x - W.R, y - W.R));
};

/**
 * Lay spheres of these radii in rows from the floor up, in the order given (so the first are at the bottom), each a
 * little off the row's line so the pile is not a lattice. They are close to rest; `settle` finishes the job.
 */
export const pour = (W: World, radii: readonly number[]): void => {
  let base = W.h;
  let k = 0;
  let row = 0;
  while (k < radii.length) {
    // how many fit along this row
    let tall = 0;
    let end = k;
    let used = 0;
    const span = (rad: number, top: number): [number, number] => {
      const cy = top - rad;
      if (cy >= W.R) return [rad, W.w - rad];
      const lim = Math.max(0, W.R - rad);
      const half = Math.sqrt(Math.max(0, lim * lim - (W.R - cy) * (W.R - cy)));
      return [W.R - half, W.R + half];
    };
    for (; end < radii.length; end++) {
      const rad = radii[end]!;
      const [lo, hi] = span(Math.max(tall, rad), base);
      const need = used + rad * 2 + (end > k ? 1.5 : 0);
      if (end > k && need > hi - lo + Math.max(tall, rad) * 2) break;
      used = need;
      tall = Math.max(tall, rad);
    }
    const [lo, hi] = span(tall, base);
    const slack = Math.max(0, hi - lo + tall * 2 - used);
    const gap = slack / (end - k + 1);
    let cx = lo - tall + gap;
    const back = row % 2 === 1;
    for (let i = k; i < end; i++) {
      const rad = radii[i]!;
      const u = unit(W.n + 7919);
      const px = cx + rad;
      const x = back ? W.w - px : px;
      addBody(W, x, base - rad - u * 1.5, rad);
      cx += rad * 2 + 1.5 + gap;
    }
    base -= tall * 2 + 0.5;
    k = end;
    row++;
    if (base < 0) base = W.R * 0.5; // more than the glass holds: the solver eases them apart
  }
};
