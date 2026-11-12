import { monthOf, shiftDays, today as todayISO, type ISODate } from '@logbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bootstrap, MonthBundle } from '@/api/types';

// the toasts, the menu and the sheets draw into document.body through a portal: a static render has no body, and none of
// them is open on a first render, so the portal draws nothing here
vi.mock('react-dom', async (orig) => ({ ...(await orig<typeof import('react-dom')>()), createPortal: () => null }));

/**
 * Fitness off, the whole screen: each main screen is rendered from an account that trains (a plan, runs, lifts, a Strava
 * connection, a training status) with the Fitness switch off, and what a person would read or hear must not speak of
 * training. It fails on run, lift, mile, plan, training, workout, Strava or fitness as whole words, with their plain forms.
 * The same render with Fitness on must say them, so the test cannot pass by rendering nothing.
 *
 * Allowed, and why:
 *  - "Plan your day", "Plan the day", "The plan": Today's own section (the goal and the to-dos), not a training plan.
 *    With Fitness off it leads Today as the day's poster, and the goal it suggests comes from the habits, never from
 *    the day's session ("An idea · from your habits"): the Today row below asks for exactly that.
 *  - The Fitness row in Settings ("Fitness", "Training plan, runs and lifts"): the switch that turns it back on has to
 *    say its name.
 * Words the person typed (a to-do, a habit's name, an entry) are theirs and are shown as written; the account here has
 * none that name training, so nothing is excused for it. The live walk of the running app is scripts/check-fitness-off.mjs.
 */
const WORDS = /\b(run|runs|running|ran|runner|lift|lifts|lifting|mile|miles|mi|mileage|plan|plans|planned|training|train|workout|workouts|strava|fitness)\b/gi;
const ALLOWED = ['Plan your day', 'Plan the day', 'The plan', '>Fitness<', 'aria-label="Fitness"', 'Training plan, runs and lifts'];

