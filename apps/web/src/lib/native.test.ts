import { describe, expect, it, vi } from 'vitest';
import { deepLinkPath } from './native';

describe('deep links', () => {
  it.each([
    ['logbook://today', '/today'],
    ['logbook://goals', '/goals'],
    ['logbook://goals/', '/goals'],
    ['logbook://settings', '/settings'],
    ['logbook://settings/privacy', '/settings/privacy'],
    ['logbook://today/2026-11-10/morning', '/today/2026-11-10/morning'],
    // old addresses that the table redirects to a real page
    ['logbook://journal/reads', '/settings/reads'],
    // Journal, a month of it, and the links to the tab that became part of it
    ['logbook://journal', '/journal'],
    ['logbook://journal/2026-10', '/journal/2026-10'],
    ['logbook://journal/2026-13', '/journal'],
    ['logbook://learned', '/journal'],
    ['logbook://learned/2026-10-01', '/journal/2026-10'],
    ['logbook://learned/2026-10', '/journal/2026-10'],
    ['logbook://learned/nope', '/journal'],
    ['logbook://trends', '/progress'],
  ])('%s opens %s', (url, path) => {
    expect(deepLinkPath(url)).toBe(path);
  });

  it.each([
    'logbook://nowhere',
    'logbook://settings/account/delete',
    'logbook://login',
    'logbook://signup',
    'logbook://start',
    'logbook://welcome/plan',
    'https://example.com/settings',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('%s is ignored', (url) => {
    expect(deepLinkPath(url)).toBeNull();
  });

  it('a malformed link never throws and never yields a path with a doubled slash', () => {
    for (const url of ['logbook://today/%', 'logbook://learned/%E0%A4%A', 'logbook:////today', 'logbook://today//2026-11-10///morning', 'logbook://', 'logbook:', 'logbook:///', 'logbook://today/\u202E', `logbook://${'a'.repeat(5000)}`]) {
      let path: string | null = 'unset';
      expect(() => (path = deepLinkPath(url))).not.toThrow();
      if (path !== null) expect(path).toMatch(/^\/(?!\/)[^?]*$/);
      if (path !== null) expect(String(path).includes('//')).toBe(false);
    }
    expect(deepLinkPath('logbook:////today')).toBe('/today');
    expect(deepLinkPath('logbook://today/%')).toBe('/today');
  });

  it('drops the query string (a release build has no account connection to return from)', () => {
    expect(deepLinkPath('logbook://settings?strava=connected')).toBe('/settings');
    expect(deepLinkPath('logbook://goals?x=1#y')).toBe('/goals');
  });

  it('the gallery route exists only where the dev tools are built', async () => {
    // DEV is true under vitest, so the route is in the table here
    expect(deepLinkPath('logbook://dev/ui')).toBe('/dev/ui');
    // a release build: the flag is false, the table has no such route, and the link is ignored
    vi.resetModules();
    vi.doMock('./features', () => ({ DEV_TOOLS: false, STRAVA_BUILT: false, HEALTH_BUILT: true }));
    vi.doMock('@/lib/features', () => ({ DEV_TOOLS: false, STRAVA_BUILT: false, HEALTH_BUILT: true }));
    const release = await import('./native');
    const nav = await import('@/ui/nav');
    expect(nav.ROUTES.some((r) => r.pattern.startsWith('/dev'))).toBe(false);
    expect(nav.matchRoute('/dev/ui')).toMatchObject({ kind: 'redirect', redirect: '/today' });
    expect(release.deepLinkPath('logbook://dev/ui')).toBeNull();
    vi.doUnmock('./features');
    vi.doUnmock('@/lib/features');
    vi.resetModules();
  });
});
