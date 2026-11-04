import { describe, expect, it } from 'vitest';
import { impliesRoot, matchRoute, resolveRoute, ROUTES, TABS } from './nav';

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
    ['/journal/library', 'root', 'journal', '/journal/library'],
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

  it("Journal's two roots carry different params (the segment is page state, consumer review 1 #7)", () => {
    expect(matchRoute('/journal').params).toEqual({});
    expect(matchRoute('/journal/library').params).toEqual({ segment: 'library' });
    expect(resolveRoute('/journal/quotes').params).toEqual({ segment: 'library' });
  });

  it('pushed pages imply their stacks, every implied entry with idx −1', () => {
    const morning = matchRoute('/today/2026-10-23/morning');
    expect(morning).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today/2026-10-23' });
    expect(morning.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/today/2026-10-23/morning', 1, 'This morning', -1]]);
    expect(morning.stack[0]!.params).toEqual({ date: '2026-10-23' });

    const settings = matchRoute('/settings');
    expect(settings).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(settings.stack.map((e) => [e.path, e.depth, e.idx])).toEqual([['/settings', 1, -1]]);

    for (const [section, title] of [['you', 'You'], ['training', 'Training'], ['habits', 'Habits'], ['plans', 'Plans'], ['connections', 'Connections'], ['app', 'App'], ['data', 'Data'], ['account', 'Account']] as const) {
      const m = matchRoute(`/settings/${section}`);
      expect(m.kind).toBe('pushed');
      expect(m.tab).toBe('today');
      expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/settings', 1, 'Settings', -1], [`/settings/${section}`, 2, title, -1]]);
    }
    expect(matchRoute('/settings/plans').kind).toBe('pushed');

    const reads = matchRoute('/journal/reads');
    expect(reads).toMatchObject({ kind: 'pushed', tab: 'journal', root: '/journal' });
    expect(reads.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/journal/reads', 1, 'Reads', -1]]);
    expect(matchRoute('/journal/reads/read').stack[0]!.params).toEqual({ tab: 'read' });

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
    ['/reads', '/journal/reads'],
    ['/reads/read', '/journal/reads/read'],
    ['/journal/quotes', '/journal/library'],
    ['/journal/favorites', '/journal/library'],
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
