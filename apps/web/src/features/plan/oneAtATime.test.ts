import { describe, expect, it } from 'vitest';
import { oneAtATime } from './oneAtATime';

/**
 * "Use this plan" writes a whole plan. Its button is disabled while the write runs, but that waits for a render: two
 * presses in one task (a double click, Enter and a tap) both got through and wrote the plan twice, every session doubled.
 */
describe('oneAtATime: a write that is still running is not started again', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
  };
  it('runs the first call and drops every call until it settles', async () => {
    const d = deferred();
    let runs = 0;
    const go = oneAtATime(() => (runs++, d.promise));
    expect(go()).toBe(true);
    expect(go()).toBe(false);
    expect(go()).toBe(false);
    expect(runs).toBe(1);
    d.resolve();
    await d.promise;
    await Promise.resolve();
    expect(go()).toBe(true);
    expect(runs).toBe(2);
  });
  it('opens again after a failure, so Try again works', async () => {
    const d = deferred();
    let runs = 0;
    const go = oneAtATime(() => (runs++, d.promise));
    go();
    d.reject(new Error('no'));
    await d.promise.catch(() => undefined);
    await Promise.resolve();
    expect(go()).toBe(true);
    expect(runs).toBe(2);
  });
  it('a call that throws before it has a promise does not lock it', () => {
    let n = 0;
    const go = oneAtATime(() => {
      if (n++ === 0) throw new Error('early');
      return Promise.resolve();
    });
    expect(() => go()).toThrow('early');
    expect(go()).toBe(true);
  });
  it('a call that starts nothing (returns no promise) does not lock it', () => {
    const go = oneAtATime(() => undefined);
    expect(go()).toBe(true);
    expect(go()).toBe(true);
  });
});
