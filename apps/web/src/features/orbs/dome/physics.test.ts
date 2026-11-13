import { describe, expect, it } from 'vitest';
import { addBody, advance, createWorld, drag, grab, inside, nearest, pour, release, resting, setFloating, setGravity, settle, stir, unit, wake, type World } from './physics';
import { FILL, FLING, GLASS, GRAVITY, HOLD, MAX_SPEED, RADIUS, TIME } from './rules';

/** A dome about as full as it may be: an earlier year, some chapters and weeks, and a busy week of small Orbs. */
const radii = (n: number): number[] => Array.from({ length: n }, (_, i) => (i < 1 ? RADIUS.year : i < 4 ? 30 : i < 8 ? 22 : unit(i) < 0.14 ? RADIUS.train : RADIUS.habit));
/** This many of them fill the smallest glass to just under the limit. */
const FULL = 125;
const area = (W: World) => (Math.PI * W.R * W.R) / 2 + W.w * (W.h - W.R);
const filled = (rs: readonly number[]) => rs.reduce((t, r) => t + Math.PI * r * r, 0);
const glass = (n: number, h: number = GLASS.minH): World => {
  const W = createWorld(GLASS.w, h);
  pour(W, radii(n));
  return W;
};
const overlap = (W: World): number => {
  let most = 0;
  for (let i = 0; i < W.n; i++) for (let j = i + 1; j < W.n; j++) most = Math.max(most, W.r[i]! + W.r[j]! - Math.hypot(W.x[i]! - W.x[j]!, W.y[i]! - W.y[j]!));
  return most;
};
/** How far the worst sphere pokes out of the glass (0 or less: all inside). */
const outside = (W: World): number => {
  let most = -Infinity;
  for (let i = 0; i < W.n; i++) most = Math.max(most, W.r[i]! - inside(W, W.x[i]!, W.y[i]!));
  return most;
};
const energy = (W: World): number => {
  let e = 0;
  for (let i = 0; i < W.n; i++) e += (W.vx[i]! * W.vx[i]! + W.vy[i]! * W.vy[i]!) / W.im[i]!;
  return e;
};
const fastest = (W: World): number => {
  let most = 0;
  for (let i = 0; i < W.n; i++) most = Math.max(most, Math.hypot(W.vx[i]!, W.vy[i]!));
  return most;
};
const FRAME = 1 / 60;
/** Run frames until rest; the seconds it took (at most `limit`). */
const untilRest = (W: World, limit = 8, each?: () => void): number => {
  let t = 0;
  while (!resting(W) && t < limit) {
    advance(W, FRAME);
    each?.();
    t += FRAME;
  }
  return t;
};
const snapshot = (W: World) => [Array.from(W.x.subarray(0, W.n)), Array.from(W.y.subarray(0, W.n)), Array.from(W.vx.subarray(0, W.n)), Array.from(W.vy.subarray(0, W.n))];

describe('the test piles are honest', () => {
  it('the full pile fills a little under the limit of the smallest glass', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    const share = filled(radii(FULL)) / area(W);
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(FILL.limit);
  });
});

describe('the glass', () => {
  it('nothing leaves it: a pour, a stir, flings at every wall and a drag past every edge', () => {
    const W = glass(150);
    let worst = -Infinity;
    const look = () => (worst = Math.max(worst, outside(W)));
    for (let f = 0; f < 60; f++) (advance(W, FRAME), look());
    stir(W);
    for (let f = 0; f < 90; f++) (advance(W, FRAME), look());
    // throw one at each wall, the floor and the round top
    const throws: Array<[number, number]> = [[-1, 0], [1, 0], [0, 1], [0, -1], [-0.7, -0.7], [0.7, -0.7]];
    throws.forEach(([dx, dy], k) => {
      const i = 20 + k * 9;
      grab(W, i, W.x[i]!, W.y[i]!);
      release(W, dx * 9000, dy * 9000);
      for (let f = 0; f < 20; f++) (advance(W, FRAME), look());
    });
    // a finger that leaves the glass altogether
    grab(W, 60, W.x[60]!, W.y[60]!);
    for (const [fx, fy] of [[-400, 200], [900, 200], [167, -600], [167, 2000], [-300, -300]] as const) {
      drag(W, fx, fy);
      for (let f = 0; f < 12; f++) (advance(W, FRAME), look());
    }
    release(W);
    untilRest(W, 8, look);
    expect(worst).toBeLessThanOrEqual(1e-6);
    expect(resting(W)).toBe(true);
  });
  it('a fling cannot tunnel through a wall, whatever speed it is given', () => {
    for (const [vx, vy] of [[1e6, 0], [-1e6, 0], [0, 1e6], [0, -1e6], [7e5, -7e5], [Infinity, 0], [NaN, NaN]] as const) {
      const W = createWorld(GLASS.w, GLASS.minH);
      const i = addBody(W, GLASS.w / 2, GLASS.minH / 2, RADIUS.habit, { vx, vy });
      for (let f = 0; f < 30; f++) {
        advance(W, FRAME);
        expect(RADIUS.habit - inside(W, W.x[i]!, W.y[i]!)).toBeLessThanOrEqual(1e-6);
        expect(Math.hypot(W.vx[i]!, W.vy[i]!)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
      }
    }
    // and a flick is no faster than the rules allow
    const W = glass(10);
    grab(W, 3, W.x[3]!, W.y[3]!);
    release(W, 1e5, -1e5);
    expect(Math.hypot(W.vx[3]!, W.vy[3]!)).toBeCloseTo(FLING.max, 6);
  });
  it('a sphere put outside is brought inside by the first step', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    for (const [x, y] of [[-50, 100], [500, 300], [10, 10], [320, 5], [167, 900], [NaN, NaN]] as const) addBody(W, x, y, 12);
    advance(W, FRAME);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
  });
  it('one step moves nothing by more than its smallest radius, so no sphere passes through another', () => {
    expect(MAX_SPEED * TIME.step).toBeLessThan(Math.min(RADIUS.todo, RADIUS.habit));
    expect(HOLD.speed).toBeLessThanOrEqual(MAX_SPEED);
    expect(FLING.max).toBeLessThanOrEqual(MAX_SPEED);
  });
});

