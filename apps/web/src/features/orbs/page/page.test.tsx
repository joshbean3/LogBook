import type * as React from 'react';
import { addKeepsakes, emptyRewards, keepsakesDue, mondayLine, reconcile, RULES, ruleLine, shiftDays, daysBetween, type Aim, type DayFacts, type Rewards } from '@logbook/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

// the page holds the challenge rows, which read the app's caches: an empty client is all a static render needs
const draw = (Page: React.ComponentType): string =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } } })}>
      <Page />
    </QueryClientProvider>,
  );

/**
 * The Orbs page, "How Orbs work" and the switches, rendered on the server renderer in each of their states: before the
 * first Orb, a first week, a year in, Orbs off, Fitness off. The stores are built with the engine's own functions, a day
 * at a time, the way the phone's reconciler would have built them.
 */
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));
const pop = vi.fn();
const push = vi.fn();
const toast = vi.fn();
const open = vi.fn();
vi.mock('@/app/NavController', () => ({ useNav: () => ({ push, pop, go: vi.fn() }), useNavState: () => ({ active: 'today', tabs: {}, overlays: 0 }), useNavInternal: () => ({ pop }) }));
vi.mock('@/ui/PushedLayer', () => ({ usePop: () => pop }));
vi.mock('@/ui/Sheet', () => ({ useSheet: () => ({ open, close: vi.fn(), push: vi.fn(), pop: vi.fn(), update: vi.fn(), isOpen: () => false }) }));
vi.mock('@/ui/Toast', () => ({ useToast: () => toast }));
vi.mock('@/ui/NavBar', () => ({ PushedBar: ({ title }: { title: string }) => <header className="pushed-bar">{title}</header> }));
vi.mock('@/ui/Pressable', () => ({
  Pressable: ({ children, className = '', label, press, onPress: _p, ...rest }: { children?: ReactNode; className?: string; label?: string; press?: string; onPress?: () => void } & Record<string, unknown>) => (
    <button type="button" className={`pressable ${className}`} data-press={press} aria-label={label} {...rest}>
      {children}
    </button>
  ),
}));

const U = 'u_owner';
const START = RULES.startsOn; // a Monday
const g = globalThis as unknown as Record<string, unknown>;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const base = (date: string): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 4, habitsDone: 0, habitsLiveDone: 0, lines: 0, train: {}, auto: {}, trainRequired: false, trainLeft: 0, goalDay: 'none', held: false });
/** A store lived a day at a time from the rules' first day to `today` (which is left open, with `todayFacts`). */
const live = (today: string, factsOf: (date: string, i: number) => Partial<DayFacts>, goalsOn: (date: string) => Aim[] = () => []): Rewards => {
  let s = emptyRewards(U, START);
  const lines: Array<{ date: string; text: string }> = [];
  for (let i = 0; i <= daysBetween(START, today); i++) {
    const d = shiftDays(START, i);
    const f = { ...base(d), ...factsOf(d, i) };
    if (f.lines) lines.push({ date: d, text: 'Easy miles are the ones that build.' });
    const now = new Date(`${d}T12:00:00`);
    s = reconcile(s, [f], now, { goals: goalsOn(d) }).store;
    s = addKeepsakes(s, keepsakesDue(s, now, { goals: goalsOn(d), lines }));
  }
  return s;
};
const goal = (level: Aim['level'], period: string, text: string, made: string, closed: string): Aim => ({ id: `g-${period}`, level, period, text, original: null, why: null, status: 'done', reflection: null, steps: [], createdAt: `${made}T09:00:00`, updatedAt: `${closed}T18:00:00`, closedAt: `${closed}T18:00:00` });

