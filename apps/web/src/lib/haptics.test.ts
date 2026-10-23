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

  it('falls back after FILL_MS when no frame comes', async () => {
    const { events, motionValue, hapticAtPeak } = await setup();
    hapticAtPeak(motionValue(1), 'orb');
    vi.advanceTimersByTime(399);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(events).toEqual(['orb']);
  });
});
