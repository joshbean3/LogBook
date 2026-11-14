import { AIR, BOUNCE, FLING, FLOAT, FRICTION, GRAVITY, HOLD, MAX_SPEED, REST, ROLL, STIR, TIME } from './rules';

/**
 * The oculus's physics, with no DOM in it: circles with weight inside one big circle. Pure arithmetic on typed arrays,
 * so the same calls give the same pile on every phone.
 *
 * How it works. Time moves in small fixed steps (`TIME.step`, eight to a frame). Each step: every waking Orb takes
 * gravity and moves; every overlapping pair is pushed apart by weight, then every Orb is put back inside the rim (the
 * rim is a rule about where a center may be, so no speed can pass through it); speeds are read back from where the
 * Orbs ended up; then each contact gets its bounce and its friction, and whatever speed the pushing apart added is
 * taken out again, which is what keeps a squeezed pile from bursting. An Orb that has been slow among slow neighbors
 * for a moment goes to sleep (it stops being moved at all, so a resting pile cannot shiver), and wakes when something
 * closes on it. When every Orb sleeps the world is at rest and the caller can stop its frames.
 *
 * The rim is a bowl whichever way gravity points: an Orb on it rolls down the curve, swings past the lowest point and
 * comes to rest there (`ROLL.drag` is what it loses on the way). Each Orb also has an angle, because its drawing has an
 * up: the angle is read from how the Orb moves against what it touches (rolling without slipping), it pushes nothing,
 * and it stops when the Orb does.
 *
 * Pairs are found by sorting the Orbs by their left edge and sweeping (the order barely changes from one step to the
 * next, so the sort is nearly free): 200 Orbs step in well under a millisecond.
 */
export interface World {
  /** The oculus: a circle of radius `R` centered at (`R`, `R`), so `d` across. */
  readonly d: number;
  readonly R: number;
  /** How many Orbs. The arrays below are at least this long. */
  n: number;
  x: Float64Array;
  y: Float64Array;
  /** Where each was before the step. */
  px: Float64Array;
  py: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  r: Float64Array;
  /** One over the weight (an Orb weighs its radius squared). */
  im: Float64Array;
  /** How far each has turned from upright, in radians (clockwise on the page), and how fast it is turning. */
  rot: Float64Array;
  spin: Float64Array;
  /** How long each has stayed within a small circle about (`ax`, `ay`), in seconds. */
  still: Float64Array;
  ax: Float64Array;
  ay: Float64Array;
  moved: Uint8Array;
  /** Steps left in which an Orb still counts as leaning on another (a resting touch is only seen every few steps). */
  near: Uint8Array;
  asleep: Uint8Array;
  /** 1 while an Orb dropped in has touched nothing yet. */
  fresh: Uint8Array;
  /** Each Orb's own number from 0 to 1: its share of a stir, its place while floating. */
  seed: Float64Array;
  order: Int32Array;
  /** Gravity, in units per second squared. */
  gx: number;
  gy: number;
  floating: boolean;
  /** Simulated time, in seconds. */
  t: number;
  /** The held Orb, or -1, and where the finger wants it. */
  held: number;
  hx: number;
  hy: number;
  acc: number;
  /** What the last `advance` saw: the fastest closing of two Orbs (or of an Orb and the rim), the fastest meeting with the rim alone, and how many dropped Orbs first touched something. */
  clack: number;
  rim: number;
  landed: number;
  // contacts of the step in hand
  ci: Int32Array;
  cj: Int32Array;
  cnx: Float64Array;
  cny: Float64Array;
  cvn: Float64Array;
  cc: Float64Array;
  nc: number;
  // the turning each Orb's contacts ask of it in the step in hand, and how many asked
  ws: Float64Array;
  wn: Float64Array;
}

const RIM = -1;
/** An Orb that touched another within this many steps is leaning on it, not alone on the rim. */
const LEAN = 48;

const alloc = (cap: number) => ({
  x: new Float64Array(cap),
  y: new Float64Array(cap),
  px: new Float64Array(cap),
  py: new Float64Array(cap),
  vx: new Float64Array(cap),
  vy: new Float64Array(cap),
  r: new Float64Array(cap),
  im: new Float64Array(cap),
  rot: new Float64Array(cap),
  spin: new Float64Array(cap),
  still: new Float64Array(cap),
  ax: new Float64Array(cap),
  ay: new Float64Array(cap),
  moved: new Uint8Array(cap),
  near: new Uint8Array(cap),
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
  ws: new Float64Array(cap),
  wn: new Float64Array(cap),
});

/** An empty oculus `d` across, with gravity straight down. */
export const createWorld = (d: number, cap = 64): World => ({ d, R: d / 2, n: 0, ...alloc(Math.max(8, cap)), gx: 0, gy: GRAVITY, floating: false, t: 0, held: -1, hx: 0, hy: 0, acc: 0, clack: 0, rim: 0, landed: 0, nc: 0 });

