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
    ['a tab this build does not have, and none of its own', JSON.stringify({ at: Date.now(), active: 'learned', tabs: { learned: { path: '/learned', stack: [{ path: '/learned/2026-10-01' }] }, library: { path: '/journal/library', stack: [] } } })],
    ['a tab whose saved root is another tab’s old page', JSON.stringify({ at: Date.now(), active: 'journal', tabs: { journal: { path: '/learned', stack: [] }, goals: { path: '/learned/2026-10-01', stack: [] } } })],
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
    for (const p of ['//goals', '/today/%', '///', '/learned/%ZZ', '/journal/%ZZ']) expect(() => ctl.go(p)).not.toThrow();
    expect(entry.url.includes('//')).toBe(false);
  });
});

/**
 * What I learned was a tab until it became part of Journal. A phone that ran the older build may still hold its places:
 * the session's stacks (`logbook.stacks`) with a `learned` tab, the last place (`logbook.nav`) on one of its pages, a
 * history entry or a link with its address. Every one opens Journal (or the month of it), and none leaves a tab the
 * shell does not draw.
 */
describe('places saved by the build that had a What I learned tab', () => {
  const TAB_IDS = ['today', 'goals', 'plan', 'progress', 'journal'];
  const page = (path: string, title: string, params: Record<string, string> = {}) => ({ key: `${path}#1`, path, title, depth: 1, idx: 1, params });
  /** The record that build wrote: six tabs, the Learned one active, a month page pushed over it. */
  const oldStacks = (at = Date.now()) =>
    JSON.stringify({
      at,
      active: 'learned',
      tabs: {
        today: { path: '/today', stack: [] },
        goals: { path: '/goals', stack: [] },
        learned: { path: '/learned', stack: [page('/learned/2026-10-01', 'October 2026', { month: '2026-10-01' })] },
        plan: { path: '/plan/week/2026-10-26', stack: [] },
        progress: { path: '/progress', stack: [] },
        journal: { path: '/journal', stack: [] },
      },
    });
  const whole = (ctl: Controller) => {
    expect(Object.keys(ctl.state.tabs).sort()).toEqual([...TAB_IDS].sort());
    expect(TAB_IDS).toContain(ctl.state.active);
    for (const t of Object.values(ctl.state.tabs)) {
      expect(typeof t.path).toBe('string');
      expect(Array.isArray(t.stack)).toBe(true);
      expect(t.path.startsWith('/learned')).toBe(false);
      for (const e of t.stack) expect(e.path.startsWith('/learned')).toBe(false);
    }
  };

  it('a reload on the old tab opens Journal, and the URL follows', () => {
    const entry = browser('/learned');
    (g.sessionStorage as Storage).setItem('logbook.stacks', oldStacks());
    const ctl = new Controller();
    expect(() => ctl.sync()).not.toThrow();
    expect(ctl.state.active).toBe('journal');
    expect(ctl.state.tabs.journal).toEqual({ path: '/journal', stack: [] });
    expect(entry.url).toBe('/journal');
    whole(ctl);
    // the other tabs stay where that session left them
    expect(ctl.state.tabs.plan.path).toBe('/plan/week/2026-10-26');
  });

  it('a reload on one of its month pages opens that month of the journal, pushed over Journal', () => {
    const entry = browser('/learned/2026-10-01');
    (g.sessionStorage as Storage).setItem('logbook.stacks', oldStacks());
    const ctl = new Controller();
    expect(() => ctl.sync()).not.toThrow();
    expect(ctl.state.active).toBe('journal');
    expect(ctl.state.tabs.journal.path).toBe('/journal');
    expect(ctl.state.tabs.journal.stack.map((e) => [e.path, e.title, e.params.month])).toEqual([['/journal/2026-10', 'October 2026', '2026-10']]);
    expect(entry.url).toBe('/journal/2026-10');
    whole(ctl);
  });

  it('the record names Learned as the tab on screen, the URL another tab: the URL rules and nothing is blank', () => {
    for (const [url, tab] of [['/goals', 'goals'], ['/today', 'today'], ['/journal', 'journal'], ['/progress', 'progress']] as const) {
      const entry = browser(url);
      (g.sessionStorage as Storage).setItem('logbook.stacks', oldStacks());
      const ctl = new Controller();
      expect(() => ctl.sync()).not.toThrow();
      expect(ctl.state.active).toBe(tab);
      expect(entry.url).toBe(url);
      whole(ctl);
    }
  });

  it('a stale record (older than the session window) is read the same way', () => {
    const entry = browser('/learned/2026-10-01');
    (g.sessionStorage as Storage).setItem('logbook.stacks', oldStacks(Date.now() - 3 * 60 * 60_000));
    const ctl = new Controller();
    ctl.sync();
    expect(ctl.state.active).toBe('journal');
    expect(entry.url).toBe('/journal/2026-10');
    expect(ctl.state.tabs.plan.path).toBe('/plan');
    whole(ctl);
  });

  it.each([
    ['/learned', '/journal', 0],
    ['/learned/2026-10-01', '/journal/2026-10', 1],
    ['/learned/2026-10', '/journal/2026-10', 1],
    ['/learned/2026-10-17', '/journal', 0],
    ['/learned/nope', '/journal', 0],
  ])('a cold launch whose last place was %s reopens %s', (was, opens, layers) => {
    const entry = browser('/');
    (g.localStorage as Storage).setItem('logbook.nav', JSON.stringify({ at: Date.now(), path: was }));
    const ctl = new Controller();
    expect(() => ctl.sync()).not.toThrow();
    expect(ctl.state.active).toBe('journal');
    expect(ctl.state.tabs.journal.stack).toHaveLength(layers);
    expect(entry.url).toBe(opens);
    whole(ctl);
  });

  it('a jump, a push and Back onto an old address all land on Journal', () => {
    const { ctl, entry } = start('/today');
    ctl.go('/learned');
    expect(ctl.state.active).toBe('journal');
    expect(entry.url).toBe('/journal');
    // the old month link, pushed from the tab (as the page before the merge did) or jumped to from anywhere
    ctl.push('/learned/2026-09-01');
    expect(ctl.state.tabs.journal.stack.map((e) => e.path)).toEqual(['/journal/2026-09']);
    expect(entry.url).toBe('/journal/2026-09');
    ctl.go('/goals');
    ctl.go('/learned/2026-08-01');
    expect(ctl.state.active).toBe('journal');
    expect(ctl.state.tabs.journal.stack.map((e) => e.path)).toEqual(['/journal/2026-08']);
    // Back lands on a history entry the older build wrote
    ctl.go('/goals');
    entry.url = '/learned';
    entry.state = { nav: { idx: 0 } };
    expect(() => ctl.onPopState()).not.toThrow();
    expect(ctl.state.active).toBe('journal');
    expect(entry.url.startsWith('/journal')).toBe(true);
    whole(ctl);
  });

  it('the saved place is never written back with the old name', () => {
    const { ctl } = start('/learned/2026-10-01');
    const stacks = JSON.parse((g.sessionStorage as Storage).getItem('logbook.stacks')!) as { active: string; tabs: Record<string, unknown> };
    expect(stacks.active).toBe('journal');
    expect(Object.keys(stacks.tabs)).not.toContain('learned');
    expect(JSON.parse((g.localStorage as Storage).getItem('logbook.nav')!).path).toBe('/journal/2026-10');
    expect(ctl.state.active).toBe('journal');
  });
});
