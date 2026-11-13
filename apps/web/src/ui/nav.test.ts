import { describe, expect, it } from 'vitest';
import { isFitnessPath } from '@/lib/prefs';
import { impliesRoot, matchRoute, resolveRoute, ROUTES, shownTabs, TABS, type NavState, type PushedEntry } from './nav';

/** docs/feel.md §1.2 and contracts §A.1: every route of the table and every redirect resolves to its target. */
describe('the route table', () => {
  it('has the four tabs in order, Journal last, and no tab named Learned or Progress', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'goals', 'plan', 'journal']);
    expect(TABS.map((t) => t.root)).toEqual(['/today', '/goals', '/plan', '/journal']);
    expect(TABS.map((t) => t.label)).toEqual(['Today', 'Goals', 'Fitness', 'Journal']);
    expect(shownTabs(true)).toEqual(TABS);
    expect(shownTabs(false).map((t) => t.label)).toEqual(['Today', 'Goals', 'Journal']);
  });

  it.each([
    ['/today', 'root', 'today', '/today'],
    ['/today/2026-10-24', 'root', 'today', '/today/2026-10-24'],
    ['/goals', 'root', 'goals', '/goals'],
    ['/plan', 'root', 'plan', '/plan'],
    ['/plan/week/2026-10-26', 'root', 'plan', '/plan/week/2026-10-26'],
    ['/plan/month/2026-11-01', 'root', 'plan', '/plan/month/2026-11-01'],
    ['/journal', 'root', 'journal', '/journal'],
  ])('%s is a %s of %s', (path, kind, tab, root) => {
    const m = matchRoute(path);
    expect(m.kind).toBe(kind);
    expect(m.tab).toBe(tab);
    expect(m.root).toBe(root);
    expect(m.stack).toEqual([]);
  });

  it('a month of the journal is pushed over the tab, titled by its month, with the month as its param', () => {
    const m = matchRoute('/journal/2026-09');
    expect(m).toMatchObject({ kind: 'pushed', tab: 'journal', root: '/journal' });
    expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/journal/2026-09', 1, 'September 2026', -1]]);
    expect(m.stack[0]!.params).toEqual({ month: '2026-09' });
    // it sits over whatever the tab shows: a jump to it never moves the root
    expect(impliesRoot(m)).toBe(false);
    expect(matchRoute('/journal/2026-09/').kind).toBe('pushed');
    expect(matchRoute('/journal/1900-01').kind).toBe('pushed');
    expect(matchRoute('/journal/2199-12').kind).toBe('pushed');
  });

  it.each([
    ['a thirteenth month', '/journal/2026-13'],
    ['month zero', '/journal/2026-00'],
    ['a day', '/journal/2026-09-01'],
    ['a year alone', '/journal/2026'],
    ['one digit of month', '/journal/2026-9'],
    ['a word', '/journal/banana'],
    ['a year no one logged', '/journal/0000-01'],
    ['a year past the calendar the app prints', '/journal/2200-01'],
    ['five digits of year', '/journal/12026-09'],
    ['a month with something after it', '/journal/2026-09/extra'],
    ['bad percent-encoding', '/journal/%ZZ'],
    ['an encoded slash', '/journal/2026-09%2F01'],
    ['a space', '/journal/2026-09%20'],
    ['a name every object has', '/journal/constructor'],
  ])('a month that is not a real YYYY-MM (%s) goes to the tab', (_name, path) => {
    expect(matchRoute(path)).toMatchObject({ kind: 'redirect', redirect: '/journal' });
    expect(resolveRoute(path)).toMatchObject({ kind: 'root', tab: 'journal', path: '/journal', stack: [] });
  });

  it('What I learned is part of Journal: its tab opens Journal, and a month of it opens that month of the journal', () => {
    expect(matchRoute('/learned')).toMatchObject({ kind: 'redirect', redirect: '/journal' });
    expect(resolveRoute('/learned')).toMatchObject({ kind: 'root', tab: 'journal', path: '/journal' });
    // the old month pages were named by the first of the month; a bare month works too
    for (const old of ['/learned/2026-10-01', '/learned/2026-10', '/learned/2026-10-01/']) {
      expect(matchRoute(old)).toMatchObject({ kind: 'redirect', redirect: '/journal/2026-10' });
      const r = resolveRoute(old);
      expect(r).toMatchObject({ kind: 'pushed', tab: 'journal', root: '/journal', path: '/journal/2026-10' });
      expect(r.stack.map((e) => [e.path, e.title, e.params.month])).toEqual([['/journal/2026-10', 'October 2026', '2026-10']]);
    }
    // anything else under the old tab is the tab: never Today, never a blank
    for (const bad of ['/learned/2026-10-14', '/learned/2026-13', '/learned/banana', '/learned/2026-10-01/x', '/learned/%ZZ', '/learned/9999-12-01']) expect(resolveRoute(bad)).toMatchObject({ kind: 'root', tab: 'journal', path: '/journal' });
  });

  it('Progress is part of Fitness: its tab opens Fitness, and a metric page keeps its address, pushed over Fitness', () => {
    expect(matchRoute('/progress')).toMatchObject({ kind: 'redirect', redirect: '/plan' });
    expect(resolveRoute('/progress')).toMatchObject({ kind: 'root', tab: 'plan', path: '/plan', stack: [] });
    for (const [id, title] of [['mileage', 'Weekly mileage'], ['pace', 'Run pace'], ['consistency', 'Consistency'], ['lifts', 'Lift volume'], ['sleep', 'Sleep'], ['hrv', 'HRV'], ['rhr', 'Resting HR']] as const) {
      const m = matchRoute(`/progress/metric/${id}`);
      expect(m).toMatchObject({ kind: 'pushed', tab: 'plan', root: '/plan' });
      expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([[`/progress/metric/${id}`, 1, title, -1]]);
      expect(m.stack[0]!.params).toEqual({ id });
      // it sits over whatever week Fitness shows: a jump to it never moves Fitness's root
      expect(impliesRoot(m)).toBe(false);
    }
    // anything else under the old tab is Fitness: never Today (with Fitness on), never a blank
    for (const bad of ['/progress/metric', '/progress/metric/nope', '/progress/metric/sleep/more', '/progress/weeks', '/progress/%ZZ', '/progress/metric/%ZZ', '/progress/metric/constructor']) expect(resolveRoute(bad)).toMatchObject({ kind: 'root', tab: 'plan', path: '/plan' });
  });

  it('Journal’s older links still resolve, ahead of its month page: Reads under Settings, the removed Library on Journal', () => {
    expect(resolveRoute('/journal/reads')).toMatchObject({ kind: 'pushed', tab: 'today', path: '/settings/reads' });
    expect(resolveRoute('/journal/reads/read')).toMatchObject({ kind: 'pushed', tab: 'today', path: '/settings/reads/read' });
    expect(resolveRoute('/journal/reads').stack.map((e) => e.path)).toEqual(['/settings', '/settings/reads']);
    // not one of them is read as a month
    for (const old of ['/journal/reads', '/journal/library', '/journal/quotes', '/journal/favorites']) expect(matchRoute(old).route?.pattern).not.toBe('/journal/:month');
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
    ['/learned', '/journal'],
    ['/learned/2026-10', '/journal/2026-10'],
    ['/learned/2026-10-01', '/journal/2026-10'],
    ['/learned/2026-10-02', '/journal'],
    ['/journal/2026-13', '/journal'],
    ['/journal/2026-10-01', '/journal'],
    ['/journal/2026-10/more', '/journal'],
    ['/plan/plans', '/settings/plans'],
    ['/settings/routine', '/settings'],
    ['/settings/banana', '/settings'],
    ['/trends', '/plan'],
    ['/progress', '/plan'],
    ['/progress/', '/plan'],
    ['/progress/metric', '/plan'],
    ['/progress/metric/bogus', '/plan'],
    ['/progress/elsewhere', '/plan'],
    ['/setup', '/signup'],
    ['/today/banana', '/today'],
    ['/today/2026-02-30', '/today'],
    // a real date at the calendar's edge: the day after it is not a date the app can print (the page crashed on it)
    ['/today/9999-12-31', '/today'],
    ['/today/9999-12-31/morning', '/today'],
    ['/today/0000-01-01', '/today'],
    ['/today/0001-01-01', '/today'],
    ['/today/1899-12-31', '/today'],
    ['/today/2200-01-01', '/today'],
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
  it('a metric that does not exist goes to Fitness', () => {
    expect(matchRoute('/progress/metric/bogus')).toMatchObject({ kind: 'redirect', redirect: '/plan' });
    expect(matchRoute('/progress/metric/toString')).toMatchObject({ kind: 'redirect', redirect: '/plan' });
    expect(matchRoute('/progress/metric/hrv').kind).toBe('pushed');
  });
  it('Reads opens only its two lists', () => {
    expect(matchRoute('/settings/reads/read').kind).toBe('pushed');
    expect(matchRoute('/settings/reads').kind).toBe('pushed');
    expect(matchRoute('/settings/reads/nope')).toMatchObject({ kind: 'redirect', redirect: '/settings' });
    expect(matchRoute('/journal/reads/nope')).toMatchObject({ kind: 'redirect', redirect: '/journal' });
  });
});