const grow = (W: World): void => {
  const next = alloc(W.x.length * 2);
  for (const k of ['x', 'y', 'px', 'py', 'vx', 'vy', 'r', 'im', 'rot', 'spin', 'still', 'ax', 'ay', 'near', 'asleep', 'fresh', 'seed', 'order'] as const) (next[k] as Float64Array).set(W[k] as Float64Array);
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
/** A second number from 0 to 1 out of a first: an Orb's seed gives it a place across the window as well as a share. */
const second = (s: number): number => {
  const v = s * 7919.137;
  return v - Math.floor(v);
};

export interface BodyOpts {
  vx?: number;
  vy?: number;
  /** How far it has turned from upright, in radians. */
  rot?: number;
  /** It is dropping in: its first touch is counted in `landed`. */
  fresh?: boolean;
  /** Its own number from 0 to 1 (by default from its index). */
  seed?: number;
  asleep?: boolean;
}
/** Put an Orb in the oculus. Returns its index. A center outside the rim is brought inside by the first step. */
export const addBody = (W: World, x: number, y: number, r: number, o: BodyOpts = {}): number => {
  if (W.n >= W.x.length) grow(W);
  const i = W.n++;
  W.x[i] = W.px[i] = W.ax[i] = Number.isFinite(x) ? x : W.R;
  W.y[i] = W.py[i] = W.ay[i] = Number.isFinite(y) ? y : W.R;
  W.vx[i] = o.vx ?? 0;
  W.vy[i] = o.vy ?? 0;
  W.r[i] = r;
  W.im[i] = 1 / (r * r);
  W.rot[i] = o.rot !== undefined && Number.isFinite(o.rot) ? o.rot : 0;
  W.spin[i] = 0;
  W.still[i] = 0;
  W.near[i] = 0;
  W.asleep[i] = o.asleep ? 1 : 0;
  W.fresh[i] = o.fresh ? 1 : 0;
  W.seed[i] = o.seed ?? unit(i);
  W.order[i] = i;
  return i;
};

/** Wake every Orb (a touch, a pill, the phone turning). */
export const wake = (W: World): void => {
  for (let i = 0; i < W.n; i++) {
    W.asleep[i] = 0;
    W.still[i] = 0;
  }
};
/** Is every Orb asleep, with nothing held and nothing floating? Then nothing will move until something wakes it. */
export const resting = (W: World): boolean => {
  if (W.held >= 0 || W.floating) return false;
  for (let i = 0; i < W.n; i++) if (!W.asleep[i]) return false;
  return true;
};

const step = (W: World, h: number): void => {
  const { x, y, px, py, vx, vy, r, im, rot, spin, still, asleep, fresh, seed, order, ci, cj, cnx, cny, cvn, cc, ax, ay, moved, near, ws, wn } = W;
  const n = W.n;
  const R = W.R;
  const held = W.held;
  const floating = W.floating;
  const air = Math.max(0, 1 - (floating ? FLOAT.air : AIR) * h);
  const room = ci.length;

  // ---------- 1. gravity (or the drift, or the finger), then move ----------
  for (let i = 0; i < n; i++) {
    px[i] = x[i]!;
    py[i] = y[i]!;
    ws[i] = 0;
    wn[i] = 0;
    if (near[i]) near[i] = near[i]! - 1;
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
      // each Orb is drawn to a place of its own in the window, and the places go slowly round the middle, some one
      // way and some the other, riding up and down a little as they go
      const s = seed[i]!;
      const s2 = second(s);
      const reach = Math.max(0, R - r[i]! - 6) * Math.sqrt(s);
      const at = 6.283 * s2 + W.t * FLOAT.turn * (s2 < 0.5 ? 1 : -1) * (0.5 + 0.5 * s);
      const hx = R + reach * Math.cos(at);
      const hy = R + reach * Math.sin(at) + FLOAT.bob * Math.sin(W.t * (0.4 + 0.5 * s) + 6.283 * s);
      ux = (ux + (hx - x[i]!) * FLOAT.lift * h) * air;
      uy = (uy + (hy - y[i]!) * FLOAT.lift * h) * air;
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
      // a sleeper wakes when something that is really moving closes on it (an Orb wedged in a tight pocket can read
      // as fast while going nowhere: it has not left its own small circle, and wakes no one)
      if (vn < -REST.wake && ((asleep[i] && still[j]! < REST.moving) || (asleep[j] && still[i]! < REST.moving))) {
        asleep[i] = asleep[j] = 0;
        still[i] = still[j] = 0;
      }
      let wi = asleep[i] ? 0 : im[i]!;
      let wj = asleep[j] ? 0 : im[j]!;
      if (i === held) wi /= HOLD.weight;
      else if (j === held) wj /= HOLD.weight;
      const ws2 = wi + wj;
      if (ws2 === 0) continue;
      let c = rr - d;
      if (c > REST.push) c = REST.push;
      const pi = (c * wi) / ws2;
      const pj = (c * wj) / ws2;
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

  // ---------- 3. the rim: no center is further from the middle than the rim allows ----------
  const pairs = nc;
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    const dx = x[i]! - R;
    const dy = y[i]! - R;
    const d = Math.hypot(dx, dy);
    const lim = Math.max(0, R - r[i]!);
    if (!(d > lim) || d < 1e-9) continue;
    // the rim's push, toward the middle
    const nx = -dx / d;
    const ny = -dy / d;
    x[i] = R - nx * lim;
    y[i] = R - ny * lim;
    const vn = vx[i]! * nx + vy[i]! * ny;
    if (-vn > W.rim) W.rim = -vn;
    if (-vn > W.clack) W.clack = -vn;
    if (nc < room) {
      ci[nc] = i;
      cj[nc] = RIM;
      cnx[nc] = nx;
      cny[nc] = ny;
      cvn[nc] = vn;
      cc[nc] = d - lim;
      nc++;
    }
    if (fresh[i]) {
      fresh[i] = 0;
      W.landed++;
    }
  }

  // ---------- 3b. once more over the same pairs, backwards, then the rim again: a tall pile's weight is passed
  // down to the rim and back up within the step, so a pile at rest is not left pressed into itself ----------
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
    const ws2 = wi + wj;
    if (ws2 === 0) continue;
    const d = Math.sqrt(d2);
    let c = rr - d;
    if (c > REST.push) c = REST.push;
    const nx = dx / d;
    const ny = dy / d;
    x[i] = x[i]! - (nx * c * wi) / ws2;
    y[i] = y[i]! - (ny * c * wi) / ws2;
    x[j] = x[j]! + (nx * c * wj) / ws2;
    y[j] = y[j]! + (ny * c * wj) / ws2;
    cc[k] = cc[k]! + c;
  }
  // the rim has the last word: nothing ends a step outside it
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    const dx = x[i]! - R;
    const dy = y[i]! - R;
    const d = Math.hypot(dx, dy);
    const lim = Math.max(0, R - r[i]!);
    if (d > lim && d > 1e-9) {
      x[i] = R + (dx / d) * lim;
      y[i] = R + (dy / d) * lim;
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
  const e = floating ? BOUNCE.floating : BOUNCE.orb;
  const eg = floating ? BOUNCE.floating : BOUNCE.rim;
  const drag = Math.min(1, ROLL.drag * h);
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
      const ws2 = wi + wj;
      if (ws2 === 0) continue;
      const rx = vx[j]! - vx[i]!;
      const ry = vy[j]! - vy[i]!;
      const vn = rx * nx + ry * ny;
      // what a finger holds is damped by the finger: it shoulders the pile aside, it does not strike it
      const bounce = i === held || j === held ? BOUNCE.held : e;
      const want = pre < -BOUNCE.floor ? -bounce * pre : pre < 0 ? 0 : Math.min(vn, pre);
      const vt = -rx * ny + ry * nx;
      const lim = FRICTION.orb * most;
      const dt = vt > lim ? -lim : vt < -lim ? lim : -vt;
      const ax2 = nx * (want - vn) - ny * dt;
      const ay2 = ny * (want - vn) + nx * dt;
      const si = wi / ws2;
      const sj = wj / ws2;
      vx[i] = vx[i]! - ax2 * si;
      vy[i] = vy[i]! - ay2 * si;
      vx[j] = vx[j]! + ax2 * sj;
      vy[j] = vy[j]! + ay2 * sj;
      // the two roll on each other: how fast one slides past the other is shared out as turning, the lighter taking more
      ws[i] = ws[i]! + (vt * si) / r[i]!;
      wn[i] = wn[i]! + 1;
      ws[j] = ws[j]! + (vt * sj) / r[j]!;
      wn[j] = wn[j]! + 1;
      near[i] = near[j] = LEAN;
    } else {
      const vn = vx[i]! * nx + vy[i]! * ny;
      const want = pre < -BOUNCE.floor ? -eg * pre : pre < 0 ? 0 : Math.min(vn, pre);
      const vt = -vx[i]! * ny + vy[i]! * nx;
      // rolling along the rim: it turns as fast as it travels, loses a share of that each second, and the last of it
      // to friction
      ws[i] = ws[i]! + vt / r[i]!;
      // alone on the slope, where friction cannot hold it, it is not at rest however slowly it is turning round at
      // the top of a swing: it sleeps at the lowest point, not beside it
      if (!near[i] && !floating && Math.abs(-W.gx * ny + W.gy * nx) > FRICTION.rim * Math.max(0, -(W.gx * nx + W.gy * ny)) + 1) still[i] = 0;
      wn[i] = wn[i]! + 1;
      const left = vt * (1 - drag);
      const lim = FRICTION.rim * most;
      const dt = left - vt + (left > lim ? -lim : left < -lim ? lim : -left);
      vx[i] = vx[i]! + nx * (want - vn) - ny * dt;
      vy[i] = vy[i]! + ny * (want - vn) + nx * dt;
    }
  }

  // ---------- 5b. turning: toward what the contacts ask; in the air it runs on and fades; a finger stops it ----------
  const grip = Math.min(1, ROLL.grip * h);
  const loose = Math.max(0, 1 - ROLL.air * h);
  const pinch = Math.max(0, 1 - ROLL.held * h);
  for (let i = 0; i < n; i++) {
    if (asleep[i]) continue;
    let w = spin[i]!;
    if (i === held) w *= pinch;
    else if (floating) {
      // a slow drift of its own, one way or the other, whatever it bumps into
      w += ((seed[i]! * 2 - 1) * FLOAT.spin - w) * grip;
    } else if (wn[i]! > 0) w += (ws[i]! / wn[i]! - w) * grip;
    else w *= loose;
    if (!(w > -ROLL.max)) w = -ROLL.max;
    else if (!(w < ROLL.max)) w = ROLL.max;
    if (w !== w) w = 0;
    spin[i] = w;
    rot[i] = rot[i]! + w * h;
  }

  // ---------- 6. sleep: all but still, among neighbors that are, for a moment ----------
  // "Still" is where an Orb is, not how fast: a pile at rest trembles by hundredths of a unit as its contacts are
  // solved, and a speed read from that never falls to nothing. An Orb that has not left a small circle has.
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
      spin[i] = 0;
    }
  }
};

