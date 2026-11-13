import { emptyRewards, RULES, shiftDays, type ISODate, type Rewards } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The moment's wiring (index.ts) with the layer stood in for: what `popOrbs` does with the store's answer and the clock,
 * what the counter is told while Orbs are in the air, and what the toasts and the chip do when the switches change
 * under them. Every case here was first seen going wrong in a browser (the edge pass after the build).
 */
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));
interface Spawned {
  mode: string;
  x: number;
  y: number;
  onEnd?: (landed: boolean) => void;
}
const spawned: Spawned[] = [];
const chips: Array<[number, number, string]> = [];
vi.mock('./layer', () => ({
  CHIP_MS: 2400,
  spawn: (s: Spawned) => {
    spawned.push(s);
    return true;
  },
  showChip: (x: number, y: number, anchor: string) => {
    chips.push([x, y, anchor]);
    return true;
  },
  liveOrbs: () => 0,
  clearOrbs: () => {
    cleared.n++;
    for (const s of spawned.splice(0)) s.onEnd?.(false);
  },
}));
const cleared = { n: 0 };

const U = 'u_owner';
/** A Wednesday after Orbs begin, at ten in the morning. */
const TODAY = shiftDays(RULES.startsOn, 9);
const YESTERDAY = shiftDays(TODAY, -1);
const at = (day: ISODate, hhmm: string) => new Date(`${day}T${hhmm}:00`);
const g = globalThis as unknown as Record<string, unknown>;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const rect = (x: number, y: number, w = 44, h = 44) => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y }) as DOMRect;
const stored = (over: Partial<Rewards> = {}): Rewards => ({ ...emptyRewards(U, RULES.startsOn), clock: TODAY, ...over });

const launch = async (opts: { store?: Rewards; now?: Date; set?: { on?: boolean; show?: boolean } } = {}) => {
  vi.resetModules();
  spawned.length = 0;
  chips.length = 0;
  vi.setSystemTime(opts.now ?? at(TODAY, '10:00'));
  const local = mem();
  const s = opts.store ?? stored();
  local.setItem('logbook.orbs', JSON.stringify(s));
  if (opts.set) local.setItem('logbook.orbs.set', JSON.stringify({ on: opts.set.on ?? true, show: opts.set.show ?? true, weekTarget: 5, cadence: 1, size: 'steady', at: '2026-11-17T08:00:00.000Z' }));
  const heard = new Map<string, Array<(e: unknown) => void>>();
  const sunEl = { isConnected: true, getBoundingClientRect: () => rect(310, 60, 28, 14) };
  const counterEl = { contains: () => true, getBoundingClientRect: () => rect(300, 40, 88, 44) };
  const doc = { hidden: false, documentElement: { dir: 'ltr' }, activeElement: null, body: {}, elementFromPoint: () => counterEl, addEventListener: () => undefined, removeEventListener: () => undefined };
  Object.assign(g, {
    localStorage: local,
    sessionStorage: mem(),
    document: doc,
    Element: class {},
    window: {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener: (type: string, fn: (e: unknown) => void) => void heard.set(type, [...(heard.get(type) ?? []), fn]),
      removeEventListener: () => undefined,
      matchMedia: () => ({ matches: false }),
    },
  });
  const store = await import('../store');
  store.openOrbs(U);
  const moment = await import('./index');
  const toast = await import('@/ui/toastStore');
  const stop = moment.startMoment();
  const landings: number[] = [];
  const counter = { el: counterEl as unknown as HTMLElement, sun: sunEl as unknown as HTMLElement, land: () => void landings.push(1) };
  /** The engine counted something: the store first, then its event, as the reconciler does. */
  const gain = (key: string, n: number, date: ISODate = TODAY) => {
    const cur = store.getOrbs()!;
    const day = cur.days[date] ?? { n: 0, a: 0 };
    const k = { ...(day.k ?? {}), [key]: ((day.k as Record<string, number> | undefined)?.[key] ?? 0) + n };
    store.setOrbs({ ...cur, days: { ...cur.days, [date]: { ...day, n: day.n + n, a: day.a + 1, k } } });
    for (const f of heard.get(store.ORBS_EVENT) ?? []) f({ detail: { gained: [{ key, n, date }], total: 0, today: store.getOrbs()!.days[date]!.n } });
  };
  /** A check was taken back: the store's number falls, and nothing is published. */
  const lose = (key: string, n: number, date: ISODate = TODAY) => {
    const cur = store.getOrbs()!;
    const day = cur.days[date]!;
    store.setOrbs({ ...cur, days: { ...cur.days, [date]: { ...day, n: day.n - n, k: { ...day.k, [key]: ((day.k as Record<string, number>)[key] ?? 0) - n } } } });
  };
  /** What the counter shows for today: the store's number and the claims. */
  const shown = () => Math.max(0, (store.getOrbs()!.days[TODAY]?.n ?? 0) + moment.counterOffset(TODAY));
  return { store, moment, toast, doc, counter, landings, gain, lose, shown, stop };
};

