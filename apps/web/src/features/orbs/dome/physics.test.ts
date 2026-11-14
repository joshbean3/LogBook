import { describe, expect, it } from 'vitest';
import { addBody, advance, createWorld, drag, grab, inside, nearest, pour, release, resting, setFloating, setGravity, settle, stir, unit, wake, type World } from './physics';
import { FILL, FLING, FLOAT, GRAVITY, HOLD, MAX_SPEED, OCULUS, RADIUS, TIME } from './rules';

const D = OCULUS.d;
const R = D / 2;
/** An oculus about as full as it may be: an earlier year, some chapters and weeks, and a busy week of small Orbs. */
const radii = (n: number): number[] => Array.from({ length: n }, (_, i) => (i < 1 ? RADIUS.year : i < 4 ? RADIUS.chapter[1] : i < 8 ? RADIUS.week[1] : unit(i) < 0.14 ? RADIUS.train : RADIUS.habit));
/** This many of them fill the circle to just under the limit. */
const FULL = 36;
const area = (W: World) => Math.PI * W.R * W.R;
const filled = (rs: readonly number[]) => rs.reduce((t, r) => t + Math.PI * r * r, 0);
const oculus = (n: number): World => {
  const W = createWorld(D);
  pour(W, radii(n));
  return W;
};
const overlap = (W: World): number => {
  let most = 0;
  for (let i = 0; i < W.n; i++) for (let j = i + 1; j < W.n; j++) most = Math.max(most, W.r[i]! + W.r[j]! - Math.hypot(W.x[i]! - W.x[j]!, W.y[i]! - W.y[j]!));
  return most;
};
/** How far the worst Orb pokes out of the circle (0 or less: all inside). */
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
const spinning = (W: World): number => {
  let most = 0;
  for (let i = 0; i < W.n; i++) most = Math.max(most, Math.abs(W.spin[i]!));
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
const snapshot = (W: World) => [Array.from(W.x.subarray(0, W.n)), Array.from(W.y.subarray(0, W.n)), Array.from(W.vx.subarray(0, W.n)), Array.from(W.vy.subarray(0, W.n)), Array.from(W.rot.subarray(0, W.n)), Array.from(W.spin.subarray(0, W.n))];
/** A point on the rim's inside for an Orb of radius `r`: `deg` round from the lowest point, positive to the right. */
const onRim = (r: number, deg: number): [number, number] => [R + (R - r) * Math.sin((deg * Math.PI) / 180), R + (R - r) * Math.cos((deg * Math.PI) / 180)];
/** How far an Orb's center is from where the rim would hold it (0: it lies on the rim). */
const offRim = (W: World, i: number): number => R - W.r[i]! - Math.hypot(W.x[i]! - R, W.y[i]! - R);

describe('the test piles are honest', () => {
  it('the full pile fills a little under the limit of the circle', () => {
    const W = createWorld(D);
    const share = filled(radii(FULL)) / area(W);
    expect(share).toBeGreaterThan(FILL.limit - 0.05);
    expect(share).toBeLessThan(FILL.limit);
  });
});

describe('the rim', () => {
  it('nothing leaves the circle: a pour, a stir, flings all round and a drag past every edge', () => {
    const W = oculus(FULL + 8);
    let worst = -Infinity;
    const look = () => (worst = Math.max(worst, outside(W)));
    for (let f = 0; f < 60; f++) (advance(W, FRAME), look());
    stir(W);
    for (let f = 0; f < 90; f++) (advance(W, FRAME), look());
    // throw one at the rim every 45 degrees
    for (let k = 0; k < 8; k++) {
      const i = 10 + k * 5;
      const a = (k * Math.PI) / 4;
      grab(W, i, W.x[i]!, W.y[i]!);
      release(W, Math.cos(a) * 9000, Math.sin(a) * 9000);
      for (let f = 0; f < 20; f++) (advance(W, FRAME), look());
    }
    // a finger that leaves the circle altogether
    grab(W, 30, W.x[30]!, W.y[30]!);
    for (const [fx, fy] of [[-400, 200], [900, 200], [R, -600], [R, 2000], [-300, -300], [600, 600]] as const) {
      drag(W, fx, fy);
      for (let f = 0; f < 12; f++) (advance(W, FRAME), look());
    }
    release(W);
    untilRest(W, 8, look);
    expect(worst).toBeLessThanOrEqual(1e-6);
    expect(resting(W)).toBe(true);
  });
  it('a fling cannot tunnel through the rim, whatever speed it is given', () => {
    for (const [vx, vy] of [[1e6, 0], [-1e6, 0], [0, 1e6], [0, -1e6], [7e5, -7e5], [-7e5, 7e5], [Infinity, 0], [NaN, NaN]] as const) {
      const W = createWorld(D);
      const i = addBody(W, R, R, RADIUS.habit, { vx, vy });
      for (let f = 0; f < 30; f++) {
        advance(W, FRAME);
        expect(RADIUS.habit - inside(W, W.x[i]!, W.y[i]!)).toBeLessThanOrEqual(1e-6);
        expect(Math.hypot(W.vx[i]!, W.vy[i]!)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
        expect(Number.isFinite(W.rot[i]!)).toBe(true);
      }
    }
    // and a flick is no faster than the rules allow
    const W = oculus(10);
    grab(W, 3, W.x[3]!, W.y[3]!);
    release(W, 1e5, -1e5);
    expect(Math.hypot(W.vx[3]!, W.vy[3]!)).toBeCloseTo(FLING.max, 6);
  });
  it('an Orb put outside is brought inside by the first step', () => {
    const W = createWorld(D);
    for (const [x, y] of [[-50, 100], [500, 300], [10, 10], [270, 5], [R, 900], [NaN, NaN]] as const) addBody(W, x, y, 12);
    advance(W, FRAME);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
  });
  it('one step moves nothing by more than its smallest radius, so no Orb passes through another', () => {
    expect(MAX_SPEED * TIME.step).toBeLessThan(Math.min(RADIUS.todo, RADIUS.habit));
    expect(HOLD.speed).toBeLessThanOrEqual(MAX_SPEED);
    expect(FLING.max).toBeLessThanOrEqual(MAX_SPEED);
  });
});

describe('the bowl of the circle', () => {
  it('an Orb let go on the slope rolls down the curve, swings past the lowest point and comes to rest there', () => {
    for (const r of [RADIUS.habit, RADIUS.goalWeek, RADIUS.year]) {
      const W = createWorld(D);
      const [x0, y0] = onRim(r, -60);
      const i = addBody(W, x0, y0, r);
      let off = 0;
      let furthest = -Infinity;
      const took = untilRest(W, 8, () => {
        off = Math.max(off, offRim(W, i));
        furthest = Math.max(furthest, W.x[i]! - R);
      });
      // it never leaves the curve, it passes the lowest point, and it ends on it
      expect(off).toBeLessThan(0.5);
      expect(furthest).toBeGreaterThan(8);
      expect(took).toBeLessThan(3);
      expect(Math.abs(W.x[i]! - R)).toBeLessThan(1.5);
      expect(W.y[i]!).toBeGreaterThan(D - r - 0.05);
      // it rolled: clockwise on its way to the right, by the length of curve it covered over its own radius
      const rolled = ((R - r) * (60 * Math.PI)) / 180 / r;
      expect(W.rot[i]!).toBeGreaterThan(rolled * 0.85);
      expect(W.rot[i]!).toBeLessThan(rolled * 1.15);
      // and it came to rest with the Orb
      expect(W.spin[i]).toBe(0);
    }
  });
  it('when gravity turns, a resting Orb rolls along the curve to the new lowest point', () => {
    const W = createWorld(D);
    const r = RADIUS.habit;
    const i = addBody(W, R, D - r, r);
    settle(W);
    expect(resting(W)).toBe(true);
    // the phone on its right side: down is to the right
    setGravity(W, 1, 0);
    wake(W);
    let off = 0;
    let lowest = 0;
    const took = untilRest(W, 8, () => {
      off = Math.max(off, offRim(W, i));
      lowest = Math.max(lowest, W.y[i]!);
    });
    expect(off).toBeLessThan(0.5);
    expect(took).toBeLessThan(3);
    expect(W.x[i]!).toBeGreaterThan(D - r - 0.05);
    expect(Math.abs(W.y[i]! - R)).toBeLessThan(1.5);
    // a quarter of the way round, turning clockwise as it goes
    const rolled = ((R - r) * Math.PI) / 2 / r;
    expect(W.rot[i]!).toBeGreaterThan(rolled * 0.85);
    expect(W.rot[i]!).toBeLessThan(rolled * 1.15);
    expect(W.spin[i]).toBe(0);
    // and back when the phone is upright again, turning the other way
    setGravity(W, 0, 1);
    wake(W);
    untilRest(W);
    expect(Math.abs(W.x[i]! - R)).toBeLessThan(1.5);
    expect(Math.abs(W.rot[i]!)).toBeLessThan(rolled * 0.15);
  });
  it('a pile follows the turn too, and rests against the side', () => {
    const W = oculus(30);
    settle(W);
    /** Where the pile's weight is. */
    const mean = () => {
      let x = 0;
      let y = 0;
      let m = 0;
      for (let i = 0; i < W.n; i++) {
        const w = W.r[i]! * W.r[i]!;
        x += W.x[i]! * w;
        y += W.y[i]! * w;
        m += w;
      }
      return [x / m, y / m] as const;
    };
    const [x0, y0] = mean();
    expect(Math.abs(x0 - R)).toBeLessThan(12);
    expect(y0).toBeGreaterThan(R + 15);
    setGravity(W, -1, 0);
    wake(W);
    expect(untilRest(W)).toBeLessThan(4);
    const [x1, y1] = mean();
    expect(x1).toBeLessThan(R - 15);
    expect(Math.abs(y1 - R)).toBeLessThan(12);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
    expect(overlap(W)).toBeLessThan(0.6);
  });
});

describe('coming to rest', () => {
  it('a poured pile settles, nothing overlaps, and nothing moves or turns again', () => {
    for (const n of [1, 12, 30, FULL]) {
      const W = oculus(n);
      const took = settle(W);
      expect(took).toBeLessThan(3);
      expect(resting(W)).toBe(true);
      expect(overlap(W)).toBeLessThan(0.5);
      expect(outside(W)).toBeLessThanOrEqual(1e-6);
      expect(spinning(W)).toBe(0);
      const was = snapshot(W);
      for (let f = 0; f < 120; f++) advance(W, FRAME);
      // asleep is asleep: not one coordinate or angle changes, so a resting pile cannot shiver
      expect(snapshot(W)).toEqual(was);
      expect(energy(W)).toBe(0);
    }
  });
  it('energy falls to rest after a stir, inside about three seconds', () => {
    for (const n of [12, 30, FULL]) {
      const W = oculus(n);
      settle(W);
      stir(W);
      const start = energy(W);
      expect(start).toBeGreaterThan(0);
      const took = untilRest(W);
      expect(took).toBeLessThan(3.2);
      expect(energy(W)).toBe(0);
      expect(spinning(W)).toBe(0);
      expect(overlap(W)).toBeLessThan(0.6);
    }
  });
  it('a dropped Orb bounces a few times and is still at the lowest point inside a second and a half', () => {
    const W = createWorld(D);
    const i = addBody(W, R, 30, RADIUS.habit, { fresh: true });
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
    expect(W.y[i]).toBeCloseTo(D - RADIUS.habit, 3);
    expect(W.x[i]).toBeCloseTo(R, 3);
  });
  it('a heavier Orb shoulders a lighter one aside', () => {
    const W = createWorld(D);
    setGravity(W, 0, 0);
    const big = addBody(W, 80, R, RADIUS.year, { vx: 400 });
    const small = addBody(W, 160, R, RADIUS.habit);
    for (let f = 0; f < 10; f++) advance(W, FRAME);
    expect(W.vx[small]!).toBeGreaterThan(W.vx[big]!);
    expect(W.x[big]!).toBeGreaterThan(80);
  });
});

describe('turning', () => {
  it('an Orb in the air keeps turning and fades; one a finger holds stops', () => {
    const W = createWorld(D);
    setGravity(W, 0, 0);
    const i = addBody(W, R - 40, R, RADIUS.habit, { vx: 120 });
    W.spin[i] = 8;
    for (let f = 0; f < 30; f++) advance(W, FRAME);
    expect(W.spin[i]!).toBeGreaterThan(4);
    expect(W.spin[i]!).toBeLessThan(8);
    expect(W.rot[i]!).toBeGreaterThan(2);
    grab(W, i, W.x[i]!, W.y[i]!);
    for (let f = 0; f < 30; f++) advance(W, FRAME);
    expect(Math.abs(W.spin[i]!)).toBeLessThan(0.05);
    release(W);
  });
  it('one Orb rolling over another turns the way it travels', () => {
    const W = createWorld(D);
    const low = addBody(W, R, D - RADIUS.year, RADIUS.year);
    settle(W);
    // set down just right of the big one's top: it rolls off to the right, clockwise
    const top = addBody(W, R + 6, D - RADIUS.year * 2 - RADIUS.habit, RADIUS.habit);
    for (let f = 0; f < 12; f++) advance(W, FRAME);
    expect(W.x[top]!).toBeGreaterThan(R + 6);
    expect(W.spin[top]!).toBeGreaterThan(0);
    expect(W.rot[top]!).toBeGreaterThan(0);
    expect(Math.abs(W.spin[low]!)).toBeLessThan(Math.abs(W.spin[top]!));
  });
});

describe('the finger', () => {
  it('a held Orb follows the finger closely in the open', () => {
    const W = createWorld(D);
    const i = addBody(W, 50, R, RADIUS.habit);
    grab(W, i, 50, R);
    let lag = 0;
    for (let f = 0; f < 22; f++) {
      const fx = 50 + f * 8; // 480 units a second
      drag(W, fx, R);
      advance(W, FRAME);
      lag = Math.max(lag, Math.hypot(W.x[i]! - fx, W.y[i]! - R));
    }
    expect(lag).toBeLessThan(20);
    release(W, 480, 0);
    expect(W.held).toBe(-1);
  });
  it('dragging one through a full pile never throws it: speeds stay under the finger’s own, overlaps stay small, and it rests again', () => {
    const W = oculus(FULL);
    settle(W);
    const i = 30;
    grab(W, i, W.x[i]!, W.y[i]!);
    let squeeze = 0;
    let speed = 0;
    for (let f = 0; f < 90; f++) {
      // a fast scribble across the bottom of the pile and back
      drag(W, R + 110 * Math.sin(f / 5), D - 40 - 60 * (0.5 + 0.5 * Math.cos(f / 3)));
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
  it('finds the Orb under a touch, or the nearest within reach', () => {
    const W = createWorld(D);
    const a = addBody(W, 100, 150, 11);
    const b = addBody(W, 160, 150, 20);
    expect(nearest(W, 101, 152)).toBe(a);
    expect(nearest(W, 150, 150)).toBe(b);
    expect(nearest(W, 100, 130)).toBe(-1);
    expect(nearest(W, 100, 130, HOLD.slop)).toBe(a);
    expect(nearest(W, 230, 60, HOLD.slop)).toBe(-1);
  });
});

describe('the pills', () => {
  it('Stir lifts the pile against gravity and turns it', () => {
    const W = oculus(30);
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
    expect(low - high).toBeGreaterThan(45);
  });
  it('Float lets go of gravity: the Orbs leave the bowl, keep drifting slowly without spinning, and fall again when it is switched off', () => {
    const W = oculus(30);
    settle(W);
    /** How many lie in the lower half of the circle. */
    const low = () => {
      let on = 0;
      for (let i = 0; i < W.n; i++) if (W.y[i]! > R) on++;
      return on;
    };
    const lying = low();
    expect(lying).toBeGreaterThan(W.n * 0.6);
    setFloating(W, true);
    for (let f = 0; f < 480; f++) advance(W, FRAME);
    expect(resting(W)).toBe(false);
    expect(low()).toBeLessThan(lying * 0.8);
    expect(fastest(W)).toBeLessThan(160);
    expect(fastest(W)).toBeGreaterThan(1);
    // a slow drift of its own, never a spin
    expect(spinning(W)).toBeLessThanOrEqual(FLOAT.spin + 1e-9);
    expect(spinning(W)).toBeGreaterThan(0);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
    setFloating(W, false);
    expect(untilRest(W)).toBeLessThan(3.2);
    expect(low()).toBeGreaterThan(W.n * 0.6);
    expect(spinning(W)).toBe(0);
  });
  it('gravity can point anywhere: turned over, the pile rests in the top of the circle', () => {
    const W = oculus(30);
    settle(W);
    setGravity(W, 0, -1);
    wake(W);
    expect(untilRest(W)).toBeLessThan(4);
    let lowest = 0;
    for (let i = 0; i < W.n; i++) lowest = Math.max(lowest, W.y[i]! + W.r[i]!);
    expect(lowest).toBeLessThan(D * 0.75);
    expect(outside(W)).toBeLessThanOrEqual(1e-6);
    expect(W.gy).toBe(-GRAVITY);
  });
});

describe('the same every time, and fast', () => {
  it('the same calls give the same pile to the last digit, angles too', () => {
    const run = () => {
      const W = oculus(FULL);
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
    const a = oculus(30);
    const b = oculus(30);
    for (let f = 0; f < 120; f++) advance(a, 1 / 120);
    for (let f = 0; f < 60; f++) advance(b, 1 / 60);
    expect(Math.abs(a.t - b.t)).toBeLessThanOrEqual(TIME.step);
  });
  it('a stalled frame slows the pile, it does not throw it', () => {
    const W = oculus(20);
    expect(advance(W, 5)).toBeLessThanOrEqual(Math.ceil(TIME.maxFrame / TIME.step) + 1);
  });
  it('200 Orbs in the air step a whole frame in under 4 ms', () => {
    // far more than the fill limit lets the page show: small ones, with room left in the circle for 200 to fly
    const small = Array.from({ length: 200 }, (_, i) => (unit(i) < 0.2 ? 9 : 7));
    const W = createWorld(D);
    expect(filled(small) / area(W)).toBeLessThan(0.6);
    pour(W, small);
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
    // the median is the claim; the slowest frames get room, because a full test run shares the machine with a dozen workers
    expect(p95).toBeLessThan(12);
  });
});