describe('coming to rest', () => {
  it('a poured pile settles, nothing overlaps, and nothing moves again', () => {
    for (const n of [1, 12, 60, FULL]) {
      const W = glass(n);
      const took = settle(W);
      expect(took).toBeLessThan(3);
      expect(resting(W)).toBe(true);
      expect(overlap(W)).toBeLessThan(0.5);
      expect(outside(W)).toBeLessThanOrEqual(1e-6);
      const was = snapshot(W);
      for (let f = 0; f < 120; f++) advance(W, FRAME);
      // asleep is asleep: not one coordinate changes, so a resting pile cannot shiver
      expect(snapshot(W)).toEqual(was);
      expect(energy(W)).toBe(0);
    }
  });
  it('energy falls to rest after a stir, inside about three seconds', () => {
    for (const n of [12, 60, FULL]) {
      const W = glass(n);
      settle(W);
      stir(W);
      const start = energy(W);
      expect(start).toBeGreaterThan(0);
      const took = untilRest(W);
      expect(took).toBeLessThan(3.2);
      expect(energy(W)).toBe(0);
      expect(overlap(W)).toBeLessThan(0.6);
    }
  });
  it('a dropped sphere bounces a few times and is still inside a second and a half; a rolling one stops', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    const i = addBody(W, GLASS.w / 2, 30, RADIUS.habit, { fresh: true });
    let bounces = 0;
    let was = 0;
    let landed = 0;
    const took = untilRest(W, 8, () => {
      if (was > 0 && W.vy[i]! < 0) bounces++;
      was = W.vy[i]!;
      landed += W.landed;
    });
    expect(bounces).toBeGreaterThanOrEqual(2);
    expect(bounces).toBeLessThanOrEqual(5);
    expect(took).toBeLessThan(1.6);
    expect(landed).toBe(1);
    expect(W.y[i]).toBeCloseTo(GLASS.minH - RADIUS.habit, 3);

    const V = createWorld(GLASS.w, GLASS.minH);
    const j = addBody(V, 30, GLASS.minH - RADIUS.habit, RADIUS.habit, { vx: 500 });
    const rolled = untilRest(V);
    expect(rolled).toBeGreaterThan(0.4);
    expect(rolled).toBeLessThan(2);
    expect(V.x[j]! - 30).toBeGreaterThan(60);
  });
  it('a heavier sphere shoulders a lighter one aside', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    const big = addBody(W, 100, GLASS.minH - RADIUS.year, RADIUS.year, { vx: 400 });
    const small = addBody(W, 200, GLASS.minH - RADIUS.habit, RADIUS.habit);
    for (let f = 0; f < 20; f++) advance(W, FRAME);
    expect(W.vx[small]!).toBeGreaterThan(W.vx[big]!);
    expect(W.x[big]!).toBeGreaterThan(100);
  });
});