describe('the pop and the clock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage']) delete g[k];
  });

  it('pops for today, and for yesterday until 03:00', async () => {
    const a = await launch();
    expect(a.moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 'a' })).toBe(1);
    const b = await launch({ now: at(TODAY, '02:59') });
    expect(b.moment.popOrbs({ key: 'todo', date: YESTERDAY, n: 1, from: rect(300, 500), id: 'a' })).toBe(1);
  });

  it('a Today still held on yesterday after 03:00 pops nothing, though the store has not closed the day yet', async () => {
    // the store was last worked out before 03:00: yesterday has room by its count, and none by the clock
    const { store, moment, shown } = await launch({ now: at(TODAY, '03:01'), store: stored({ days: { [YESTERDAY]: { n: 2, a: 2, k: { todo: 2 } } } }) });
    expect(store.orbRoom('todo', YESTERDAY)).toBe(0);
    expect(moment.popOrbs({ key: 'todo', date: YESTERDAY, n: 1, from: rect(300, 500), id: 'a' })).toBe(0);
    expect(moment.popOrbs({ key: 'habit', date: YESTERDAY, n: 1, from: rect(40, 500), id: 'h' })).toBe(0);
    expect(spawned).toHaveLength(0);
    expect(moment.counterOffset(YESTERDAY)).toBe(0);
    expect(shown()).toBe(0);
  });

  it('a day’s goal reviewed the next morning still pops (it is paid until that day ends); a session marked then does not', async () => {
    const { moment } = await launch({ now: at(TODAY, '09:00') });
    expect(moment.popOrbs({ key: 'goal:day', date: YESTERDAY, n: 3, from: rect(60, 600), haptic: 'success' })).toBe(3);
    expect(moment.popOrbs({ key: 'train:run', date: YESTERDAY, n: 3, from: rect(60, 600), id: 's' })).toBe(0);
  });

  it('never pops for a day that has not come, an older day, or a date that is not one', async () => {
    const { store, moment } = await launch();
    const tomorrow = shiftDays(TODAY, 1);
    const old = shiftDays(TODAY, -3);
    // the store says no to each, and so does the pop's own guard
    expect(store.orbRoom('goal:day', tomorrow)).toBe(0);
    expect(store.orbRoom('goal:day', old)).toBe(0);
    for (const date of [tomorrow, old, 'not-a-date' as ISODate]) expect(moment.popOrbs({ key: 'goal:day', date, n: 3, from: rect(60, 600) })).toBe(0);
    expect(spawned).toHaveLength(0);
  });
});