/**
 * Move the world on by `dt` seconds of real time, in whole fixed steps (what is left over waits for the next call).
 * Returns how many steps were taken. `clack`, `rim` and `landed` say what happened in them.
 */
export const advance = (W: World, dt: number): number => {
  W.clack = 0;
  W.rim = 0;
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
  W.clack = W.rim = W.landed = 0;
  return W.t - was;
};

/** The Orb under a point, or the nearest one within `slop` of its edge; -1 when there is none. */
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

/** Take hold of Orb `i`: it follows (`x`, `y`) until it is let go. Everything wakes. */
export const grab = (W: World, i: number, x: number, y: number): void => {
  if (i < 0 || i >= W.n) return;
  wake(W);
  W.held = i;
  W.hx = x;
  W.hy = y;
};
/** Where the finger wants the held Orb now. */
export const drag = (W: World, x: number, y: number): void => {
  W.hx = x;
  W.hy = y;
};
/** Let go. With a speed, the Orb leaves with it (a flick), no faster than `FLING.max`. */
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

/** One upward swirl: every Orb is lifted against gravity and turned about the middle of the pile. */
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

/** Float on: gravity lets go and the Orbs drift. Off: they fall again. */
export const setFloating = (W: World, on: boolean): void => {
  W.floating = on;
  wake(W);
};
/** Gravity as a share of its whole (`x` right, `y` down; (0, 1) is straight down). */
export const setGravity = (W: World, x: number, y: number): void => {
  W.gx = x * GRAVITY;
  W.gy = y * GRAVITY;
};