/** Edge cases: a URL from anywhere (a link, a typed address, a saved place) never throws and never names another site. */
describe('a malformed URL', () => {
  it('a doubled slash is one slash: the path can never be read as another site’s address', () => {
    expect(matchRoute('//today')).toMatchObject({ kind: 'root', tab: 'today', root: '/today' });
    expect(resolveRoute('///today//2026-10-24/').path).toBe('/today/2026-10-24');
    expect(resolveRoute('//evil.example/plan').path).toBe('/today');
    for (const p of ['//', '///', '//today', '/settings//training', '//settings///reads//read']) expect(resolveRoute(p).path.includes('//')).toBe(false);
  });
  it('bad percent-encoding does not throw: it fails its param’s check and goes to the tab', () => {
    expect(() => matchRoute('/today/%')).not.toThrow();
    expect(resolveRoute('/today/%').path).toBe('/today');
    expect(resolveRoute('/today/%E0%A4%A').path).toBe('/today');
    expect(resolveRoute('/learned/%ZZ').path).toBe('/journal');
    expect(resolveRoute('/journal/%E0%A4%A').path).toBe('/journal');
    expect(resolveRoute('/progress/metric/%').path).toBe('/plan');
  });
  it('nothing, a query alone, a fragment alone and a value that is not text all resolve to a page', () => {
    for (const p of ['', '?', '#', '?x=1#y', ' ', '/%20', '/\u202Etoday', '/' + 'a'.repeat(5000)]) expect(['root', 'pushed']).toContain(resolveRoute(p).kind);
    for (const p of [undefined, null, 5, {}, []]) expect(resolveRoute(p as unknown as string).path).toBe('/today');
  });
  it('every route resolves, with Fitness on and off, in at most a few hops', () => {
    for (const r of ROUTES) {
      const path = r.pattern.replace(':date?', '').replace(':date', '2026-10-24').replace(':mon', '2026-10-26').replace(':month', r.pattern.startsWith('/plan') ? '2026-11-01' : '2026-11').replace(':section', 'app').replace(':id', 'sleep').replace(':tab?', '').replace('/*', '').replace('*', 'nope');
      expect(['root', 'pushed', 'full']).toContain(resolveRoute(path).kind);
    }
  });
});