describe('the counter while Orbs are in the air', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage']) delete g[k];
  });

  it('a flight holds the number back and gives it on landing, once', async () => {
    const { moment, counter, landings, gain, shown } = await launch({ store: stored({ days: { [TODAY]: { n: 1, a: 1, k: { todo: 1 } } } }) });
    moment.setCounter(counter);
    expect(moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 'b' })).toBe(1);
    expect(spawned.at(-1)!.mode).toBe('fly');
    expect(shown()).toBe(1);
    gain('todo', 1);
    expect(shown()).toBe(1);
    spawned.at(-1)!.onEnd!(true);
    expect(shown()).toBe(2);
    expect(landings).toHaveLength(1);
  });

  it('another check taken back while an Orb the store has counted is still flying: the number never dips', async () => {
    const { moment, counter, gain, lose, shown } = await launch({ store: stored({ days: { [TODAY]: { n: 1, a: 1, k: { todo: 1 } } } }) });
    moment.setCounter(counter);
    moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 'b' });
    gain('todo', 1);
    expect(shown()).toBe(1);
    // "Mark not done" on the to-do ticked before, 400 ms into the flight
    lose('todo', 1);
    expect(shown()).toBe(1);
    spawned.at(-1)!.onEnd!(true);
    expect(shown()).toBe(1);
    expect(moment.counterOffset(TODAY)).toBe(0);
  });

  it('a fall of another kind leaves the flying Orb’s number held', async () => {
    const { moment, counter, gain, lose, shown } = await launch({ store: stored({ days: { [TODAY]: { n: 2, a: 2, k: { todo: 1, habit: 1 } } } }) });
    moment.setCounter(counter);
    moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 'b' });
    gain('todo', 1);
    expect(shown()).toBe(2);
    lose('habit', 1);
    // the habit's Orb leaves; the to-do's is still in the air
    expect(shown()).toBe(1);
    spawned.at(-1)!.onEnd!(true);
    expect(shown()).toBe(2);
  });

  it('an Orb the store never counts leaves the counter by itself, with no further tap', async () => {
    const { moment, shown } = await launch();
    // no counter on screen: it rises, and the number has it at once
    moment.popOrbs({ key: 'habit', date: TODAY, n: 1, from: rect(40, 500), id: 'h1' });
    expect(shown()).toBe(1);
    const seen: number[] = [];
    moment.subscribeOffset(() => seen.push(shown()));
    // the write was refused: nothing is ever gained
    vi.advanceTimersByTime(13_000);
    expect(shown()).toBe(0);
    expect(seen.at(-1)).toBe(0);
  });

  it('a check taken back on the way: the Orb arrives quietly, the sun does not answer', async () => {
    const { moment, counter, landings, shown } = await launch();
    moment.setCounter(counter);
    moment.popOrbs({ key: 'habit', date: TODAY, n: 1, from: rect(40, 500), id: 'h1' });
    moment.unpopOrbs({ key: 'habit', date: TODAY, id: 'h1' });
    spawned.at(-1)!.onEnd!(true);
    expect(landings).toHaveLength(0);
    expect(shown()).toBe(0);
  });

  it('a to-do counted with no pop (a hold menu’s Done) is not handed to the next tap’s Orb', async () => {
    const { moment, counter, gain, shown } = await launch({ store: stored({ days: { [TODAY]: { n: 4, a: 4, k: { todo: 4 } } } }) });
    moment.setCounter(counter);
    // the fifth, by the menu: counted, no Orb
    gain('todo', 1);
    expect(shown()).toBe(5);
    // the sixth, by its check, a second later: no room, no Orb, and the number stays
    vi.advanceTimersByTime(1000);
    expect(moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 'six' })).toBe(0);
    expect(shown()).toBe(5);
  });

  it('today’s goal, popped a frame after the store counted it: three Orbs, and the number is not taken back', async () => {
    const { moment, counter, gain, shown } = await launch({ store: stored({ days: { [TODAY]: { n: 2, a: 2, k: { todo: 2 } } } }) });
    moment.setCounter(counter);
    gain('goal:day', 3);
    expect(shown()).toBe(5);
    vi.advanceTimersByTime(40);
    expect(moment.popOrbs({ key: 'goal:day', date: TODAY, n: 3, from: rect(60, 600), haptic: 'success' })).toBe(3);
    expect(shown()).toBe(5);
    for (const s of spawned) s.onEnd?.(true);
    expect(shown()).toBe(5);
  });

  it('two hundred completions leave nothing behind', async () => {
    const { moment, gain } = await launch();
    for (let i = 0; i < 200; i++) {
      moment.popOrbs({ key: 'habit', date: TODAY, n: 1, from: rect(40, 500), id: `h${i}` });
      moment.unpopOrbs({ key: 'habit', date: TODAY, id: `h${i}` });
      vi.advanceTimersByTime(11_000);
    }
    moment.popOrbs({ key: 'habit', date: TODAY, n: 1, from: rect(40, 500), id: 'last' });
    gain('habit', 1);
    vi.advanceTimersByTime(60_000);
    expect(moment.counterOffset(TODAY)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('a sheet that comes up under Orbs in the air', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage']) delete g[k];
  });
  it('takes them with it, and the count has them at once; a sheet going away takes nothing', async () => {
    const { moment, counter, landings, gain, shown } = await launch();
    moment.setCounter(counter);
    moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 't' });
    gain('todo', 1);
    expect(shown()).toBe(0);
    const before = cleared.n;
    moment.setOverlays(1);
    expect(cleared.n).toBe(before + 1);
    expect(shown()).toBe(1);
    // it never reached the sun
    expect(landings).toHaveLength(0);
    moment.setOverlays(0);
    expect(cleared.n).toBe(before + 1);
  });
  it('so does another tab, or a page pushed over this one', async () => {
    const { moment, counter, landings, gain, shown } = await launch();
    moment.setCounter(counter);
    moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 't' });
    gain('todo', 1);
    moment.leftScreen();
    expect(shown()).toBe(1);
    expect(landings).toHaveLength(0);
  });
});

