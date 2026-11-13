import { describe, expect, it } from 'vitest';
import { STRAY_CLICK_MS, swallowClickAfterHold } from './HoldRing';

/**
 * The click that ends a completing hold (HoldRing.tsx `swallowClickAfterHold`). Seen in a browser: the training card
 * folds as it turns to done, the second session's card slides under the thumb, and the lift's click opened that
 * session's sheet (with the three Orbs then born over it).
 */
const win = () => {
  const heard = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener: (type: string, fn: (e: unknown) => void) => void heard.set(type, (heard.get(type) ?? new Set()).add(fn)),
    removeEventListener: (type: string, fn: (e: unknown) => void) => void heard.get(type)?.delete(fn),
    fire: (type: string, e: object = {}) => {
      for (const f of [...(heard.get(type) ?? [])]) f(e);
    },
    listening: () => [...heard.values()].reduce((n, s) => n + s.size, 0),
  };
};
const click = (detail = 1) => {
  const e = { detail, stopped: false, prevented: false, stopPropagation: () => void (e.stopped = true), preventDefault: () => void (e.prevented = true) };
  return e;
};

describe('the click after a completing hold', () => {
  it('is swallowed, wherever it lands, and only that one', () => {
    const w = win();
    let t = 1000;
    swallowClickAfterHold(w as unknown as Window, () => t);
    t = 1400;
    w.fire('pointerup');
    t = 1410;
    const first = click();
    w.fire('click', first);
    expect(first.stopped && first.prevented).toBe(true);
    const second = click();
    w.fire('click', second);
    expect(second.stopped).toBe(false);
    expect(w.listening()).toBe(0);
  });
  it('a new press ends the watch: its own click is the person’s', () => {
    const w = win();
    swallowClickAfterHold(w as unknown as Window, () => 0);
    w.fire('pointerup');
    w.fire('pointerdown');
    const c = click();
    w.fire('click', c);
    expect(c.stopped).toBe(false);
    expect(w.listening()).toBe(0);
  });
  it('a click from the keyboard or VoiceOver is never the stray one', () => {
    const w = win();
    swallowClickAfterHold(w as unknown as Window, () => 0);
    const c = click(0);
    w.fire('click', c);
    expect(c.stopped).toBe(false);
    expect(w.listening()).toBe(0);
  });
  it('a click long after the thumb lifted is not swallowed', () => {
    const w = win();
    let t = 0;
    swallowClickAfterHold(w as unknown as Window, () => t);
    w.fire('pointerup');
    t = STRAY_CLICK_MS + 1;
    const c = click();
    w.fire('click', c);
    expect(c.stopped).toBe(false);
  });
  it('the thumb may rest on the done ring as long as it likes: the click after its lift is still swallowed', () => {
    const w = win();
    let t = 0;
    swallowClickAfterHold(w as unknown as Window, () => t);
    t = 5000;
    w.fire('pointerup');
    t = 5020;
    const c = click();
    w.fire('click', c);
    expect(c.stopped).toBe(true);
  });
  it('stops listening when asked', () => {
    const w = win();
    const off = swallowClickAfterHold(w as unknown as Window, () => 0);
    off();
    expect(w.listening()).toBe(0);
  });
});
