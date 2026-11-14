import { describe, expect, it, vi } from 'vitest';
import { TILT } from './rules';
import { askMotion, DOWN, follow, gravityFrom, turned } from './tilt';

const near = (got: { x: number; y: number }, x: number, y: number) => {
  expect(got.x).toBeCloseTo(x, 6);
  expect(got.y).toBeCloseTo(y, 6);
};

describe('gravity from the phone’s lean', () => {
  it('upright: straight down, whole', () => near(gravityFrom(90, 0, 0), 0, 1));
  it('upside down: straight up the screen, so the pile falls into the round top', () => near(gravityFrom(-90, 0, 0), 0, -1));
  it('flat on a table, face up or face down: nothing pulls, the Orbs stay where they are', () => {
    near(gravityFrom(0, 0, 0), 0, 0);
    near(gravityFrom(180, 0, 0), 0, 0);
    near(gravityFrom(-180, 0, 0), 0, 0);
  });
  it('held as a phone is held (about 50 degrees back): still whole, still down', () => {
    near(gravityFrom(50, 0, 0), 0, 1);
    near(gravityFrom(35, 0, 0), 0, 1);
  });
  it('nearly flat: the pull fades with the lean, and never flips', () => {
    const g = gravityFrom(10, 0, 0);
    expect(g.x).toBeCloseTo(0, 6);
    expect(g.y).toBeCloseTo(Math.sin((10 * Math.PI) / 180) / TILT.full, 6);
    expect(gravityFrom(5, 0, 0).y).toBeLessThan(g.y);
    expect(gravityFrom(5, 0, 0).y).toBeGreaterThan(0);
  });
  it('flat and leaned to the right: the Orbs roll right; to the left, left', () => {
    near(gravityFrom(0, 40, 0), 1, 0);
    near(gravityFrom(0, -40, 0), -1, 0);
    expect(gravityFrom(0, 10, 0).x).toBeGreaterThan(0);
    expect(gravityFrom(0, 10, 0).x).toBeLessThan(1);
  });
  it('upright and leaned: down and to the low side', () => {
    const g = gravityFrom(60, 30, 0);
    expect(g.x).toBeGreaterThan(0.2);
    expect(g.y).toBeGreaterThan(0.8);
    expect(Math.hypot(g.x, g.y)).toBeCloseTo(1, 6);
    expect(gravityFrom(60, -30, 0).x).toBeCloseTo(-g.x, 6);
  });
  it('the length is never more than whole gravity, at any angle', () => {
    for (let beta = -180; beta <= 180; beta += 15) for (let gamma = -90; gamma <= 90; gamma += 15) for (const angle of [0, 90, 180, 270]) expect(Math.hypot(gravityFrom(beta, gamma, angle).x, gravityFrom(beta, gamma, angle).y)).toBeLessThanOrEqual(1 + 1e-9);
  });
  it('the screen turned on its side: down is still toward the ground', () => {
    // turned a quarter to the left (angle 90: the phone's top points left, its left edge is the low one): beta 0, gamma -90
    near(gravityFrom(0, -90, 90), 0, 1);
    // a quarter to the right (angle 270: its right edge is the low one)
    near(gravityFrom(0, 90, 270), 0, 1);
    // on its side and leaned back a little, as a phone is held to watch something
    near(gravityFrom(0, -50, 90), 0, 1);
    // the screen upside down with the phone
    near(gravityFrom(-90, 0, 180), 0, 1);
    // and a screen that did not turn with the phone falls sideways, as it should
    near(gravityFrom(0, -90, 0), -1, 0);
  });
  it('a reading that is not a number is straight down, never a flying pile', () => {
    for (const [b, g] of [[null, null], [undefined, 3], [NaN, 0], [10, Infinity], [null, 20]] as const) expect(gravityFrom(b, g, 0)).toBe(DOWN);
    near(gravityFrom(90, 0, NaN), 0, 1);
    near(gravityFrom(90, 0, null), 0, 1);
  });
});

describe('following and waking', () => {
  it('gravity eases toward the phone, and gets there', () => {
    let g = { x: 0, y: 1 };
    const to = { x: 1, y: 0 };
    const first = follow(g, to, 1 / 60);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) g = follow(g, to, 1 / 60);
    near(g, 1, 0);
    expect(follow({ x: 0, y: 1 }, to, 0)).toEqual({ x: 0, y: 1 });
  });
  it('a shaky hand does not wake a resting pile; a real turn does', () => {
    expect(turned({ x: 0, y: 1 }, { x: 0.03, y: 1 })).toBe(false);
    expect(turned({ x: 0, y: 1 }, { x: 0.2, y: 0.98 })).toBe(true);
  });
});

describe('asking for the sensor fails soft in every way', () => {
  it('no such event on this device', async () => {
    expect(await askMotion({})).toBe('none');
    expect(await askMotion(undefined)).toBe('none');
  });
  it('a browser that does not ask is granted', async () => expect(await askMotion({ DeviceOrientationEvent: class {} })).toBe('granted'));
  it('asked and allowed, asked and refused', async () => {
    const yes = vi.fn(async () => 'granted');
    expect(await askMotion({ DeviceOrientationEvent: { requestPermission: yes } })).toBe('granted');
    expect(yes).toHaveBeenCalledTimes(1);
    expect(await askMotion({ DeviceOrientationEvent: { requestPermission: async () => 'denied' } })).toBe('denied');
    expect(await askMotion({ DeviceOrientationEvent: { requestPermission: async () => 'default' } })).toBe('denied');
  });
  it('only the motion class asks: it is the one asked, once', async () => {
    const ask = vi.fn(async () => 'granted');
    expect(await askMotion({ DeviceOrientationEvent: class {}, DeviceMotionEvent: { requestPermission: ask } })).toBe('granted');
    expect(ask).toHaveBeenCalledTimes(1);
  });
  it('asking throws (not from a tap, an old engine): refused, never an error', async () => {
    expect(
      await askMotion({
        DeviceOrientationEvent: {
          requestPermission: () => {
            throw new Error('NotAllowedError');
          },
        },
      }),
    ).toBe('denied');
    expect(await askMotion({ DeviceOrientationEvent: { requestPermission: () => Promise.reject(new Error('no')) } })).toBe('denied');
  });
});
