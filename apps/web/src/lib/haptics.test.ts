import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * On the web the motor is `navigator.vibrate`, which Chrome refuses (with a console warning) until the person has touched
 * the page. Haptics wait for that: `navigator.userActivation.hasBeenActive` where the browser has it, else the first
 * pointerdown or keydown the module saw.
 */
const load = async (nav: Record<string, unknown>) => {
  vi.resetModules();
  const listeners: Record<string, Array<() => void>> = {};
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('document', { addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f), removeEventListener: () => undefined });
  vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  const mod = await import('./haptics');
  return { haptics: mod.haptics, fire: (t: string) => (listeners[t] ?? []).forEach((f) => f()) };
};

describe('haptics on the web', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not call navigator.vibrate before the page has been touched (userActivation)', async () => {
    const vibrate = vi.fn();
    const ua = { hasBeenActive: false };
    const { haptics } = await load({ vibrate, userActivation: ua });
    haptics.toggle();
    haptics.success();
    expect(vibrate).not.toHaveBeenCalled();
    ua.hasBeenActive = true;
    haptics.toggle();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('without userActivation, waits for the first pointerdown or keydown', async () => {
    const vibrate = vi.fn();
    const { haptics, fire } = await load({ vibrate });
    haptics.lift();
    expect(vibrate).not.toHaveBeenCalled();
    fire('pointerdown');
    haptics.lift();
    expect(vibrate).toHaveBeenCalledWith(14);
  });
});

describe('hapticAtPeak', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const setup = async () => {
    vi.resetModules();
    const events: string[] = [];
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('window', { dispatchEvent: (e: { detail: string }) => events.push(e.detail), addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal('CustomEvent', class {
      detail: string;
      constructor(_t: string, o: { detail: string }) {
        this.detail = o.detail;
      }
    });
    const { motionValue } = await import('motion/react');
    const { hapticAtPeak } = await import('./haptics');
    return { events, motionValue, hapticAtPeak };
  };

  it('fires once, on the first falling frame after a rise (the apex), not on the first frame', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    const s = motionValue(1);
    hapticAtPeak(s, 'orb');
    s.set(1);
    expect(events).toEqual([]);
    for (const v of [1.04, 1.09, 1.12, 1.11]) s.set(v);
    expect(events).toEqual(['orb']);
    for (const v of [1.05, 1.0, 1.01]) s.set(v);
    vi.advanceTimersByTime(1000);
    expect(events).toEqual(['orb']);
  });

  it('reduced motion: a 0 → 1 fill fires on the frame it completes', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    const p = motionValue(0);
    hapticAtPeak(p, 'toggle');
    for (const v of [0.3, 0.7]) p.set(v);
    expect(events).toEqual([]);
    p.set(1);
    expect(events).toEqual(['toggle']);
  });

  it('a listener after it still sees the frame the haptic fires on (it unsubscribes after the notification)', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    const s = motionValue(1);
    hapticAtPeak(s, 'orb');
    const seen: number[] = [];
    s.on('change', (v) => seen.push(v));
    for (const v of [1.04, 1.12, 1.11, 1.05]) s.set(v);
    expect(events).toEqual(['orb']);
    expect(seen).toEqual([1.04, 1.12, 1.11, 1.05]);
  });

  it('what is born with the completion (an earned Orb) runs once, on the haptic’s own frame, right after it', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    const s = motionValue(1);
    const order: string[] = [];
    hapticAtPeak(s, 'orb', () => order.push(`then after ${events.length}`));
    for (const v of [1.04, 1.12]) s.set(v);
    expect(order).toEqual([]);
    s.set(1.11);
    expect(order).toEqual(['then after 1']);
    for (const v of [1.05, 1.0]) s.set(v);
    vi.advanceTimersByTime(1000);
    expect(order).toHaveLength(1);
  });

  it('with haptics switched off it still runs: the Orb does not depend on the motor', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    const { setHapticsEnabled } = await import('./haptics');
    setHapticsEnabled(false);
    let born = 0;
    const p = motionValue(0);
    hapticAtPeak(p, 'toggle', () => born++);
    p.set(1);
    expect(events).toEqual([]);
    expect(born).toBe(1);
  });

  it('falls back after FILL_MS when no frame comes', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    hapticAtPeak(motionValue(1), 'orb');
    vi.advanceTimersByTime(399);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(events).toEqual(['orb']);
  });
});

/** The opening sunrise's phrase (app/BrandSplash.tsx): taps on a clock, dropped when late, silent when hidden. */
describe('playHaptics', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const setup = async (doc: Record<string, unknown> = {}) => {
    vi.resetModules();
    const events: string[] = [];
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined, ...doc });
    vi.stubGlobal('window', { dispatchEvent: (e: { detail: string }) => events.push(e.detail), addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal('CustomEvent', class {
      detail: string;
      constructor(_t: string, o: { detail: string }) {
        this.detail = o.detail;
      }
    });
    const { playHaptics } = await import('./haptics');
    return { events, playHaptics };
  };
  const steps = [
    { at: 400, kind: 'rise' as const },
    { at: 700, kind: 'rise' as const },
    { at: 900, kind: 'dawn' as const },
  ];

  it('fires each step at its time on the clock it is given', async () => {
    const { events, playHaptics } = await setup();
    const t0 = Date.now();
    playHaptics(steps, () => Date.now() - t0);
    vi.advanceTimersByTime(399);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(events).toEqual(['rise']);
    vi.advanceTimersByTime(300);
    expect(events).toEqual(['rise', 'rise']);
    vi.advanceTimersByTime(200);
    expect(events).toEqual(['rise', 'rise', 'dawn']);
  });

  it('follows the clock, not the timers: an animation that started late is felt late', async () => {
    const { events, playHaptics } = await setup();
    const t0 = Date.now();
    // the first frame came 150 ms after the timers were set
    playHaptics(steps, () => Math.max(0, Date.now() - t0 - 150));
    vi.advanceTimersByTime(520);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(40);
    expect(events).toEqual(['rise']);
  });

  it('drops a step that comes up more than 120 ms late and plays the next in time', async () => {
    const { events, playHaptics } = await setup();
    let now = 0;
    playHaptics(steps, () => now);
    // the main thread was busy from 300 to 650: the 400 ms tap is 250 ms late when the timer runs
    now = 650;
    vi.advanceTimersByTime(400);
    expect(events).toEqual([]);
    now = 700;
    vi.advanceTimersByTime(50);
    expect(events).toEqual(['rise']);
  });

  it('is silent while the page is hidden, and after it is cancelled', async () => {
    const hidden = await setup({ hidden: true });
    const t0 = Date.now();
    hidden.playHaptics(steps, () => Date.now() - t0);
    vi.advanceTimersByTime(1000);
    expect(hidden.events).toEqual([]);

    const shown = await setup();
    const t1 = Date.now();
    const cancel = shown.playHaptics(steps, () => Date.now() - t1);
    vi.advanceTimersByTime(450);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(shown.events).toEqual(['rise']);
  });
});