describe('the finger', () => {
  it('a held sphere follows the finger closely in open glass', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    const i = addBody(W, 60, 300, RADIUS.habit);
    grab(W, i, 60, 300);
    let lag = 0;
    for (let f = 0; f < 30; f++) {
      const fx = 60 + f * 8; // 480 units a second
      drag(W, fx, 300);
      advance(W, FRAME);
      lag = Math.max(lag, Math.hypot(W.x[i]! - fx, W.y[i]! - 300));
    }
    expect(lag).toBeLessThan(20);
    release(W, 480, 0);
    expect(W.held).toBe(-1);
  });
  it('dragging one through a full pile never throws it: speeds stay under the finger’s own, overlaps stay small, and it rests again', () => {
    const W = glass(FULL);
    settle(W);
    const i = 75;
    grab(W, i, W.x[i]!, W.y[i]!);
    let squeeze = 0;
    let speed = 0;
    for (let f = 0; f < 90; f++) {
      // a fast scribble across the bottom of the pile and back
      drag(W, 30 + 270 * (0.5 + 0.5 * Math.sin(f / 5)), W.h - 40 - 60 * (0.5 + 0.5 * Math.cos(f / 3)));
      advance(W, FRAME);
      squeeze = Math.max(squeeze, overlap(W));
      speed = Math.max(speed, fastest(W));
    }
    release(W, 1800, -900);
    expect(speed).toBeLessThanOrEqual(HOLD.speed);
    expect(squeeze).toBeLessThan(RADIUS.habit * 0.6);
    const took = untilRest(W);
    expect(took).toBeLessThan(3.2);
    expect(overlap(W)).toBeLessThan(0.6);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
  });
  it('finds the sphere under a touch, or the nearest within reach', () => {
    const W = createWorld(GLASS.w, GLASS.minH);
    const a = addBody(W, 100, 300, 11);
    const b = addBody(W, 160, 300, 20);
    expect(nearest(W, 101, 302)).toBe(a);
    expect(nearest(W, 150, 300)).toBe(b);
    expect(nearest(W, 100, 280)).toBe(-1);
    expect(nearest(W, 100, 280, HOLD.slop)).toBe(a);
    expect(nearest(W, 300, 100, HOLD.slop)).toBe(-1);
  });
});

describe('the keys', () => {
  it('Stir lifts the pile against gravity and turns it', () => {
    const W = glass(60);
    settle(W);
    const mean = () => {
      let y = 0;
      for (let i = 0; i < W.n; i++) y += W.y[i]!;
      return y / W.n;
    };
    const low = mean();
    stir(W);
    let high = low;
    for (let f = 0; f < 40; f++) {
      advance(W, FRAME);
      high = Math.min(high, mean());
    }
    expect(low - high).toBeGreaterThan(60);
  });
  it('Float lets go of gravity: the spheres leave the floor, keep drifting slowly, and fall again when it is switched off', () => {
    const W = glass(60);
    settle(W);
    const floorOf = () => {
      let on = 0;
      for (let i = 0; i < W.n; i++) if (W.y[i]! + W.r[i]! > W.h - 1) on++;
      return on;
    };
    expect(floorOf()).toBeGreaterThan(3);
    setFloating(W, true);
    for (let f = 0; f < 360; f++) advance(W, FRAME);
    expect(resting(W)).toBe(false);
    expect(floorOf()).toBeLessThanOrEqual(1);
    expect(fastest(W)).toBeLessThan(160);
    expect(fastest(W)).toBeGreaterThan(1);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
    setFloating(W, false);
    expect(untilRest(W)).toBeLessThan(3.2);
    expect(floorOf()).toBeGreaterThan(3);
  });
  it('gravity can point anywhere: turned over, the pile rests in the round top', () => {
    const W = glass(40);
    settle(W);
    setGravity(W, 0, -1);
    wake(W);
    expect(untilRest(W)).toBeLessThan(4);
    let lowest = 0;
    for (let i = 0; i < W.n; i++) lowest = Math.max(lowest, W.y[i]!);
    expect(lowest).toBeLessThan(W.h * 0.75);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
    expect(W.gy).toBe(-GRAVITY);
  });
});

describe('the same every time, and fast', () => {
  it('the same calls give the same pile to the last digit', () => {
    const run = () => {
      const W = glass(120);
      settle(W);
      stir(W);
      for (let f = 0; f < 45; f++) advance(W, FRAME);
      grab(W, 10, 100, 200);
      for (let f = 0; f < 20; f++) (drag(W, 100 + f * 6, 200 + f * 3), advance(W, FRAME));
      release(W, 900, -700);
      for (let f = 0; f < 60; f++) advance(W, 1 / 90);
      return snapshot(W);
    };
    expect(run()).toEqual(run());
  });
  it('frames of any length add up to the same steps', () => {
    const a = glass(40);
    const b = glass(40);
    for (let f = 0; f < 120; f++) advance(a, 1 / 120);
    for (let f = 0; f < 60; f++) advance(b, 1 / 60);
    expect(Math.abs(a.t - b.t)).toBeLessThanOrEqual(TIME.step);
  });
  it('a stalled frame slows the pile, it does not throw it', () => {
    const W = glass(20);
    expect(advance(W, 5)).toBeLessThanOrEqual(Math.ceil(TIME.maxFrame / TIME.step) + 1);
  });
  it('200 spheres in the air step a whole frame in under 4 ms', () => {
    const W = createWorld(GLASS.w, GLASS.maxH);
    pour(W, Array.from({ length: 200 }, (_, i) => (unit(i) < 0.2 ? RADIUS.train : RADIUS.habit)));
    settle(W);
    const times: number[] = [];
    for (let round = 0; round < 3; round++) {
      stir(W);
      for (let f = 0; f < 60; f++) {
        const t0 = performance.now();
        advance(W, FRAME);
        times.push(performance.now() - t0);
      }
    }
    times.sort((x, y) => x - y);
    const median = times[Math.floor(times.length / 2)]!;
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(median).toBeLessThan(4);
    expect(p95).toBeLessThan(4);
  });
});
