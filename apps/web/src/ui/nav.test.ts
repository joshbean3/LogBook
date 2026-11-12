import { describe, expect, it } from 'vitest';
import { isFitnessPath } from '@/lib/prefs';
import { impliesRoot, matchRoute, resolveRoute, ROUTES, TABS, withoutFitness, type NavState, type PushedEntry } from './nav';

/** docs/feel.md §1.2 and contracts §A.1: every route of the table and every redirect resolves to its target. */
describe('the route table', () => {
  it('has the six tabs in order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'goals', 'learned', 'plan', 'progress', 'journal']);
    expect(TABS.map((t) => t.root)).toEqual(['/today', '/goals', '/learned', '/plan', '/progress', '/journal']);
  });

  it.each([
    ['/today', 'root', 'today', '/today'],
    ['/today/2026-10-24', 'root', 'today', '/today/2026-10-24'],
    ['/goals', 'root', 'goals', '/goals'],
    ['/learned', 'root', 'learned', '/learned'],
    ['/plan', 'root', 'plan', '/plan'],
    ['/plan/week/2026-10-26', 'root', 'plan', '/plan/week/2026-10-26'],
    ['/plan/month/2026-11-01', 'root', 'plan', '/plan/month/2026-11-01'],
    ['/progress', 'root', 'progress', '/progress'],
    ['/journal', 'root', 'journal', '/journal'],
  ])('%s is a %s of %s', (path, kind, tab, root) => {
    const m = matchRoute(path);
    expect(m.kind).toBe(kind);
    expect(m.tab).toBe(tab);
    expect(m.root).toBe(root);
    expect(m.stack).toEqual([]);
  });

  it('a month of What I learned is pushed over the tab, titled by its month; a bad month goes to the tab', () => {
    const m = matchRoute('/learned/2026-09-01');
    expect(m.kind).toBe('pushed');
    expect(m.tab).toBe('learned');
    expect(m.root).toBe('/learned');
    expect(m.stack.map((e) => e.title)).toEqual(['September 2026']);
    expect(matchRoute('/learned/2026-09-14')).toMatchObject({ kind: 'redirect', redirect: '/learned' });
  });

  it('Journal is one root: the removed Library and its old links land on Journal, with no segment', () => {
    expect(matchRoute('/journal').params).toEqual({});
    for (const old of ['/journal/library', '/journal/quotes', '/journal/favorites']) {
      expect(matchRoute(old)).toMatchObject({ kind: 'redirect', redirect: '/journal' });
      expect(resolveRoute(old)).toMatchObject({ kind: 'root', tab: 'journal', root: '/journal', params: {} });
    }
  });

  it('pushed pages imply their stacks, every implied entry with idx −1', () => {
    const morning = matchRoute('/today/2026-10-23/morning');
    expect(morning).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today/2026-10-23' });
    expect(morning.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/today/2026-10-23/morning', 1, 'This morning', -1]]);
    expect(morning.stack[0]!.params).toEqual({ date: '2026-10-23' });

    const settings = matchRoute('/settings');
    expect(settings).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(settings.stack.map((e) => [e.path, e.depth, e.idx])).toEqual([['/settings', 1, -1]]);

    for (const [section, title] of [['you', 'You'], ['training', 'Training'], ['habits', 'Habits'], ['plans', 'Plans'], ['connections', 'Data sources'], ['app', 'App'], ['data', 'Data'], ['account', 'Account'], ['privacy', 'Privacy']] as const) {
      const m = matchRoute(`/settings/${section}`);
      expect(m.kind).toBe('pushed');
      expect(m.tab).toBe('today');
      expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/settings', 1, 'Settings', -1], [`/settings/${section}`, 2, title, -1]]);
    }
    expect(matchRoute('/settings/plans').kind).toBe('pushed');

    // the saved links: pushed under Settings, so Settings stays lit and Back returns to it (layout plan C-4)
    const reads = matchRoute('/settings/reads');
    expect(reads).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(reads.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/settings', 1, 'Settings', -1], ['/settings/reads', 2, 'Saved links', -1]]);
    expect(matchRoute('/settings/reads/read').stack[1]!.params).toEqual({ tab: 'read' });

    const planMorning = matchRoute('/plan/morning');
    expect(planMorning).toMatchObject({ kind: 'pushed', tab: 'plan', root: '/plan' });
    expect(planMorning.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/plan/morning', 1, 'This morning', -1]]);
    expect(planMorning.stack[0]!.params).toEqual({});
    expect(matchRoute('/plan/morning/2026-11-05').stack[0]!.params).toEqual({ date: '2026-11-05' });
    // no date in its URL: a jump to it never moves the Habits root
    expect(impliesRoot(planMorning)).toBe(false);
    expect(impliesRoot(morning)).toBe(true);

    const ui = matchRoute('/dev/ui');
    expect(ui).toMatchObject({ kind: 'pushed', tab: 'today' });
    expect(ui.stack.map((e) => [e.depth, e.title, e.idx])).toEqual([[1, 'UI', -1]]);
  });

  it('full-screen routes belong to no tab', () => {
    for (const p of ['/welcome', '/welcome/plan', '/start', '/login', '/signup']) expect(matchRoute(p)).toMatchObject({ kind: 'full', tab: null });
  });

  it.each([
    ['/morning/2026-10-23', '/today/2026-10-23/morning'],
    ['/morning', '/today'],
    ['/morning/banana', '/today'],
    ['/reads', '/settings/reads'],
    ['/reads/read', '/settings/reads/read'],
    ['/journal/reads', '/settings/reads'],
    ['/journal/reads/read', '/settings/reads/read'],
    ['/journal/library', '/journal'],
    ['/journal/quotes', '/journal'],
    ['/journal/favorites', '/journal'],
    ['/plan/plans', '/settings/plans'],
    ['/settings/routine', '/settings'],
    ['/settings/banana', '/settings'],
    ['/trends', '/progress'],
    ['/setup', '/signup'],
    ['/today/banana', '/today'],
    ['/today/2026-02-30', '/today'],
    ['/today/banana/morning', '/today'],
    ['/plan/week/2026-10-27', '/plan'],
    ['/plan/month/2026-10-23', '/plan'],
    ['/habits', '/today'],
    ['/habits/morning', '/plan/morning'],
    ['/plan/morning/banana', '/plan'],
    ['/nowhere', '/today'],
    ['/', '/today'],
  ])('%s redirects to %s', (from, to) => {
    const m = matchRoute(from);
    expect(m.kind).toBe('redirect');
    expect(m.redirect).toBe(to);
    expect(resolveRoute(from).path).toBe(to);
  });

  it('ignores a trailing slash and the query', () => {
    expect(matchRoute('/plan/').kind).toBe('root');
    expect(matchRoute('/settings?strava=connected').kind).toBe('pushed');
  });

  it('lists every kind in the table', () => {
    expect(new Set(ROUTES.map((r) => r.kind))).toEqual(new Set(['root', 'pushed', 'full', 'redirect']));
  });
});

describe('bad route parameters fall back to the tab (shell-23)', () => {
  it('a metric that does not exist goes to Progress', () => {
    expect(matchRoute('/progress/metric/bogus')).toMatchObject({ kind: 'redirect', redirect: '/progress' });
    expect(matchRoute('/progress/metric/toString')).toMatchObject({ kind: 'redirect', redirect: '/progress' });
    expect(matchRoute('/progress/metric/hrv').kind).toBe('pushed');
  });
  it('Reads opens only its two lists', () => {
    expect(matchRoute('/settings/reads/read').kind).toBe('pushed');
    expect(matchRoute('/settings/reads').kind).toBe('pushed');
    expect(matchRoute('/settings/reads/nope')).toMatchObject({ kind: 'redirect', redirect: '/settings' });
    expect(matchRoute('/journal/reads/nope')).toMatchObject({ kind: 'redirect', redirect: '/journal' });
  });
});

/**
 * Fitness switched off while one of its pages is open: the switch in Settings with a Running page left open under the
 * Progress tab, or the account's copy arriving on a new device that opened on /plan. The tab bar drops Fitness at once;
 * without this the tab that was lit had no page (a blank screen), and the Progress tab kept the Running page.
 */
describe('withoutFitness: no open page is a Fitness page once Fitness is off', () => {
  const entry = (path: string, idx = 3): PushedEntry => ({ key: `${path}#1`, path, title: '', depth: 1, idx, params: {} });
  const state = (active: NavState['active'], over: Partial<NavState['tabs']> = {}): NavState => ({
    active,
    overlays: 0,
    tabs: { today: { path: '/today', stack: [] }, goals: { path: '/goals', stack: [] }, learned: { path: '/learned', stack: [] }, plan: { path: '/plan', stack: [] }, progress: { path: '/progress', stack: [] }, journal: { path: '/journal', stack: [] }, ...over },
  });
  it('leaves a state with no Fitness page as it is (the same object)', () => {
    const st = state('today', { today: { path: '/today', stack: [entry('/settings')] }, plan: { path: '/plan/week/2027-03-01', stack: [] }, progress: { path: '/progress', stack: [entry('/progress/metric/sleep')] } });
    expect(withoutFitness(st)).toBe(st);
  });
  it('the Fitness tab lit: Today is, and the week it was on is kept for when Fitness comes back', () => {
    const next = withoutFitness(state('plan', { plan: { path: '/plan/week/2027-03-01', stack: [] } }));
    expect(next.active).toBe('today');
    expect(next.tabs.plan.path).toBe('/plan/week/2027-03-01');
  });
  it('a Fitness page pushed over another tab is taken off, with everything over it', () => {
    const st = state('today', {
      today: { path: '/today', stack: [entry('/settings')] },
      progress: { path: '/progress', stack: [entry('/progress/metric/mileage')] },
    });
    const next = withoutFitness(st);
    expect(next.active).toBe('today');
    expect(next.tabs.progress.stack).toEqual([]);
    // Settings, where the switch is, stays
    expect(next.tabs.today.stack.map((e) => e.path)).toEqual(['/settings']);
    const deep = withoutFitness(state('today', { today: { path: '/today', stack: [entry('/settings', 1), entry('/settings/training', 2)] } }));
    expect(deep.tabs.today.stack.map((e) => e.path)).toEqual(['/settings']);
  });
  it('every page it leaves is one a cold open with Fitness off would show', () => {
    const st = state('progress', { progress: { path: '/progress', stack: [entry('/progress/metric/pace')] }, plan: { path: '/plan/month/2026-12-01', stack: [] } });
    const next = withoutFitness(st);
    for (const t of TABS) for (const e of next.tabs[t.id].stack) expect(isFitnessPath(e.path), e.path).toBe(false);
    expect(next.active).not.toBe('plan');
  });
});
