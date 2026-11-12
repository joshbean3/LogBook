import { monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bootstrap, MonthBundle } from '@/api/types';

// the toasts, the menu and the sheets draw into document.body through a portal: a static render has no body
vi.mock('react-dom', async (orig) => ({ ...(await orig<typeof import('react-dom')>()), createPortal: () => null }));

/**
 * Today's day page at its edges, rendered whole from a seeded cache (no network): the minutes after midnight while the
 * tab still holds the old day, and to-dos and goals in a shape the app never wrote. Each case is a page a person could be
 * looking at; none may throw, and none may print a wrong number.
 */
const D = '2026-11-12' as ISODate;

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const g = globalThis as unknown as Record<string, unknown>;
const had = { window: g.window, document: g.document, localStorage: g.localStorage, sessionStorage: g.sessionStorage, navigator: g.navigator };

const boot = (): Bootstrap =>
  ({
    user: { id: 'u1', email: 'sam@example.com', name: 'Sam', onboardedAt: '2026-01-01T00:00:00Z', trainingProfile: null, status: null },
    habits: [{ id: 'h1', name: 'Meditate', position: 0, createdOn: '2026-01-01', archivedOn: null }],
    blocks: [],
    morningSettings: undefined,
    zones: null,
    strava: { connected: false, athleteName: null, lastSyncAt: null, syncing: false, error: null, configured: false },
    features: { claude: false, strava: false },
    consent: { training: true, recall: true, reads: true, health: null, at: '2026-01-01T00:00:00Z', version: 1 },
    trainWhen: { when: 'morning', offWork: null },
  }) as unknown as Bootstrap;
const month = (m: string): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] }) as unknown as MonthBundle;
const goal = (period: ISODate, text: unknown) => ({ id: `g-${period}`, level: 'day', period, text, original: null, why: null, status: 'open', reflection: null, steps: [], createdAt: '', updatedAt: '', closedAt: null });
const todo = (id: string, text: unknown, extra: Record<string, unknown> = {}) => ({ id, text, note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: D, doneOn: null, deletedOn: null, createdAt: '2026-11-12T08:00:00Z', ...extra });

