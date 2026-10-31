import { describe, expect, it } from 'vitest';
import { matchRoute, resolveRoute, ROUTES, TABS } from './nav';

/** docs/feel.md §1.2 and contracts §A.1: every route of the table and every redirect resolves to its target. */
describe('the route table', () => {
  it('has the four tabs in order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'goals', 'plan', 'journal']);
    expect(TABS.map((t) => t.root)).toEqual(['/today', '/goals', '/plan', '/journal']);
  });

  it.each([
    ['/today', 'root', 'today', '/today'],
    ['/today/2026-10-24', 'root', 'today', '/today/2026-10-24'],
    ['/plan', 'root', 'plan', '/plan'],
    ['/plan/week/2026-10-26', 'root', 'plan', '/plan/week/2026-10-26'],
    ['/plan/month/2026-11-01', 'root', 'plan', '/plan/month/2026-11-01'],
    ['/journal', 'root', 'journal', '/journal'],
    ['/journal/2026-10', 'root', 'journal', '/journal/2026-10'],
  ])('%s is a %s of %s', (path, kind, tab, root) => {
    const m = matchRoute(path);
    expect(m.kind).toBe(kind);
    expect(m.tab).toBe(tab);
    expect(m.root).toBe(root);
    expect(m.stack).toEqual([]);
  });

  it('the old Journal segments, Progress and Reads redirect home (docs/system.md §2)', () => {
    expect(matchRoute('/journal').params).toEqual({});
    expect(resolveRoute('/journal/library').path).toBe('/journal');
    expect(resolveRoute('/journal/quotes').path).toBe('/journal');
    expect(resolveRoute('/journal/reads').path).toBe('/journal');
    expect(resolveRoute('/progress').path).toBe('/plan');
    expect(resolveRoute('/trends').path).toBe('/plan');
    expect(resolveRoute('/settings/plans').path).toBe('/plan');
    expect(matchRoute('/journal/2026-13').kind).toBe('redirect');
  });

  it('pushed pages imply their stacks, every implied entry with idx −1', () => {
    const morning = matchRoute('/today/2026-10-23/morning');
    expect(morning).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today/2026-10-23' });
    expect(morning.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/today/2026-10-23/morning', 1, 'This morning', -1]]);
    expect(morning.stack[0]!.params).toEqual({ date: '2026-10-23' });

    const settings = matchRoute('/settings');
    expect(settings).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(settings.stack.map((e) => [e.path, e.depth, e.idx])).toEqual([['/settings', 1, -1]]);

    for (const [section, title] of [['you', 'You'], ['training', 'Training'], ['habits', 'Habits'], ['connections', 'Connections'], ['notifications', 'Notifications'], ['app', 'App'], ['data', 'Data'], ['account', 'Account']] as const) {
      const m = matchRoute(`/settings/${section}`);
      expect(m.kind).toBe('pushed');
      expect(m.tab).toBe('today');
      expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/settings', 1, 'Settings', -1], [`/settings/${section}`, 2, title, -1]]);
    }

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
    ['/reads', '/journal'],
    ['/reads/read', '/journal'],
    ['/journal/quotes', '/journal'],
    ['/journal/favorites', '/journal'],
    ['/plan/plans', '/plan'],
    ['/settings/plans', '/plan'],
    ['/settings/routine', '/settings'],
    ['/settings/banana', '/settings'],
    ['/trends', '/plan'],
    ['/progress', '/plan'],
    ['/setup', '/signup'],
    ['/today/banana', '/today'],
    ['/today/2026-02-30', '/today'],
    ['/today/banana/morning', '/today'],
    ['/plan/week/2026-10-27', '/plan'],
    ['/plan/month/2026-10-23', '/plan'],
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
