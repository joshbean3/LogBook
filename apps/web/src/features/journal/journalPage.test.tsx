import { monthOf, shiftDays, type ISODate, type JournalEntry, type Learning } from '@logbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { cellLabel, markVariant } from './Calendar';
import { monthParam } from './JournalMonth';
import { monthPath } from './JournalParts';

// the day is pinned before any module loads: the today store (lib/useToday.ts) reads the clock once, when it is imported,
// so a clock set in beforeAll came too late and the page drew the real day (the test failed the day after it was written)
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T20:30:00'));
});

// the toasts, the menu and the sheets draw into document.body through a portal: a static render has no body, and none of
// them is open on a first render, so the portal draws nothing here
vi.mock('react-dom', async (orig) => ({ ...(await orig<typeof import('react-dom')>()), createPortal: () => null }));

/**
 * The one Journal, rendered whole from the cache: what the tab says before tonight's line, after it, and in what order
 * its parts come. (The rules under it are days.test.ts; the Fitness-off walk of the same page is lib/fitnessOff.test.tsx.)
 */
const T = '2026-11-12' as ISODate;
const g = globalThis as unknown as Record<string, unknown>;
const had = { window: g.window, document: g.document, localStorage: g.localStorage, sessionStorage: g.sessionStorage, navigator: g.navigator };
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const line = (id: string, date: string, text: string, at = '20:00'): Learning => ({ id, date, text, createdAt: `${date}T${at}:00.000Z`, editedAt: null });
const entry = (id: string, date: string, text: string, at = '21:00', fav = false): JournalEntry => ({ id, date, text, createdAt: `${date}T${at}:00.000Z`, editedAt: null, fav });
const pages = (learnings: Learning[]) => ({ pages: [{ learnings, next: null }], pageParams: [null] });
const boot = () => ({ user: { id: 'u1', email: 'sam@example.com', name: 'Sam', onboardedAt: '2026-01-01T00:00:00Z', trainingProfile: null, status: null }, habits: [], blocks: [], morningSettings: undefined, zones: null, strava: { connected: false, athleteName: null, lastSyncAt: null, syncing: false, error: null, configured: false }, features: { claude: false, strava: false }, consent: { training: null, recall: null, reads: null, health: null, at: null, version: 1 }, trainWhen: { when: 'morning', offWork: null } }) as unknown as Bootstrap;
const month = (m: string, journal: JournalEntry[]): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: journal.filter((e) => monthOf(e.date) === m), coach: [] }) as unknown as MonthBundle;