const render = async (seed: (qc: QueryClient) => void, held: ISODate = D): Promise<string> => {
  const { NEW_ACCOUNT_MORNING, normalizeMorningSettings } = await import('@logbook/shared');
  const { resetPrefsForTest, DEFAULT_PREFS } = await import('@/lib/prefs');
  resetPrefsForTest({ ...DEFAULT_PREFS, fitness: false });
  const [{ NavController, TabScope }, { ToastProvider }, { ContextMenuProvider }, { SheetProvider }, { TodayHold }, { DayPage }, { setLiveDate }] = await Promise.all([import('@/app/NavController'), import('@/ui/Toast'), import('@/ui/ContextMenu'), import('@/ui/Sheet'), import('@/lib/useToday'), import('./DayPage'), import('./live')]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(['bootstrap'], { ...boot(), morningSettings: normalizeMorningSettings(NEW_ACCOUNT_MORNING) });
  for (const m of new Set([-40, -8, 0, 8, 40].map((n) => monthOf(shiftDays(D, n))))) qc.setQueryData(['month', m], month(m));
  qc.setQueryData(['todos'], []);
  qc.setQueryData(['todo-groups'], []);
  qc.setQueryData(['goals'], []);
  qc.setQueryData(['learnings', 'stats'], { days: 0, streak: 0, total: 0, recent: [] });
  seed(qc);
  setLiveDate(held);
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/today']}>
        <NavController>
          <ToastProvider>
            <ContextMenuProvider>
              <SheetProvider>
                <TabScope tab="today">
                  <TodayHold value={held}>
                    <DayPage date={held} live onMorning={() => undefined} />
                  </TodayHold>
                </TabScope>
              </SheetProvider>
            </ContextMenuProvider>
          </ToastProvider>
        </NavController>
      </MemoryRouter>
    </QueryClientProvider>,
  ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
};

describe('Today’s day page at its edges', () => {
  beforeAll(() => {
    const noop = () => undefined;
    const el = () => ({ style: {}, setAttribute: noop, removeAttribute: noop, appendChild: noop, addEventListener: noop, removeEventListener: noop, classList: { add: noop, remove: noop, toggle: noop }, querySelector: () => null, querySelectorAll: () => [] });
    const local = mem();
    const session = mem();
    g.localStorage = local;
    g.sessionStorage = session;
    g.document = { ...el(), documentElement: el(), body: el(), createElement: el, hidden: false, visibilityState: 'visible', cookie: '' };
    g.window = Object.assign(g, {
      location: { pathname: '/today', search: '', hash: '', origin: 'http://localhost', href: 'http://localhost/today' },
      history: { state: null, replaceState: noop, pushState: noop, back: noop, go: noop, length: 1 },
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
      innerWidth: 390,
      innerHeight: 844,
      requestAnimationFrame: () => 0,
      getComputedStyle: () => ({ fontSize: '16px', getPropertyValue: () => '' }),
      cancelAnimationFrame: noop,
      localStorage: local,
      sessionStorage: session,
    });
    if (!had.navigator) g.navigator = { onLine: true, userAgent: 'test', maxTouchPoints: 0 };
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(had)) if (v === undefined) delete g[k];
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  it('a day with a goal and to-dos reads as it should (the page renders at all)', async () => {
    at('2026-11-12T10:00:00');
    const html = await render((qc) => {
      qc.setQueryData(['goals'], [goal(D, 'Ship the thing')]);
      qc.setQueryData(['todos'], [todo('t1', 'Call the bank'), todo('t2', 'Renew passport', { position: 1 })]);
    });
    expect(html).toMatch(/Ship the thing[\s\S]*14 h left[\s\S]*0 of 2 done[\s\S]*Next[\s\S]*Call the bank[\s\S]*Renew passport[\s\S]*Add a to-do/);
  }, 60_000);

  it('held past midnight, the old day is at its last minute: never "24 h left", never Close yesterday for the day before', async () => {
    // 00:01 on the 13th, and the tab still shows the 12th as Today (a draft, an open sheet or a busy thumb holds the rollover)
    at('2026-11-13T00:01:00');
    const html = await render((qc) => qc.setQueryData(['goals'], [goal(D, 'Ship the thing')]));
    expect(html).toContain('Ship the thing');
    expect(html).not.toContain('24 h left');
    expect(html).toContain('1 min left');
    // "yesterday" here would be the 11th: the day the person means to close is the one still on screen
    expect(html).not.toContain('Close yesterday');
    // the evening's row stays, as it was a minute before midnight
    expect(html).toContain('Set tomorrow’s goal');
  }, 60_000);

  it('once the day has rolled, the new day starts on the real clock, with Close yesterday', async () => {
    at('2026-11-13T00:01:00');
    const html = await render((qc) => qc.setQueryData(['goals'], [goal('2026-11-13' as ISODate, 'A new day')]), '2026-11-13' as ISODate);
    expect(html).toContain('24 h left');
    expect(html).toContain('Close yesterday');
  }, 60_000);

  it('to-dos in a shape the app never wrote do not take the page down', async () => {
    at('2026-11-12T10:00:00');
    // not a list at all (a proxy's error page saved as the answer)
    const none = await render((qc) => qc.setQueryData(['todos'], { error: 'nope' }));
    expect(none).toMatch(/What would make today count\?[\s\S]*Habits/);
    // a list with rows that are not to-dos: they are left out, the good one stays
    const some = await render((qc) => qc.setQueryData(['todos'], [null, 7, { id: 't0' }, todo('t1', null), todo('', 'No id'), todo('t2', 'Call the bank'), todo('t3', 'No dates', { createdOn: null, position: 'x', priority: 9, bucket: 'nowhere' })]));
    expect(some).toMatch(/An idea · from your to-dos[\s\S]*Call the bank/);
  }, 60_000);

  it('a month that could not be read says so, with Try again: never a skeleton that stays', async () => {
    at('2026-11-12T10:00:00');
    const html = await render((qc) => {
      // a cold start on a bad connection: the day's month failed and nothing is saved for it
      qc.removeQueries({ queryKey: ['month', '2026-11'] });
      // a static render has no mount: the query stays as it failed, as it does on screen once its tries are spent
      qc.setQueryDefaults(['month'], { retryOnMount: false });
      qc.getQueryCache().build(qc, { queryKey: ['month', '2026-11'] }).setState({ status: 'error', fetchStatus: 'idle', error: new Error('offline'), errorUpdateCount: 3, fetchFailureCount: 3 });
    });
    expect(html).toMatch(/Not loaded[\s\S]*Check your connection\.[\s\S]*Try again/);
  }, 60_000);

  it('the What I learned row reads its count from any answer, or from none', async () => {
    at('2026-11-12T10:00:00');
    for (const stats of [undefined, null, {}, { recent: null }, { recent: 'x' }, { recent: { a: 1 } }, { recent: [D] }]) {
      const html = await render((qc) => qc.setQueryData(['learnings', 'stats'], stats));
      expect(html).toContain('What did you learn today?');
      expect(html).toContain(Array.isArray((stats as { recent?: unknown } | null | undefined)?.recent) ? 'Tonight’s line is kept' : 'One line is enough');
    }
  }, 60_000);

  it('goals in a shape the app never wrote do not take the page down', async () => {
    at('2026-11-12T10:00:00');
    const html = await render((qc) => qc.setQueryData(['goals'], [null, { id: 'g0' }, goal(D, null), goal(shiftDays(D, -1), 42), { ...goal(shiftDays(D, -2), 'Older'), steps: 'no' }]));
    expect(html).toMatch(/What would make today count\?[\s\S]*Habits/);
  }, 60_000);
});
