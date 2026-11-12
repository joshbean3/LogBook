import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPrefsForTest, setFitness } from '@/lib/prefs';
import { Controller } from './NavController';

/**
 * Edge cases of the shell's state (the controller, without a screen): Fitness switched off while one of its pages is in
 * the state, a saved record in a shape this build does not write, and a URL that would name another site.
 */
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const g = globalThis as unknown as Record<string, unknown>;
const had = { window: g.window, sessionStorage: g.sessionStorage, localStorage: g.localStorage };
/** A browser's history, as far as the controller uses it: one entry, its state and its URL; a URL of another site is refused. */
const browser = (path: string) => {
  const entry = { state: null as unknown, url: path };
  const write = (state: unknown, _t: string, url?: string | URL | null) => {
    const u = String(url ?? entry.url);
    if (u.startsWith('//')) throw new Error(`SecurityError: ${u} is another origin`);
    entry.state = state;
    entry.url = u;
  };
  const history = { get state() { return entry.state; }, pushState: write, replaceState: write, go: () => undefined, back: () => undefined };
  const location = { get pathname() { return entry.url.split(/[?#]/)[0]!; }, get search() { return entry.url.includes('?') ? entry.url.slice(entry.url.indexOf('?')) : ''; } };
  g.window = { history, location, dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined };
  return entry;
};
const start = (path: string) => {
  const entry = browser(path);
  const ctl = new Controller();
  ctl.sync();
  return { ctl, entry };
};

beforeEach(() => {
  g.sessionStorage = mem();
  g.localStorage = mem();
  resetPrefsForTest(null);
});
afterEach(() => {
  resetPrefsForTest(null);
  Object.assign(g, had);
});

describe('Fitness switched off while the app is open', () => {
  it('on the Fitness tab: Today takes its place and the URL follows', () => {
    const { ctl, entry } = start('/plan/week/2026-10-26');
    expect(ctl.state.active).toBe('plan');
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state.active).toBe('today');
    expect(entry.url).toBe('/today');
  });

  it('on a page pushed over Fitness: the page goes with the tab', () => {
    const { ctl, entry } = start('/plan/morning');
    expect(ctl.state.tabs.plan.stack).toHaveLength(1);
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state.active).toBe('today');
    expect(ctl.state.tabs.plan.stack).toEqual([]);
    expect(entry.url).toBe('/today');
  });

  it('on a Fitness chart pushed over Progress: the chart comes off, Progress stays', () => {
    const { ctl, entry } = start('/progress/metric/mileage');
    expect(ctl.state.tabs.progress.stack.map((e) => e.path)).toEqual(['/progress/metric/mileage']);
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state.active).toBe('progress');
    expect(ctl.state.tabs.progress.stack).toEqual([]);
    expect(entry.url).toBe('/progress');
  });

  it('on a training page of Settings: it comes off, Settings stays', () => {
    const { ctl, entry } = start('/settings/training');
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state.active).toBe('today');
    expect(ctl.state.tabs.today.stack.map((e) => e.path)).toEqual(['/settings']);
    expect(entry.url).toBe('/settings');
  });

  it('a Fitness chart left open on a tab that is not on screen comes off too, and the URL stays', () => {
    const { ctl, entry } = start('/progress/metric/pace');
    ctl.go('/settings');
    expect(ctl.state.active).toBe('today');
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state.tabs.progress.stack).toEqual([]);
    expect(ctl.state.tabs.today.stack.map((e) => e.path)).toEqual(['/settings']);
    expect(entry.url).toBe('/settings');
  });

  it('with no Fitness page anywhere, nothing changes: the same state, no history write', () => {
    const { ctl, entry } = start('/progress/metric/sleep');
    const before = ctl.state;
    setFitness(false);
    ctl.fitnessOff();
    expect(ctl.state).toBe(before);
    expect(entry.url).toBe('/progress/metric/sleep');
  });

  it('with Fitness off, every Fitness address opens Today, and Back onto one does too', () => {
    setFitness(false);
    for (const p of ['/plan', '/fitness', '/plan/week/2026-10-26', '/plan/morning', '/settings/training', '/settings/plans', '/progress/metric/lifts', '/habits/morning']) {
      const { ctl, entry } = start(p);
      expect(ctl.state.active).toBe('today');
      expect(entry.url).toBe('/today');
    }
  });
});

describe('a cold start from anything saved or typed', () => {
  it.each([
    ['a number', '5'],
    ['a list', '[1,2]'],
    ['a string', '"x"'],
    ['null', 'null'],
    ['junk', '{"at":'],
    ['wrong types', JSON.stringify({ at: Date.now(), active: 7, tabs: { today: { path: 5, stack: 'x' }, goals: null, learned: [], plan: { path: {} }, progress: 3, journal: { path: '//evil.example' } } })],
    ['tabs that are not a record', JSON.stringify({ at: Date.now(), tabs: 9 })],
    ['a newer shape', JSON.stringify({ v: 4, at: String(Date.now()), stacks: [{ tab: 'today' }] })],
  ])('the saved tabs hold %s: the app opens where the URL says', (_name, raw) => {
    browser('/goals');
    (g.sessionStorage as Storage).setItem('logbook.stacks', raw);
    (g.localStorage as Storage).setItem('logbook.nav', raw);
    const ctl = new Controller();
    expect(() => ctl.sync()).not.toThrow();
    expect(ctl.state.active).toBe('goals');
    for (const t of Object.values(ctl.state.tabs)) expect(typeof t.path).toBe('string');
    expect(ctl.state.tabs.journal.path).toBe('/journal');
  });

  it('a path with a doubled slash opens its page under one slash (history refuses the other)', () => {
    const { ctl, entry } = start('//today');
    expect(ctl.state.active).toBe('today');
    expect(entry.url).toBe('/today');
  });

  it('a jump to a malformed address lands on a page and throws nothing', () => {
    const { ctl, entry } = start('/today');
    for (const p of ['//goals', '/today/%', '///', '/learned/%ZZ']) expect(() => ctl.go(p)).not.toThrow();
    expect(entry.url.includes('//')).toBe(false);
  });
});