const render = async (lines: Learning[], entries: JournalEntry[], extra: (qc: QueryClient) => void = () => undefined): Promise<string> => {
  const { resetPrefsForTest, DEFAULT_PREFS } = await import('@/lib/prefs');
  resetPrefsForTest({ ...DEFAULT_PREFS, fitness: false });
  (g.window as { location: { pathname: string } }).location.pathname = '/journal';
  const [{ NavController, TabScope }, { ToastProvider }, { ContextMenuProvider }, { SheetProvider }, Page, { NEW_ACCOUNT_MORNING, normalizeMorningSettings }] = await Promise.all([import('@/app/NavController'), import('@/ui/Toast'), import('@/ui/ContextMenu'), import('@/ui/Sheet'), import('./JournalView'), import('@logbook/shared')]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(['bootstrap'], { ...boot(), morningSettings: normalizeMorningSettings(NEW_ACCOUNT_MORNING) });
  for (const m of new Set([-40, -8, 0].map((n) => monthOf(shiftDays(T, n))))) qc.setQueryData(['month', m], month(m, entries));
  qc.setQueryData(['goals'], []);
  qc.setQueryData(['todos'], []);
  qc.setQueryData(['daily'], { date: T, memory: null, quote: null, pastCount: 0 });
  qc.setQueryData(['learnings', 'stats'], { days: new Set(lines.map((l) => l.date)).size, streak: 0, total: lines.length, recent: [] });
  for (const m of new Set([monthOf(T), monthOf(shiftDays(T, -6))])) qc.setQueryData(['learnings', 'list', { month: m, q: null }], pages(lines.filter((l) => monthOf(l.date) === m)));
  const byMonth = new Map<string, Learning[]>();
  for (const l of lines) byMonth.set(monthOf(l.date), [...(byMonth.get(monthOf(l.date)) ?? []), l]);
  qc.setQueryData(['learnings', 'months'], [...byMonth].map(([m, ls]) => ({ month: m, count: ls.length, days: new Set(ls.map((l) => l.date)).size, latest: '' })).sort((a, b) => (a.month < b.month ? 1 : -1)));
  qc.setQueryData(['learnings', 'echoes'], { yearAgo: null, monthAgo: null, random: null });
  qc.setQueryData(['journal', '', false], { entries, more: false, total: entries.length });
  qc.setQueryData(['recall', T], { item: null, eligible: 0 });
  // a server from before the merge: no count of both
  qc.setQueryData(['written', 'months'], null);
  extra(qc);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/journal']}>
        <NavController>
          <ToastProvider>
            <ContextMenuProvider>
              <SheetProvider>
                <TabScope tab="journal">
                  <Page.default />
                </TabScope>
              </SheetProvider>
            </ContextMenuProvider>
          </ToastProvider>
        </NavController>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const attrs = [...html.matchAll(/\saria-label="([^"]*)"/g)].map((m) => m[1]);
  return `${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')} ¦ ${attrs.join(' ¦ ')}`.replace(/&#x27;/g, '’');
};

describe('the Journal tab, whole', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T20:30:00'));
    const noop = () => undefined;
    const el = () => ({ style: {}, setAttribute: noop, removeAttribute: noop, appendChild: noop, addEventListener: noop, removeEventListener: noop, classList: { add: noop, remove: noop, toggle: noop }, querySelector: () => null, querySelectorAll: () => [] });
    const local = mem();
    const session = mem();
    g.localStorage = local;
    g.sessionStorage = session;
    g.document = { ...el(), documentElement: el(), body: el(), createElement: el, hidden: false, visibilityState: 'visible', cookie: '' };
    g.window = Object.assign(g, {
      location: { pathname: '/journal', search: '', hash: '', origin: 'http://localhost', href: 'http://localhost/journal' },
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
    vi.useRealTimers();
    for (const [k, v] of Object.entries(had)) if (v === undefined) delete g[k];
  });

  it('an account with nothing written: the question, a started field, one button, and no empty row anywhere', async () => {
    const page = await render([], []);
    expect(page).toMatch(/Journal[\s\S]*What did you learn today\?[\s\S]*One line is enough\.[\s\S]*Your first line lights tonight[\s\S]*Today I learned[\s\S]*Write a longer entry[\s\S]*Finish the line/);
    // in print: nothing that reads as missing, and none of the parts that need something written
    expect(page.split('¦')[0]).not.toMatch(/Not set|No entries|Nothing|No months|Remember when|days? written|What I learned|Today \d/);
    expect(page).not.toContain('Search your journal');
    // six days before tonight, each a button into its day
    expect(page.match(/\. Open the day/g)?.length).toBe(6);
    expect(page).toContain('Friday, Nov 6. Open the day');
  }, 60_000);

  it('before tonight’s line: the lights are lit by lines and by entries, and the months count both', async () => {
    const lines = [line('l1', shiftDays(T, -3), 'Easy days build the base.'), line('l0', '2026-10-20', 'October’s line.')];
    const entries = [entry('e1', shiftDays(T, -2), 'A long entry about Tuesday.'), entry('e2', shiftDays(T, -3), 'More about Monday.'), entry('e0', '2026-09-02', 'September, entries only.')];
    const page = await render(lines, entries);
    expect(page).toMatch(/What did you learn today\?[\s\S]*This week · 2 days written[\s\S]*Tonight’s line lights the third[\s\S]*Finish the line/);
    expect(page).toContain('2 days written this week: Monday and Tuesday. Tonight’s line is not written yet.');
    expect(page).toContain('Monday, Nov 9, written. Open the day');
    expect(page).toContain('Tuesday, Nov 10, written. Open the day');
    expect(page).toContain('Wednesday, Nov 11. Open the day');
    // today has nothing yet: no Today rows. The months, newest first, each with what it holds
    expect(page).not.toMatch(/Today \d/);
    expect(page).toMatch(/November[\s\S]*2 days written[\s\S]*October[\s\S]*1 day written[\s\S]*September[\s\S]*1 day written/);
    expect(page).toContain('November 2026, 2 days written: 1 line, 2 entries. Open');
    expect(page).toContain('Search your journal');
    expect(page).not.toMatch(/streak|in a row/i);
  }, 60_000);

  it('an entry today and no line: tonight is lit, the question still stands, and the entry is a row under the poster', async () => {
    const page = await render([], [entry('e1', T, 'Bike felt smooth today.', '18:00', true)]);
    expect(page).toMatch(/What did you learn today\?[\s\S]*This week[\s\S]*1 day written[\s\S]*Finish the line[\s\S]*Today[\s\S]*1 entry[\s\S]*Bike felt smooth today\./);
    expect(page).toContain('1 day written this week: today. Tonight’s line is not written yet.');
    expect(page).toMatch(/Entry, [^¦]*a Favorite\. Bike felt smooth today\./);
  }, 60_000);

  it('after the line: it is the poster’s title, the composer’s place invites more, and today’s other rows follow', async () => {
    const lines = [line('l2', T, 'A second line tonight.', '21:30'), line('l1', T, 'Starting slower is how long runs get finished.', '20:00'), line('l0', shiftDays(T, -1), 'Yesterday’s.')];
    const entries = [entry('e1', T, 'Forty minutes went by without checking the clock.', '21:00')];
    const page = await render(lines, entries);
    // the first line written is the headline; the second is a row with the entry, newest first
    expect(page).toMatch(/Starting slower is how long runs get finished\.[\s\S]*Tonight’s line is kept\.[\s\S]*This week[\s\S]*2[\s\S]*days written[\s\S]*3 lines kept[\s\S]*Write more about today[\s\S]*Today[\s\S]*1 line, 1 entry[\s\S]*A second line tonight\.[\s\S]*Line[\s\S]*Forty minutes went by/);
    expect(page).toContain('Starting slower is how long runs get finished. Edit tonight’s line');
    expect(page).not.toMatch(/What did you learn today\?|Finish the line|Write a longer entry/);
  }, 60_000);

  it('one list failed: the poster and its field still stand, and the page says so once', async () => {
    const page = await render([line('l1', shiftDays(T, -1), 'Kept.')], [], (qc) => {
      qc.removeQueries({ queryKey: ['journal', '', false] });
      qc.setQueryDefaults(['journal'], { retryOnMount: false });
      qc.getQueryCache().build(qc, { queryKey: ['journal', '', false] }).setState({ status: 'error', fetchStatus: 'idle', error: new Error('offline'), errorUpdateCount: 3, fetchFailureCount: 3 });
    });
    expect(page).toMatch(/What did you learn today\?[\s\S]*Finish the line[\s\S]*Couldn’t load your journal\.[\s\S]*Try again/);
    expect(page.match(/Couldn’t load/g)?.length).toBe(1);
  }, 60_000);
});

describe('a month’s page: its address and its calendar', () => {
  it('reads the month from the address, in either form, and falls back to this month', () => {
    expect(monthParam('2026-10', T)).toBe('2026-10');
    expect(monthParam('2026-10-01', T)).toBe('2026-10');
    for (const bad of [undefined, '', '2026-13', '2026-10-02', 'october', '0001-01', '9999-12', '2026-1']) expect(monthParam(bad, T)).toBe('2026-11');
    expect(monthPath('2026-10')).toBe('/journal/2026-10');
    expect(monthPath('2026-10-17')).toBe('/journal/2026-10');
  });
  it('marks a day by how much was written, a Favorite first, and says it in words', () => {
    expect(markVariant(undefined)).toBeNull();
    expect(markVariant({ lines: 0, entries: 0, fav: false })).toBeNull();
    expect(markVariant({ lines: 1, entries: 0, fav: false })).toBe('sky');
    expect(markVariant({ lines: 1, entries: 1, fav: false })).toBe('dusk');
    expect(markVariant({ lines: 1, entries: 2, fav: false })).toBe('tide');
    expect(markVariant({ lines: 0, entries: 1, fav: true })).toBe('sun');
    expect(cellLabel('2026-11-12', { lines: 1, entries: 2, fav: true }, T)).toBe('12, Thursday, today, 1 line, 2 entries, a Favorite');
    expect(cellLabel('2026-11-10', undefined, T)).toBe('10, Tuesday, nothing written. Write this day');
    // a day still to come is not offered
    expect(cellLabel('2026-11-13', undefined, T)).toBe('13, Friday, nothing written');
  });
});