/** A first week: Monday, Tuesday and today (Thursday) count; Wednesday was a day off. */
const WEEK_TODAY = shiftDays(START, 3);
const firstWeek = () => live(WEEK_TODAY, (_d, i) => (i === 0 ? { habitsDone: 3, habitsLiveDone: 3 } : i === 1 ? { todosDone: 2, habitsDone: 4, habitsLiveDone: 4, lines: 1 } : i === 3 ? { todosDone: 3, habitsDone: 4, habitsLiveDone: 4, goalDay: 'done' } : {}));
/** A year in: 52 weeks and three days, two days off most weeks, sessions three days a week, a month goal and a year goal. */
const YEAR_TODAY = shiftDays(START, 52 * 7 + 3);
const yearIn = () =>
  live(
    YEAR_TODAY,
    (_d, i) => {
      const dow = i % 7;
      if (dow === 5 || (dow === 2 && i % 3 === 0)) return {};
      const run = dow === 1 || dow === 3 || dow === 6;
      return { todosDone: 2, todosEarlier: 1, habitsDone: 3, habitsLiveDone: 3, lines: dow === 0 ? 1 : 0, train: run ? { run: 'done' } : {}, trainRequired: run, goalDay: dow < 4 ? 'done' : 'open' };
    },
    (d) => (d >= '2027-03-24' && d <= '2027-03-31' ? [goal('month', '2027-03', 'Read two books and write a page on each', '2027-03-02', '2027-03-24')] : d >= '2027-10-20' && d <= '2027-10-25' ? [goal('year', '2027', 'Run a half marathon and keep a journal all year', '2027-01-03', '2027-10-20')] : []),
  );