/** How far inside the rim a point is (negative: outside). */
export const inside = (W: World, x: number, y: number): number => W.R - Math.hypot(x - W.R, y - W.R);

/**
 * Lay Orbs of these radii in rows from the bottom of the circle up, in the order given (so the first are lowest), each
 * a little off the row's line so the pile is not a lattice, and each turned a little from upright by its own seed (they
 * rolled to where they lie). They are close to rest; `settle` finishes the job.
 */
export const pour = (W: World, radii: readonly number[]): void => {
  const R = W.R;
  let base = W.d;
  let k = 0;
  let row = 0;
  // the chord a row of Orbs this tall may stand on, when its lowest point is at `bottom`
  const span = (rad: number, bottom: number): [number, number] => {
    const lim = Math.max(0, R - rad);
    const dy = bottom - rad - R;
    const half = Math.sqrt(Math.max(0, lim * lim - dy * dy));
    return [R - half, R + half];
  };
  while (k < radii.length) {
    // how many fit along this row
    let tall = 0;
    let end = k;
    let used = 0;
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
      const at = cx + rad;
      const x = back ? W.d - at : at;
      addBody(W, x, base - rad - u * 1.5, rad, { rot: (unit(W.n + 104729) * 2 - 1) * 6.283 * ROLL.lying });
      cx += rad * 2 + 1.5 + gap;
    }
    base -= tall * 2 + 0.5;
    k = end;
    row++;
    if (base < tall * 2) base = R; // more than the window holds: the solver eases them apart
  }
};