describe('a pop that waits its turn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage']) delete g[k];
  });

  it('is not drawn over a sheet that came up while it waited; the count has it all the same', async () => {
    const { moment, shown } = await launch();
    expect(moment.popOrbs({ key: 'train:run', date: TODAY, n: 3, from: rect(300, 440), id: 's', delay: 480, haptic: 'success' })).toBe(3);
    // the thumb lifted on another card and its sheet rose
    vi.advanceTimersByTime(300);
    moment.setOverlays(1);
    vi.advanceTimersByTime(300);
    expect(spawned).toHaveLength(0);
    expect(shown()).toBe(3);
  });

  it('is drawn when nothing came up', async () => {
    const { moment } = await launch();
    moment.popOrbs({ key: 'train:run', date: TODAY, n: 3, from: rect(300, 440), id: 's', delay: 480, haptic: 'success' });
    vi.advanceTimersByTime(500);
    expect(spawned).toHaveLength(3);
  });

  it('is not drawn once "Show Orbs when you earn them" was switched off, or the page was hidden', async () => {
    const a = await launch();
    a.moment.popOrbs({ key: 'train:run', date: TODAY, n: 3, from: rect(300, 440), id: 's', delay: 480 });
    a.store.setSwitches({ show: false });
    vi.advanceTimersByTime(500);
    expect(spawned).toHaveLength(0);
    const b = await launch();
    b.moment.popOrbs({ key: 'train:run', date: TODAY, n: 3, from: rect(300, 440), id: 's', delay: 480 });
    b.doc.hidden = true;
    vi.advanceTimersByTime(500);
    expect(spawned).toHaveLength(0);
  });
});

describe('toasts and the chip under the switches', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage']) delete g[k];
  });
  const monday = shiftDays(RULES.startsOn, 7);
  const pay = (a: Awaited<ReturnType<typeof launch>>, key: string, n: number) => {
    const cur = a.store.getOrbs()!;
    a.store.setOrbs({ ...cur, once: { ...cur.once, [key]: { on: TODAY, n } } });
    // the engine's event for a payment
    a.gain(key, n);
  };

  it('a toast that waited behind an Undo is not shown once Orbs were switched off meanwhile', async () => {
    const a = await launch();
    a.toast.showToast('Goal set', { label: 'Undo', fn: () => undefined });
    pay(a, `challenge:d:${TODAY}`, 5);
    expect(a.toast.toastStore.get()!.text).toBe('Goal set');
    a.store.setSwitches({ on: false });
    vi.advanceTimersByTime(11_000);
    expect(a.toast.toastStore.get()).toBeNull();
    // and it does not come back when they are switched on again
    a.store.setSwitches({ on: true });
    vi.advanceTimersByTime(5000);
    expect(a.toast.toastStore.get()).toBeNull();
  });

  it('shows it after the Undo when the switches stand', async () => {
    const a = await launch();
    a.toast.showToast('Goal set', { label: 'Undo', fn: () => undefined });
    pay(a, `challenge:d:${TODAY}`, 5);
    vi.advanceTimersByTime(10_100);
    expect(a.toast.toastStore.get()!.text).toBe('Today’s challenge, done. 5 Orbs');
  });

  it('a toast of ours covered by an Undo before it could be read comes back once, after it', async () => {
    const a = await launch();
    pay(a, `week:${monday}`, 5);
    const ours = a.toast.toastStore.get()!.text;
    expect(ours).toMatch(/5 Orbs$/);
    vi.advanceTimersByTime(800);
    a.toast.showToast('Done', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(10_100);
    expect(a.toast.toastStore.get()!.text).toBe(ours);
    // covered again: it has had its turn
    vi.advanceTimersByTime(500);
    a.toast.showToast('Deleted', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(10_100);
    expect(a.toast.toastStore.get()).toBeNull();
  });

  it('a toast of ours that was read (covered after 2.5 s) does not come back', async () => {
    const a = await launch();
    pay(a, `week:${monday}`, 5);
    vi.advanceTimersByTime(3000);
    a.toast.showToast('Done', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(10_100);
    expect(a.toast.toastStore.get()).toBeNull();
  });

  it('the full day’s chip is not shown when the switch went off while it waited for the Orb to land', async () => {
    const a = await launch();
    a.moment.setCounter(a.counter);
    a.moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 't' });
    a.gain('todo', 1);
    a.gain('full', 5);
    a.store.setSwitches({ show: false });
    vi.advanceTimersByTime(3000);
    expect(chips).toHaveLength(0);
  });

  it('the full day’s chip shows once, after the Orb', async () => {
    const a = await launch();
    a.moment.setCounter(a.counter);
    a.moment.popOrbs({ key: 'todo', date: TODAY, n: 1, from: rect(300, 500), id: 't' });
    a.gain('todo', 1);
    a.gain('full', 5);
    expect(chips).toHaveLength(0);
    vi.advanceTimersByTime(3000);
    expect(chips).toHaveLength(1);
    a.gain('full', 5);
    vi.advanceTimersByTime(3000);
    expect(chips).toHaveLength(1);
  });
});