/** What a page says: its text, and every label, placeholder, title and alt. Markup, class names and paths are not words. */
const said = (html: string): string => {
  let s = html;
  for (const a of ALLOWED) s = s.split(a).join(a.startsWith('>') ? '><' : ' ');
  const attrs = [...s.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((m) => m[1]);
  const text = s.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  return `${text} ${attrs.join(' ')}`.replace(/&[a-z#0-9]+;/gi, ' ');
};
const hits = (html: string): string[] => [...new Set((said(html).match(WORDS) ?? []).map((w) => w.toLowerCase()))];

// ---------- a browser, as far as a render needs one ----------
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const g = globalThis as unknown as Record<string, unknown>;
const had = { window: g.window, document: g.document, localStorage: g.localStorage, sessionStorage: g.sessionStorage, navigator: g.navigator };

const T = todayISO() as ISODate;
const boot = (): Bootstrap =>
  ({
    user: { id: 'u1', email: 'sam@example.com', name: 'Sam', onboardedAt: '2026-01-01T00:00:00Z', trainingProfile: { goal: 'half', raceDate: null, runDays: ['mon', 'wed', 'fri', 'sat'], longRunDay: 'sat', weeklyMiles: 25, updatedAt: '2026-01-01T00:00:00Z' }, status: { kind: 'taper', from: T, until: null } },
    habits: [{ id: 'h1', name: 'Meditate', position: 0, createdOn: '2026-01-01', archivedOn: null }],
    blocks: [{ id: 'b1', name: 'Half marathon', start: shiftDays(T, -14), end: shiftDays(T, 60), createdAt: '2026-01-01T00:00:00Z', source: 'template' }],
    morningSettings: undefined,
    zones: null,
    strava: { connected: true, athleteName: 'Sam', lastSyncAt: null, syncing: false, error: null, configured: true },
    features: { claude: true, strava: true },
    consent: { training: true, recall: true, reads: true, health: null, at: '2026-01-01T00:00:00Z', version: 1 },
    trainWhen: { when: 'morning', offWork: null },
  }) as unknown as Bootstrap;
const month = (m: string): MonthBundle =>
  ({
    month: m,
    sessions: [-1, 0, 1].map((d, i) => ({ id: `s${i}`, date: shiftDays(T, d), kind: 'run', type: 'Easy', title: null, miles: 4, minutes: null, position: 0, mark: d < 0 ? 'done' : null, blockId: 'b1' })).filter((s) => monthOf(s.date) === m),
    checks: [],
    lifts: monthOf(T) === m ? [{ id: 'l1', date: T, exercise: 'Squat', weight: 185, reps: 5, position: 0 }] : [],
    activities: monthOf(shiftDays(T, -1)) === m ? [{ id: 'a1', date: shiftDays(T, -1), kind: 'run', name: 'Morning Run', miles: 4.1, movingSec: 2200, elevFt: 80, avgHr: 140, polyline: null, time: '06:40' }] : [],
    morningDays: {},
    journal: [],
    coach: [],
  }) as unknown as MonthBundle;

const client = async () => {
  const { NEW_ACCOUNT_MORNING, normalizeMorningSettings } = await import('@logbook/shared');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(['bootstrap'], { ...boot(), morningSettings: normalizeMorningSettings(NEW_ACCOUNT_MORNING) });
  for (let i = -8; i <= 2; i++) {
    const d = new Date(`${T.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const m = d.toISOString().slice(0, 7);
    qc.setQueryData(['month', m], month(m));
  }
  qc.setQueryData(['todos'], [{ id: 't1', text: 'Renew passport', priority: 1, doneOn: null, deletedOn: null, position: 0, createdOn: T, due: null, groupId: null }]);
  qc.setQueryData(['todo-groups'], []);
  qc.setQueryData(['goals'], []);
  qc.setQueryData(['day-plan', T], { date: T, steps: [], order: [] });
  qc.setQueryData(['lifts'], []);
  qc.setQueryData(['activities'], []);
  qc.setQueryData(['reads'], []);
  qc.setQueryData(['learnings', 'stats'], { days: 0, streak: 0, total: 0, recent: [] });
  qc.setQueryData(['learnings', 'list', { month: null, q: null }], { pages: [{ learnings: [], next: null }], pageParams: [null] });
  qc.setQueryData(['learnings', 'months'], []);
  // the month lists the last seven days touch (the Journal's lights read them)
  for (const m of new Set([monthOf(T), monthOf(shiftDays(T, -6))])) qc.setQueryData(['learnings', 'list', { month: m, q: null }], { pages: [{ learnings: [], next: null }], pageParams: [null] });
  qc.setQueryData(['learnings', 'echoes'], { yearAgo: null, monthAgo: null, random: null });
  // the Journal reads its entries beside its lines
  qc.setQueryData(['journal', '', false], { entries: [], more: false, total: 0 });
  qc.setQueryData(['written', 'months'], []);
  qc.setQueryData(['progress', 'history-start'], { first: shiftDays(T, -30) });
  qc.setQueryData(['daily'], { date: T, memory: null, quote: null, pastCount: 0 });
  return qc;
};

/** A screen: where it lives, what it must say with Fitness on (the account trains), and what it must still show with it off. */
type Screen = [name: string, load: () => Promise<{ default: React.ComponentType }>, path: string, on: RegExp, keeps: RegExp];
const SCREENS: Screen[] = [
  ['Today', () => import('@/features/day/DayView'), '/today', /run|miles|mi\b/i, /What would make today count\?[\s\S]*An idea · from your habits[\s\S]*Set this goal[\s\S]*Habits[\s\S]*Journal[\s\S]*Tonight’s line/],
  ['Progress', () => import('@/features/progress/ProgressView'), '/progress', /running/i, /Habits[\s\S]*Health/],
  ['Goals', () => import('@/features/goals/GoalsView'), '/goals', /Goals/, /Goals/],
  ['Journal', () => import('@/features/journal/JournalView'), '/journal', /Journal/, /Journal[\s\S]*What did you learn today\?/],
  ['Settings', () => import('@/features/settings/SettingsView'), '/settings', /Run days[\s\S]*Plans/, /Today shows[\s\S]*Fitness[\s\S]*Habits/],
];

const render = async (screen: Screen, fitness: boolean, seed?: (qc: QueryClient) => void): Promise<string> => {
  const [, load, path] = screen;
  const { resetPrefsForTest, DEFAULT_PREFS } = await import('./prefs');
  resetPrefsForTest({ ...DEFAULT_PREFS, fitness });
  (g.window as { location: { pathname: string } }).location.pathname = path;
  const [{ NavController, TabScope }, { ToastProvider }, { ContextMenuProvider }, { SheetProvider }, Page] = await Promise.all([import('@/app/NavController'), import('@/ui/Toast'), import('@/ui/ContextMenu'), import('@/ui/Sheet'), load()]);
  const qc = await client();
  seed?.(qc);
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <NavController>
          <ToastProvider>
            <ContextMenuProvider>
              <SheetProvider>
                <TabScope tab="today">
                  <Page.default />
                </TabScope>
              </SheetProvider>
            </ContextMenuProvider>
          </ToastProvider>
        </NavController>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Fitness off: no screen speaks of training', () => {
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

  it.each(SCREENS)('%s', async (...screen) => {
    const on = await render(screen, true);
    // the account trains: with Fitness on the screen says so, so an empty render cannot pass for a clean one
    expect(said(on)).toMatch(screen[3]);
    const off = await render(screen, false);
    // what remains is a whole page, in its order (on Today the day's own sections lead), and it names no training
    expect(off.replace(/<[^>]+>/g, ' ')).toMatch(screen[4]);
    expect(hits(off)).toEqual([]);
    // a whole screen and everything it imports: the first one loads most of the app, so it gets room on a busy machine
  }, 60_000);

  it('the assistant’s starters name no run and no plan, with access on or off, from every tab', async () => {
    const { startersFor } = await import('@/features/assistant/AssistantPane');
    for (const tab of ['today', 'goals', 'progress', 'learned', 'journal', undefined] as const)
      for (const access of [true, false]) {
        const cards = startersFor(tab, '2026-11-12', '2026-11-12', access, false);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.some((c) => c.attach)).toBe(false);
        for (const c of cards) expect(`${c.title} ${c.sub} ${c.send ?? ''}`).not.toMatch(WORDS);
      }
    // on, they still do
    expect(startersFor('today', '2026-11-12', '2026-11-12', true).map((c) => c.title).join(' ')).toMatch(/run/);
  });

  it('the Journal starts its line from the day, and never from training with Fitness off', async () => {
    const learned = SCREENS.find((x) => x[0] === 'Journal')!;
    // today's run is done, and the week's lines are loaded (the months the last seven days touch)
    const day = (extra: (qc: QueryClient) => void = () => undefined) => (qc: QueryClient) => {
      for (const m of new Set([monthOf(T), monthOf(shiftDays(T, -6))])) qc.setQueryData(['learnings', 'list', { month: m, q: null }], { pages: [{ learnings: [], next: null }], pageParams: [null] });
      const m = month(monthOf(T));
      qc.setQueryData(['month', monthOf(T)], { ...m, sessions: m.sessions.map((x) => (x.date === T ? { ...x, mark: 'done' } : x)) });
      extra(qc);
    };
    const on = await render(learned, true, day());
    expect(said(on)).toMatch(/What did you learn today\?[\s\S]*On my run today I learned[\s\S]*From today’s run[\s\S]*Finish the line/);
    // off: the same done run is never where the line starts, and the page names no training
    const off = await render(learned, false, day());
    expect(said(off)).toMatch(/What did you learn today\?[\s\S]*Today I learned[\s\S]*Finish the line/);
    expect(said(off)).not.toMatch(/On my run|From today/);
    expect(hits(off)).toEqual([]);
    // off, with a habit done today: the line starts from the habits
    const habit = await render(learned, false, day((qc) => qc.setQueryData(['month', monthOf(T)], { ...month(monthOf(T)), checks: [{ habitId: 'h1', date: T, done: true, note: null }] })));
    expect(said(habit)).toMatch(/Keeping my habits today I learned[\s\S]*From today’s habits/);
    expect(hits(habit)).toEqual([]);
    // the counts are days written and lines kept: no run of days, in print or in a label
    for (const html of [on, off, habit]) expect(said(html)).not.toMatch(/in a row|streak/i);
  }, 60_000);

  it('the tour has no Fitness page and no Progress page', async () => {
    const { tourPages } = await import('@/features/onboarding/tour/Tour');
    expect(tourPages(false).map((p) => p.key)).toEqual(['todos', 'habits', 'goals', 'journal', 'learned', 'ask']);
    expect(tourPages(true).map((p) => p.key)).toContain('plan');
    for (const p of tourPages(false)) expect(`${p.where} ${p.title} ${p.lede}`).not.toMatch(WORDS);
  });

});
