import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The hold that starts a drag (a to-do on Plan your day's line): held still it is the menu's, moved after the hold it is
 * the drag's, moved before the hold it is the page's. `useHoldDrag` over the one hold clock (`useHold`), driven here
 * without a page: React's hooks are plain values (one render), the window keeps its listeners in a list, the clock is
 * vitest's.
 */
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  useRef: <T,>(v: T) => ({ current: v }),
  useEffect: () => undefined,
  useState: <T,>(v: T) => [v, () => undefined],
  useCallback: <T,>(f: T) => f,
}));
vi.mock('@/ui/lift', () => ({ lift: vi.fn(), drop: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ haptics: { lift: vi.fn() } }));

type Fn = (e: unknown) => void;
const listeners = new Map<string, Set<Fn>>();
const fire = (type: string, e: object) => listeners.get(type)?.forEach((f) => f(e));
const el = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn(), setAttribute: vi.fn(), removeAttribute: vi.fn() });

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  vi.stubGlobal('window', {
    addEventListener: (t: string, f: Fn) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t: string, f: Fn) => listeners.get(t)?.delete(f),
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = async () => {
  const { useHoldDrag } = await import('./useDrag');
  const { pointerClaimed } = await import('@/ui/useHold');
  const calls: string[] = [];
  const d = useHoldDrag({
    visual: true,
    onArm: () => calls.push('menu'),
    onKeyHold: () => calls.push('key menu'),
    onStart: () => calls.push('start'),
    onMove: () => calls.push('move'),
    onDrop: () => calls.push('drop'),
    onCancel: (phase, reason) => calls.push(`cancel ${phase} ${reason}`),
  });
  const target = el();
  const down = (x = 100, y = 100) => d.bind.onPointerDown({ button: 0, isPrimary: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, currentTarget: target, target, nativeEvent: {} } as never);
  const move = (x: number, y: number) => fire('pointermove', { pointerId: 1, clientX: x, clientY: y });
  const up = (x: number, y: number) => fire('pointerup', { pointerId: 1, clientX: x, clientY: y });
  const cancel = () => fire('pointercancel', { pointerId: 1, clientX: 0, clientY: 0 });
  return { d, calls, down, move, up, cancel, pointerClaimed };
};

describe('a to-do held', () => {
  it('still: its menu opens at the hold, and letting go changes nothing', async () => {
    const t = await setup();
    t.down();
    vi.advanceTimersByTime(449);
    expect(t.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(t.calls).toEqual(['menu']);
    t.move(103, 104); // inside the slop: still a still hold
    t.up(103, 104);
    expect(t.calls).toEqual(['menu', 'cancel armed up']);
  });
  it('moved after the hold: the drag has it, from the first move past the slop to the release', async () => {
    const t = await setup();
    t.down();
    vi.advanceTimersByTime(450);
    t.move(100, 112);
    t.move(100, 140);
    t.up(100, 140);
    expect(t.calls).toEqual(['menu', 'start', 'move', 'move', 'drop']);
  });
  it('moved before the hold: the page scrolls, and no menu or drag follows', async () => {
    const t = await setup();
    t.down();
    vi.advanceTimersByTime(200);
    t.move(100, 70);
    vi.advanceTimersByTime(600);
    t.up(100, 40);
    expect(t.calls).toEqual([]);
  });
  it('owns its pointer from the hold to the release, so the day pager and the sheet let it go', async () => {
    const t = await setup();
    t.down();
    expect(t.pointerClaimed(1)).toBe(false);
    vi.advanceTimersByTime(450);
    expect(t.pointerClaimed(1)).toBe(true);
    t.move(100, 120);
    t.up(100, 120);
    expect(t.pointerClaimed(1)).toBe(false);
  });
  it('a drag the browser takes away is cancelled, not dropped', async () => {
    const t = await setup();
    t.down();
    vi.advanceTimersByTime(450);
    t.move(100, 120);
    t.cancel();
    expect(t.calls).toEqual(['menu', 'start', 'move', 'cancel dragging cancel']);
  });
  it('the keyboard (Shift+F10) or a right-click opens the menu at once, with no drag to follow', async () => {
    const t = await setup();
    vi.advanceTimersByTime(1000); // long after any touch hold (Android sends a contextmenu after one)
    const target = el();
    Object.assign(target, { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 }) });
    t.d.bind.onContextMenu({ clientX: 0, clientY: 0, currentTarget: target, target, preventDefault: () => undefined } as never);
    expect(t.calls).toEqual(['key menu']);
  });
});
