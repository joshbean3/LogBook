import { monthOf, NEW_ACCOUNT_MORNING, normalizeMorningSettings, shiftDays, today as todayISO, type ISODate } from '@logbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bootstrap, MonthBundle } from '@/api/types';

// sheets, toasts and menus draw into document.body through a portal: a static render has no body, and none is open
vi.mock('react-dom', async (orig) => ({ ...(await orig<typeof import('react-dom')>()), createPortal: () => null }));

/**
 * The lower half of Fitness, drawn whole from an account's data (a static render, as lib/fitnessOff.test.tsx does for the
 * tab roots): Progress, then Trends, in that order, with the one Runs / Workouts switch, and never a box of nothing.
 */
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const g = globalThis as unknown as Record<string, unknown>;
const had = { window: g.window, document: g.document, localStorage: g.localStorage, sessionStorage: g.sessionStorage, navigator: g.navigator };

const T = todayISO() as ISODate;
const boot = (): Bootstrap =>
  ({
    user: { id: 'u1', email: 'sam@example.com', name: 'Sam', onboardedAt: '2026-01-01T00:00:00Z', trainingProfile: null, status: null },
    habits: [{ id: 'h1', name: 'Meditate', position: 0, createdOn: '2026-01-01', archivedOn: null }],
    blocks: [],
    morningSettings: normalizeMorningSettings(NEW_ACCOUNT_MORNING),
    zones: null,
    strava: null,
    features: { claude: true, strava: false },
    consent: { training: true, recall: true, reads: true, health: null, at: '2026-01-01T00:00:00Z', version: 1 },
    trainWhen: { when: 'morning', offWork: null },
  }) as unknown as Bootstrap;
type Fill = (m: string) => Partial<MonthBundle>;
const empty = (m: string): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] }) as unknown as MonthBundle;
/** Runs for five weeks (done, with their activities), a lift with sets last week, and a habit ticked this week. */
const trains: Fill = (m) => {
  const days = Array.from({ length: 35 }, (_, i) => shiftDays(T, -i - 1)).filter((d) => monthOf(d) === m);
  const runs = days.filter((_, i) => i % 2 === 0);
  return {
    sessions: runs.map((d) => ({ id: `s-${d}`, date: d, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, position: 0, mark: 'done', blockId: null, movedFrom: null })) as MonthBundle['sessions'],
    activities: runs.map((d) => ({ id: `a-${d}`, date: d, kind: 'run', name: 'Morning Run', sportType: 'Run', miles: 4.1, movingSec: 2200, elevFt: 80, avgHr: 140, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null, time: '06:40' })) as MonthBundle['activities'],
    lifts: monthOf(shiftDays(T, -3)) === m ? ([{ id: 'l1', date: shiftDays(T, -3), exercise: 'Squat', weight: 185, reps: 5, position: 0 }] as unknown as MonthBundle['lifts']) : [],
    checks: monthOf(shiftDays(T, -1)) === m ? ([{ habitId: 'h1', date: shiftDays(T, -1), done: true, note: null }] as MonthBundle['checks']) : [],
  };
};
const client = (fill: Fill | null, first: string | null) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(['bootstrap'], boot());
  for (let i = -8; i <= 2; i++) {
    const d = new Date(`${T.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const m = d.toISOString().slice(0, 7);
    qc.setQueryData(['month', m], { ...empty(m), ...(fill?.(m) ?? {}) });
  }
  qc.setQueryData(['lifts'], fill ? [{ id: 'l1', date: shiftDays(T, -3), exercise: 'Squat', weight: 185, reps: 5, position: 0 }] : []);
  qc.setQueryData(['activities'], []);
  qc.setQueryData(['progress', 'history-start'], { first });
  return qc;
};

const render = async (fill: Fill | null): Promise<string> => {
  const [{ NavController, TabScope }, { ToastProvider }, { ContextMenuProvider }, { SheetProvider }, { FitnessProgress }, { resetPrefsForTest, DEFAULT_PREFS }] = await Promise.all([
    import('@/app/NavController'),
    import('@/ui/Toast'),
    import('@/ui/ContextMenu'),
    import('@/ui/Sheet'),
    import('./FitnessProgress'),
    import('@/lib/prefs'),
  ]);
  resetPrefsForTest({ ...DEFAULT_PREFS, fitness: true });
  return renderToStaticMarkup(
    <QueryClientProvider client={client(fill, fill ? shiftDays(T, -35) : null)}>
      <MemoryRouter initialEntries={['/plan']}>
        <NavController>
          <ToastProvider>
            <ContextMenuProvider>
              <SheetProvider>
                <TabScope tab="plan">
                  <FitnessProgress />
                </TabScope>
              </SheetProvider>
            </ContextMenuProvider>
          </ToastProvider>
        </NavController>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&amp;|&nbsp;/g, ' ').replace(/\s+/g, ' ');

describe('Fitness, the lower half (FitnessProgress)', () => {
  beforeAll(() => {
    const noop = () => undefined;
    const el = () => ({ style: {}, setAttribute: noop, removeAttribute: noop, appendChild: noop, addEventListener: noop, removeEventListener: noop, classList: { add: noop, remove: noop, toggle: noop }, querySelector: () => null, querySelectorAll: () => [] });
    const local = mem();
    const session = mem();
    g.localStorage = local;
    g.sessionStorage = session;
    g.document = { ...el(), documentElement: el(), body: el(), createElement: el, hidden: false, visibilityState: 'visible', cookie: '' };
    g.window = Object.assign(g, {
      location: { pathname: '/plan', search: '', hash: '', origin: 'http://localhost', href: 'http://localhost/plan' },
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

  it('an account that trains: Progress with the chart, then Trends, each tile with a number', async () => {
    const html = await render(trains);
    const t = text(html);
    // the order: the section, its chart's headline, then the tiles
    expect(t).toMatch(/Progress[\s\S]*mi[\s\S]*Trends[\s\S]*Mileage[\s\S]*Plan kept[\s\S]*Lifts/);
    // the chart is a plain card here (the training card is the page's hero): no glow, no second hero
    expect(html).toContain('card ph ph-plain');
    expect(html).not.toMatch(/is-hero|has-glow/);
    // one switch, in the training card's words; the old pair is gone
    expect(html).toContain('aria-label="Runs or workouts"');
    expect(t).toMatch(/Runs\s+Workouts/);
    expect(t).not.toMatch(/Running|Strength/);
    // the habits tile is not here (it is on Today's History), and nothing reads as empty
    expect(t).not.toMatch(/Habits/);
    expect(t).not.toMatch(/None yet|No trends yet|Not set|No data/i);
    // without Apple Health readings the body's numbers are not on the page, and neither is a row asking to connect
    expect(t).not.toMatch(/Sleep|HRV|Resting HR|Connect Apple Health/);
    // every tile opens its metric page
    expect((html.match(/class="tile[^"]*pressable|<button[^>]*class="tile/g) ?? []).length).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('a brand-new account: one quiet row in the chart’s place, and no Trends at all', async () => {
    const html = await render(null);
    const t = text(html);
    expect(t).toMatch(/Progress\s+Your weeks draw here\s+After your first run or workout\./);
    // never an empty frame: no chart, no switch, no range control, no tiles, no second "nothing yet"
    expect(html).not.toMatch(/rb-plot|ph-seg|ph-range|class="tiles/);
    expect(t).not.toMatch(/Trends|No trends yet|None yet|Plan a week/);
  }, 60_000);
});