type Mods = { store: typeof import('../store'); prefs: typeof import('@/lib/prefs'); OrbsPage: typeof import('./OrbsPage').default; OrbsHow: typeof import('./OrbsHow').default; Switches: typeof import('./Switches') };
const launch = async (today: string, s: Rewards | null, hour = 12): Promise<Mods> => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${today}T${String(hour).padStart(2, '0')}:00:00`));
  const local = mem();
  Object.assign(g, { localStorage: local, sessionStorage: mem() });
  if (s) local.setItem('logbook.orbs', JSON.stringify(s));
  const store = await import('../store');
  store.openOrbs(U);
  const prefs = await import('@/lib/prefs');
  prefs.resetPrefsForTest(null);
  return { store, prefs, OrbsPage: (await import('./OrbsPage')).default, OrbsHow: (await import('./OrbsHow')).default, Switches: await import('./Switches') };
};
/** What a page says, a line per element; the fact line's parts (kept whole by their own spans) read as the one line they are. */
const text = (html: string) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<\/?span class="orp-line-part">|<\/span>(?= <span class="orp-line-part">|<\/p>)/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
const count = (html: string, part: string) => html.split(part).length - 1;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  delete g.localStorage;
  delete g.sessionStorage;
});

describe('the Orbs page before the first Orb', () => {
  it('is the empty window with one sentence, the rule and How Orbs work: no grid, no zero, no pills', async () => {
    const m = await launch(START, emptyRewards(U, START));
    const html = draw(m.OrbsPage);
    const said = text(html);
    expect(said).toContain('Your first Orb\nFinish one thing and it lands here.');
    expect(said).toContain(`The rule\n${ruleLine(5)}`);
    expect(said).toContain('How Orbs work');
    expect(html).not.toContain('orp-keeps');
    expect(html).not.toContain('orp-week');
    expect(html).not.toContain('orp-now');
    expect(html).not.toContain('Keepsakes');
    expect(said).not.toMatch(/(^|\D)0(\D|$)/);
    expect(said).not.toMatch(/Level/);
    // the poster with its window, empty: its rings and its edge, nothing to stir, no arc, no total, nothing said of what it holds
    expect(html).toMatch(/<section class="po is-day is-full dm is-empty" aria-label="Your first Orb">/);
    expect(html).toMatch(/<h2 class="po-title is-lead">Your first Orb<\/h2>/);
    for (const part of ['dm-oculus', 'dm-rings', 'dm-edge-ring', 'po-scene is-slim', 'po-band']) expect(html).toContain(part);
    for (const part of ['dm-pills', 'dm-edge-arc', 'dm-total', 'sr-only']) expect(html).not.toContain(part);
  });
  it('before the rules’ first day it says when Orbs start, and promises nothing sooner', async () => {
    const m = await launch(shiftDays(START, -3), emptyRewards(U, START));
    const said = text(draw(m.OrbsPage));
    expect(said).toContain('Orbs start Monday');
    expect(said).toContain('Monday, November 16');
    expect(said).not.toContain('lands here');
  });
  it('a day that counted by its journal line alone shows the week and still no zero', async () => {
    const m = await launch(START, live(START, () => ({ lines: 1 })));
    const html = draw(m.OrbsPage);
    expect(text(html)).toContain('Finish one thing and it lands here.');
    expect(text(html)).toContain('1 day this week · 1 in all');
    expect(count(html, 'orp-day is-on')).toBe(1);
  });
});

describe('the Orbs page in a first week', () => {
  it('reads top to bottom: the total, the level, the week, today, the keepsakes, then how it works and the switches', async () => {
    const s = firstWeek();
    const m = await launch(WEEK_TODAY, s);
    const html = draw(m.OrbsPage);
    const said = text(html);
    // Monday 3, Tuesday 6, today 3 + 4 + 3 and a full day's 5
    expect(m.store.getOrbs()!.days[WEEK_TODAY]).toMatchObject({ n: 15 });
    // the total where a poster's title stands, the window in words (what VoiceOver hears in its place), the band
    expect(said).toMatch(/^Orbs\n24\nOrbs\n24 Orbs\. This week: 11 habits, 5 to-dos, today’s goal, 1 full day\.\nLevel 1\n1 to level 2\n/);
    // the pills stand under the card, after the week
    expect(said).toContain('3 days this week · 3 in all\nTilt\nStir\nFloat\nToday\n15 Orbs');
    const order = ['dm-total', 'dm-rings', 'dm-oculus', 'dm-canvas', 'dm-edge-arc', 'class="sr-only"', 'po-scene is-slim', 'po-band', 'orp-week', 'orp-line', 'dm-pills', 'orp-now', '>Keepsakes<', 'class="orp-keeps"', 'How Orbs work', 'role="switch"'].map((part) => html.indexOf(part));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(said).toContain('3 days this week · 3 in all');
    expect(said).not.toContain('in a row');
    expect(said).toContain('Today\n15 Orbs');
  });
  it('the week is seven marks, Monday first: a check on a day that counts, an open ring otherwise, today named', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    const html = draw(m.OrbsPage);
    const days = [...html.matchAll(/class="(orp-day[^"]*)"/g)].map((x) => x[1]);
    expect(days).toEqual(['orp-day is-on', 'orp-day is-on', 'orp-day', 'orp-day is-on is-today', 'orp-day', 'orp-day', 'orp-day']);
    expect(html).toContain('aria-label="This week: Monday, Tuesday and Thursday count."');
    expect(text(html)).toContain('M\nT\nW\nT\nF\nS\nS');
  });
  it('today not yet counted is ringed in the strip’s own way', async () => {
    const m = await launch(WEEK_TODAY, live(shiftDays(START, 2), (_d, i) => (i < 2 ? { habitsDone: 2, habitsLiveDone: 2 } : {})));
    const days = [...draw(m.OrbsPage).matchAll(/class="(orp-day[^"]*)"/g)].map((x) => x[1]);
    expect(days[3]).toBe('orp-day is-today');
  });
  it('keepsakes: one dashed ring for what comes next, then the earned ones newest first; the newest glows and unseen ones say New', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    const html = draw(m.OrbsPage);
    expect(count(html, 'orp-disc is-next')).toBe(1);
    expect(html).toContain('aria-label="Next: 10 days in all."');
    expect(text(html)).toContain('Next: 10 days in all');
    // the first full day (today) is newer than First light
    expect([...html.matchAll(/aria-label="((?:First)[^"]*)"/g)].map((x) => x[1])).toEqual(['First full day. Thursday, November 19. New.', 'First light. Monday, November 16. New.']);
    expect(count(html, 'orp-keep is-newest')).toBe(1);
    expect(count(html, 'orb-light')).toBe(1);
    expect(count(html, 'orp-keep-new')).toBe(2);
    m.store.markSeen('first');
    const after = draw(m.OrbsPage);
    expect(count(after, 'orp-keep-new')).toBe(1);
    expect(after).toContain('aria-label="First light. Monday, November 16."');
    expect(text(after)).toContain('Nov 16');
  });
  it('on a Monday the engine’s Monday line stands over the fact line', async () => {
    const monday = shiftDays(START, 7);
    const m = await launch(monday, live(monday, (_d, i) => (i < 5 || i === 7 ? { habitsDone: 2, habitsLiveDone: 2 } : {})));
    const said = text(draw(m.OrbsPage));
    expect(said).toContain(`${mondayLine(5)}\n1 day this week · 6 in all`);
    const other = await launch(WEEK_TODAY, firstWeek());
    expect(text(draw(other.OrbsPage))).not.toContain('New week');
  });
});

describe('the Orbs page a year in', () => {
  it('shows the total with its unit, a numbered level, weeks in a row, and every keepsake earned', async () => {
    const s = yearIn();
    const m = await launch(YEAR_TODAY, s);
    const html = draw(m.OrbsPage);
    const said = text(html);
    const total = m.store.getOrbs()!;
    expect(Object.keys(total.keepsakes)).toEqual(expect.arrayContaining(['first', 'full', 'weeks:52', 'days:250', 'goal:month:2027-03', 'goal:year:2027', `chapter:${START}`]));
    expect(said).toMatch(/^Orbs\n([\d,]+)\nOrbs\n\1 Orbs\. This week: [^\n]+\. \d+ earlier weeks, \d+ chapters, 1 longer stretch\.\n(?:[^\n]+ · [\d,]+ Orbs[^\n]*\n)+Level \d+\n[\d,]+ to level \d+\n/);
    expect(said).toMatch(/\d days? this week · \d+ in all · 52 weeks in a row/);
    expect(count(html, 'class="orp-keep-cell"')).toBe(Object.keys(total.keepsakes).length);
    expect(count(html, 'orp-keep is-newest')).toBe(1);
    expect(count(html, 'orb-light')).toBe(1);
    // a chapter is the open book over its number; the 1,000 has not come
    expect(html).toContain('orp-disc is-both');
    expect(said).not.toContain('1,000');
  });
  it('never says a word the words table forbids, shows no zero, no "best" and nothing that ended', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    const said = text(draw(m.OrbsPage));
    expect(said).not.toMatch(/streak|sprint|quest|points|coins|\bXP\b|\bAI\b|coach|\bbot\b|rest days|\bbest\b|days in a row|\u2014/i);
    expect(said).not.toMatch(/(^|\n)0(\n|$)| 0 /);
  });
  it('the earned Orb’s light is the only Orb drawn: the assistant’s glossy Orb is not on this page', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    const html = draw(m.OrbsPage);
    expect(html).not.toMatch(/class="[^"]*\blb-orb\b/);
    expect(html).not.toContain('logo-mark');
  });
});

describe('the poster at the head of the page', () => {
  it('is the poster kit’s card, with the total as its title and the level on its band', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    const html = draw(m.OrbsPage);
    expect(html).toMatch(/<section class="po is-day is-full dm is-count" aria-label="[\d,]+ Orbs\. Level \d+\.">/);
    // the total is said once, by the summary: the big numeral is the picture of it
    expect(html).toMatch(/<p class="po-title is-lead"><span class="dm-total" aria-hidden="true"><span class="dm-num">[\d,]+<\/span> <span class="dm-unit">Orbs<\/span><\/span><\/p>/);
    expect(html).toMatch(/<span class="po-label"><span>Level \d+<\/span><\/span><span class="po-said"><span class="po-words-b">[\d,]+ to level \d+<\/span><\/span>/);
    // one card, no dark panel on it
    expect(count(html, 'class="po ')).toBe(1);
    for (const part of ['dm-console', 'dm-gauge', 'dm-key', 'dm-glass']) expect(html).not.toContain(part);
  });
  it('the window is a picture: hidden from VoiceOver, which hears the same in words and reaches the pills as buttons', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    const html = draw(m.OrbsPage);
    expect(html).toMatch(/<div class="dm-oculus" aria-hidden="true">/);
    expect(count(html, '<canvas')).toBe(1);
    expect(html).toMatch(/<div class="sr-only"><p>[\d,]+ Orbs\. This week: [^<]+<\/p><ul>(?:<li>[^<]+<\/li>)+<\/ul><\/div>/);
    // Tilt and Float are toggles, off until tapped; Stir is a plain button. Each says more than its one word
    const pills = [...html.matchAll(/<button[^>]*class="status-pill dm-pill[^"]*"[^>]*>/g)].map((x) => [/aria-label="([^"]+)"/.exec(x[0])?.[1], /aria-pressed="(\w+)"/.exec(x[0])?.[1] ?? null]);
    expect(pills).toEqual([
      ['Tilt. Gravity follows the phone', 'false'],
      ['Stir. One swirl', null],
      ['Float. Gravity lets go', 'false'],
    ]);
    expect(html).toMatch(/<div class="status-row dm-pills">/);
    expect(count(html, 'class="status-pill-glyph" aria-hidden="true"')).toBe(3);
    expect(text(html)).toContain('Tilt\nStir\nFloat');
  });
  it('the level is a thin arc on the window’s edge, from twelve o’clock, as long as the share of the level earned', async () => {
    const s = firstWeek();
    const m = await launch(WEEK_TODAY, s);
    const html = draw(m.OrbsPage);
    // 24 of the first level's 25
    expect(html).toMatch(/<circle class="dm-edge-arc"[^>]*pathLength="1" stroke-dasharray="0\.9600 2" transform="rotate\(-90 140 140\)"/);
    expect(html).toMatch(/<svg class="dm-edge"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<svg class="dm-rings"[^>]*aria-hidden="true"[^>]*>(?:<circle r="[\d.]+"><\/circle>){3}<\/svg>/);
    expect(text(html)).toContain('Level 1\n1 to level 2');
  });
  it('nothing about it says a word the brief forbids', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    expect(text(draw(m.OrbsPage))).not.toMatch(/\bjar\b|marble|coins?\b|\bdome\b|oculus|console|dial/i);
  });
});

describe('Fitness off', () => {
  it('nothing on the page or in How Orbs work names training', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    m.prefs.setFitness(false);
    const page = text(draw(m.OrbsPage));
    const how = text(renderToStaticMarkup(<m.OrbsHow />));
    for (const said of [page, how]) expect(said).not.toMatch(/session|training|\bplan\b|\blift\b|Sick|Injured|pace|distance/i);
    expect(how).not.toMatch(/\brun\b/i);
    expect(how).toContain('A day pays 21 at most.');
    m.prefs.setFitness(true);
    expect(text(renderToStaticMarkup(<m.OrbsHow />))).toContain('A day pays 27 at most.');
  });
});

describe('Orbs off', () => {
  it('the pages draw nothing of Orbs but their bar, and take themselves off', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    m.store.setSwitches({ on: false });
    const page = draw(m.OrbsPage);
    const how = renderToStaticMarkup(<m.OrbsHow />);
    expect(text(page)).toBe('Orbs');
    expect(text(how)).toBe('How Orbs work');
  });
  it('turning Orbs off loses nothing: on again, the page is as it was', async () => {
    const m = await launch(YEAR_TODAY, yearIn());
    const before = text(draw(m.OrbsPage));
    m.store.setSwitches({ on: false });
    m.store.setSwitches({ on: true });
    expect(text(draw(m.OrbsPage))).toBe(before);
  });
});

describe('before this phone has a store (a new sign-in, the error screen’s Reset, a reinstall; offline it can stay so)', () => {
  it('the page is not blank: its bar, How Orbs work and the switches, and nothing it cannot know', async () => {
    const m = await launch(START, null);
    expect(m.store.getOrbs()).toBeNull();
    const html = draw(m.OrbsPage);
    const said = text(html);
    expect(said.split('\n')[0]).toBe('Orbs');
    for (const row of ['How Orbs work', 'Show Orbs when you earn them', 'Your week', 'Challenges']) expect(said).toContain(row);
    // no total, no level, no week, no keepsakes, and no promise about a first Orb it cannot know of
    for (const part of ['class="po ', 'dm-oculus', 'dm-total', 'dm-pills', 'orp-week', 'orp-now', 'orp-keeps']) expect(html).not.toContain(part);
    expect(said).not.toMatch(/Level|lands here|Orbs start|Keepsakes/);
    expect(said).not.toMatch(/(^|\D)0(\D|$)/);
  });
  it('and it is the whole page as soon as the store is there', async () => {
    const m = await launch(WEEK_TODAY, null);
    expect(text(draw(m.OrbsPage))).not.toContain('Level');
    m.store.setOrbs(firstWeek());
    expect(text(draw(m.OrbsPage))).toContain('Level 1');
  });
  it('with Orbs off it is still only the bar', async () => {
    const m = await launch(START, null);
    m.store.setSwitches({ on: false });
    expect(text(draw(m.OrbsPage))).toBe('Orbs');
  });
});

describe('one broken part never blanks the page', () => {
  // what the boundary does when a section throws is covered where it lives (app/SectionBoundary.test.tsx)
  it('the challenge rows, the keepsakes and the dome each sit in their own boundary', () => {
    const src = readFileSync(join(__dirname, 'OrbsPage.tsx'), 'utf8');
    expect(src).toMatch(/<SectionBoundary name="orbs\.challenge"[^>]*>\s*<ChallengeRows scope="page" \/>\s*<\/SectionBoundary>/);
    expect(src).toMatch(/<SectionBoundary name="orbs\.keepsakes"[^>]*>\s*<Keepsakes [^>]*\/>\s*<\/SectionBoundary>/);
    expect(src).toMatch(/<SectionBoundary name="orbs\.dome"[^>]*>\s*<Dome [\s\S]*?<\/Dome>\s*<\/SectionBoundary>/);
  });
});

describe('the switches', () => {
  const rows = (m: Mods, place: 'page' | 'settings') => text(renderToStaticMarkup(<m.Switches.OrbsSwitchRows place={place} />));
  it('are Orbs, Show Orbs when you earn them, Your week, Challenges and How Orbs work', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    expect(rows(m, 'settings')).toBe(['Orbs', 'Small lights for what you finish', 'Show Orbs when you earn them', 'Off, the count still grows', 'Your week', ruleLine(5), '5 days', 'Challenges', 'Size: Steady', 'One a week', 'How Orbs work', 'What earns them, and the count'].join('\n'));
    expect(rows(m, 'page').startsWith('How Orbs work')).toBe(true);
  });
  it('go through the store: the week, the cadence and the size change what the rows and the page say', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    m.store.setSwitches({ weekTarget: 3 });
    expect(m.store.getSwitches().weekTarget).toBe(3);
    expect(m.store.getOrbs()!.set.weekTarget).toBe(3);
    expect(rows(m, 'settings')).toContain(`${ruleLine(3)}\n3 days`);
    expect(ruleLine(3)).toBe('One thing a day. Four days off a week.');
    m.store.setSwitches({ cadence: 2, size: 'bold' });
    expect(rows(m, 'settings')).toContain('Challenges\nSize: Bold\nTwo a week');
    m.store.setSwitches({ cadence: 0 });
    expect(rows(m, 'settings')).toContain('Challenges\nNone are offered\nOff');
    expect(m.store.getOrbs()!.set).toMatchObject({ weekTarget: 3, cadence: 0, size: 'bold' });
    // the choices behind the rows say the engine's own rule line for each week
    const week = text(renderToStaticMarkup(<m.Switches.WeekChoice />));
    for (const n of [5, 4, 3] as const) expect(week).toContain(`${n} days\n${ruleLine(n)}`);
    const html = renderToStaticMarkup(<m.Switches.WeekChoice />);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!role="radio").)*3 days/s);
    // with challenges off their size is not asked
    expect(text(renderToStaticMarkup(<m.Switches.ChallengeChoice />))).not.toContain('Gentle');
    m.store.setSwitches({ cadence: 1 });
    expect(text(renderToStaticMarkup(<m.Switches.ChallengeChoice />))).toContain('Gentle');
  });
  it('“Show Orbs when you earn them” off keeps the count and the page', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    const before = text(draw(m.OrbsPage));
    m.store.setSwitches({ show: false });
    expect(text(draw(m.OrbsPage))).toBe(before);
    expect(renderToStaticMarkup(<m.Switches.OrbsSwitchRows place="settings" />)).toMatch(/aria-checked="false" aria-label="Show Orbs when you earn them"/);
  });
  it('with Orbs off Settings keeps the switch and How Orbs work, and asks nothing else', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    m.store.setSwitches({ on: false });
    expect(rows(m, 'settings')).toBe(['Orbs', 'Small lights for what you finish', 'How Orbs work', 'What earns them, and the count'].join('\n'));
    expect(renderToStaticMarkup(<m.Switches.OrbsSwitchRows place="settings" />)).toMatch(/aria-checked="false" aria-label="Orbs"/);
    // the count is paused from today: a range of neutral days is open, and nothing was lost
    expect(m.store.getOrbs()!.off).toEqual([{ from: WEEK_TODAY, to: null }]);
    expect(Object.keys(m.store.getOrbs()!.days)).toHaveLength(3);
  });
});

describe('How Orbs work', () => {
  it('leads with the rule for the person’s week, then the sections, then the quiet disclosure', async () => {
    const m = await launch(WEEK_TODAY, firstWeek());
    m.store.setSwitches({ weekTarget: 4 });
    const html = renderToStaticMarkup(<m.OrbsHow />);
    const said = text(html);
    expect(said.startsWith(`How Orbs work\n${ruleLine(4)}\n`)).toBe(true);
    for (const title of ['What earns Orbs', 'Goals multiply by reach', 'Weeks in a row', 'The count', 'Challenges', 'What Orbs are for', 'What Orbs never do']) expect(said).toContain(title);
    expect(said.endsWith('For the curious')).toBe(true);
    expect(html).toContain('aria-expanded="false"');
    // plain rows: no table markup to fail at a large text size
    expect(html).not.toMatch(/<table|<tr|<td/);
    expect(said).toContain(`A to-do\nThe first ${RULES.todo.cap} a day\n${RULES.todo.each}`);
    expect(said).toContain(`This year’s goal\n× ${RULES.goal.reach.year}\n${RULES.goal.base * RULES.goal.reach.year}`);
  });
});

describe('a very large text size', () => {
  const css = readFileSync(join(__dirname, 'orbs.css'), 'utf8');
  const dome = readFileSync(join(__dirname, '../dome/dome.css'), 'utf8');
  it('the keepsakes go from four across to two', () => {
    expect(css).toMatch(/\.orp-keeps \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/:root\[data-text-xl\] \.orp-keeps \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });
  it('the total is held between 44 and 64 px, in Inter with even figures', () => {
    expect(dome).toMatch(/\.dm\.is-count \.po-title \{[^}]*font: 650 clamp\(44px, var\(--fs-stat-live\), 64px\) \/ 1 var\(--sans\);[^}]*font-variant-numeric: tabular-nums/);
  });
  it('the total wraps before it clips: its unit drops under it when the two no longer fit', () => {
    expect(dome).toMatch(/\.dm-total \{[^}]*flex-wrap: wrap/);
  });
  it('the pills stack, 12 apart, as Today’s do', () => {
    expect(readFileSync(join(__dirname, '../../../styles/layout.css'), 'utf8')).toMatch(/html\[data-text-xl\] \.status-row \{\s*flex-direction: column;/);
  });
  it('nothing in the stylesheet animates', () => {
    expect(css).not.toMatch(/\b(transition|animation)\s*:/);
  });
});
