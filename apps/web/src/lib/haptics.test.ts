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
