import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, type Prefs } from '@/lib/prefs';
import { TOUR_ALL } from '@/features/onboarding/tour/Tour';
import { parseSeen, placeOf, TIP_CAPTIONS, TIP_DELAY_MS, TIP_DONE, TIP_EYEBROW, TIP_PLACES, TIP_TOUR, tipDue, tipFor, TIPS_AGAIN, TIPS_KEY, tipsStore, tipWords, type TipBuild, type TipMoment, type TipPlace } from './tips';

class MemStorage {
  m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, String(v));
  removeItem = (k: string) => void this.m.delete(k);
}
const throwing = { getItem: () => { throw new Error('storage refused'); }, setItem: () => { throw new Error('storage refused'); }, removeItem: () => { throw new Error('storage refused'); } };

const ON: Prefs = DEFAULT_PREFS;
const OFF: Prefs = { ...DEFAULT_PREFS, fitness: false };
const BUILDS: TipBuild[] = [
  { strava: false, health: false },
  { strava: false, health: true },
  { strava: true, health: false },
  { strava: true, health: true },
];
const allWords = (prefs: Prefs, build: TipBuild) => TIP_PLACES.flatMap((p) => { const t = tipFor(p, prefs, build); return t ? tipWords(t) : []; });

describe('which place a path is', () => {
  it('is a tab at its root', () => {
    expect(placeOf('/today')).toBe('today');
    expect(placeOf('/goals')).toBe('goals');
    expect(placeOf('/plan')).toBe('plan');
    expect(placeOf('/journal')).toBe('journal');
    expect(placeOf('/journal/')).toBe('journal');
    expect(placeOf('/goals?x=1')).toBe('goals');
  });
  it('is no place on a pushed page, another day or week, first run, the tour or the door', () => {
    for (const p of ['/settings', '/settings/app', '/goals/history', '/journal/2026-11', '/today/2026-11-10', '/today/2026-11-10/morning', '/plan/week/2026-11-09', '/plan/month/2026-11-01', '/progress/metric/pace', '/welcome', '/welcome/fitness', '/welcome/how', '/start', '/login', '/signup', '/', '']) expect(placeOf(p), p).toBeNull();
    expect(placeOf(undefined as unknown as string)).toBeNull();
  });
});

describe('the words', () => {
  it('has a tip for each tab, titled with the tab’s own name, and none for Fitness with Fitness off', () => {
    expect(TIP_PLACES).toEqual(['today', 'goals', 'plan', 'journal']);
    expect(TIP_PLACES.map((p) => tipFor(p, ON)?.title)).toEqual(['Today', 'Goals', 'Fitness', 'Journal']);
    expect(TIP_PLACES.map((p) => tipFor(p, OFF)?.title)).toEqual(['Today', 'Goals', undefined, 'Journal']);
  });

  it('is two rows at most under each caption, and at least one', () => {
    for (const prefs of [ON, OFF])
      for (const p of TIP_PLACES) {
        const t = tipFor(p, prefs);
        if (!t) continue;
        expect(t.works.length, p).toBeGreaterThanOrEqual(1);
        expect(t.works.length, p).toBeLessThanOrEqual(2);
        expect(t.tracked.length, p).toBeGreaterThanOrEqual(1);
        expect(t.tracked.length, p).toBeLessThanOrEqual(2);
      }
  });

  it('keeps every caption to four words, and names the first group once (the caps line over the title)', () => {
    for (const c of [TIP_EYEBROW, TIP_CAPTIONS.works, TIP_CAPTIONS.tracked]) expect(c.trim().split(/\s+/).length, c).toBeLessThanOrEqual(4);
    expect(TIP_EYEBROW).toBe('How it works');
    expect(TIP_CAPTIONS).toEqual({ works: 'How it works', tracked: 'How it’s tracked' });
    expect(TIP_DONE).toBe('Got it');
    expect(TIP_TOUR).toBe('See it in the tour');
  });

  it('is plain and short: a title fits one line, a second line is one short sentence or two', () => {
    for (const build of BUILDS)
      for (const prefs of [ON, OFF])
        for (const p of TIP_PLACES) {
          const t = tipFor(p, prefs, build);
          for (const r of t ? [...t.works, ...t.tracked] : []) {
            // Inter 17 600 in a card at 390: about 32 characters a line
            expect(r.title.length, r.title).toBeLessThanOrEqual(32);
            expect(r.title, r.title).not.toMatch(/[.!]$/);
            // Inter 15 in the same card: two lines at most
            expect((r.sub ?? '').length, r.sub).toBeLessThanOrEqual(56);
            if (r.sub) expect(r.sub, r.sub).toMatch(/\.$/);
          }
        }
  });

  it('uses no banned word, no em dash, no exclamation mark and no model name, in any build', () => {
    for (const build of BUILDS)
      for (const prefs of [ON, OFF])
        for (const w of [...allWords(prefs, build), ...Object.values(TIPS_AGAIN)]) {
          expect(w, w).not.toMatch(/—|–|!/);
          expect(w, w).not.toMatch(/\b(coach|AI|bot|Logbook|the Orby|Orby app)\b/i);
          expect(w, w).not.toMatch(/\b(Claude|GPT|Gemini|model)\b/i);
          // American spelling, and the Journal's and Fitness's own words
          expect(w, w).not.toMatch(/\b(colour|favourite|centre|organis|realis)\w*/i);
          expect(w, w).not.toMatch(/\b(workouts?|learnings?|notes?|posts?|logs)\b/i);
          expect(w, w).not.toMatch(/'/);
        }
  });

  it('names Strava only in a build that has it, and Apple Health in none (it brings no session)', () => {
    for (const build of BUILDS)
      for (const prefs of [ON, OFF]) {
        const text = allWords(prefs, build).join(' ');
        if (!build.strava) expect(text).not.toMatch(/Strava/i);
        expect(text).not.toMatch(/Apple Health|HealthKit|\bHealth\b/);
      }
    expect(tipFor('plan', ON, { strava: true, health: true })!.tracked[0]!.sub).toMatch(/Strava/);
    expect(tipFor('plan', ON, { strava: false, health: true })!.tracked[0]!.sub).toBe('Mark it done, or log a lift’s sets.');
  });

  it('says nothing about training with Fitness off', () => {
    for (const build of BUILDS) expect(allWords(OFF, build).join(' ')).not.toMatch(/\b(fitness|training|sessions?|runs?|running|lifts?|sets|miles?|workouts?|plan|Strava|pace)\b/i);
  });

  it('leaves out a line about a section of Today that is switched off, and has no tip when nothing is left to say', () => {
    const today = (t: Partial<Prefs['today']>) => tipFor('today', { ...ON, today: { ...ON.today, ...t } });
    expect(today({})!.works.map((r) => r.title)).toEqual(['One goal for the day', 'Habits are tiles']);
    expect(today({})!.tracked.map((r) => r.title)).toEqual(['Saved when you tap', 'Seven dots, one week']);
    // habits off: nothing about tiles or their dots
    expect(today({ habits: false })!.works.map((r) => r.title)).toEqual(['One goal for the day']);
    expect(today({ habits: false })!.tracked.map((r) => r.title)).toEqual(['Saved when you tap']);
    expect(tipWords(today({ habits: false })!).join(' ')).not.toMatch(/habit|tile|dots/i);
    // Plan your day off: nothing about the goal or the to-dos
    expect(today({ day: false })!.works.map((r) => r.title)).toEqual(['Habits are tiles']);
    expect(tipWords(today({ day: false })!).join(' ')).not.toMatch(/goal|to-do|stop/i);
    // both off: no line about how Today works is true, so there is no tip
    expect(today({ day: false, habits: false })).toBeNull();
    // the Journal row is not what the tip is about
    expect(today({ learned: false })!.works).toHaveLength(2);
  });

  it('opens the tour on a page the tour has: each place is a tour page’s key', () => {
    const keys = TOUR_ALL.map((p) => p.key as string);
    for (const p of TIP_PLACES) expect(keys, p).toContain(p);
    // and the tip’s title is that page’s title
    for (const p of TIP_PLACES) expect(tipFor(p, ON)!.title).toBe(TOUR_ALL.find((t) => t.key === p)!.title);
  });
});

describe('whether a tip is due', () => {
  const moment = (m: Partial<TipMoment> = {}): TipMoment => ({ path: '/today', prefs: ON, seen: new Set(), overlays: 0, busy: false, replaying: false, rose: false, ...m });
  const due = (m: Partial<TipMoment> = {}) => tipDue(moment(m))?.place ?? null;

  it('is due the first time a tab is on screen at its root', () => {
    expect(due()).toBe('today');
    expect(due({ path: '/goals' })).toBe('goals');
    expect(due({ path: '/plan' })).toBe('plan');
    expect(due({ path: '/journal' })).toBe('journal');
    expect(TIP_DELAY_MS).toBe(600);
  });

  it('is not due once that place has been seen; the others still are', () => {
    const seen = new Set<TipPlace>(['today', 'plan']);
    expect(due({ seen })).toBeNull();
    expect(due({ seen, path: '/plan' })).toBeNull();
    expect(due({ seen, path: '/goals' })).toBe('goals');
    expect(due({ seen, path: '/journal' })).toBe('journal');
  });

  it('is not due on a pushed page, during first run or the tour, or on the door', () => {
    for (const path of ['/settings', '/settings/app', '/goals/history', '/journal/2026-11', '/today/2026-11-10/morning', '/welcome', '/welcome/habits', '/welcome/how', '/start', '/login']) expect(due({ path }), path).toBeNull();
  });

  it('is not due while a sheet, the assistant or a menu is up', () => {
    expect(due({ overlays: 1 })).toBeNull();
    expect(due({ overlays: 2, path: '/journal' })).toBeNull();
  });

  it('is not due while the splash, the hand-off, a skeleton or a field has the screen', () => {
    expect(due({ busy: true })).toBeNull();
  });

  it('is not due in a replay of setup', () => {
    expect(due({ replaying: true })).toBeNull();
  });

  it('is never due twice in a row without a tab change', () => {
    expect(due({ rose: true })).toBeNull();
    expect(due({ rose: true, path: '/goals' })).toBeNull();
  });

  it('has no Fitness tip with Fitness off, and the other three stay', () => {
    expect(due({ prefs: OFF, path: '/plan' })).toBeNull();
    expect(due({ prefs: OFF })).toBe('today');
    expect(due({ prefs: OFF, path: '/goals' })).toBe('goals');
    expect(due({ prefs: OFF, path: '/journal' })).toBe('journal');
  });

  it('is not due on Today when every section its lines are about is off', () => {
    expect(due({ prefs: { ...ON, today: { habits: false, day: false, learned: true } } })).toBeNull();
  });

  it('carries this build’s words', () => {
    expect(tipDue(moment({ path: '/plan', build: { strava: true, health: true } }))!.tracked[0]!.sub).toMatch(/Strava/);
    expect(tipDue(moment({ path: '/plan', build: { strava: false, health: true } }))!.tracked[0]!.sub).not.toMatch(/Strava/);
  });
});

describe('the seen store', () => {
  let mem: MemStorage;
  beforeEach(() => {
    mem = new MemStorage();
    vi.stubGlobal('localStorage', mem);
    tipsStore.forgetForTest();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    tipsStore.forgetForTest();
  });

  it('lives under one logbook. key, which the account wipe clears', () => {
    expect(TIPS_KEY).toBe('logbook.tips');
    // not under `logbook.seen.`: that prefix is swept every day (ui/useFirstToday.ts)
    expect(TIPS_KEY.startsWith('logbook.seen.')).toBe(false);
  });

  it('starts with nothing seen when nothing is stored', () => {
    expect([...tipsStore.get().seen]).toEqual([]);
    expect(tipsStore.get().rose).toBe(false);
  });

  it('remembers a place as seen, in storage, in the tabs’ order', () => {
    tipsStore.markSeen('journal');
    tipsStore.markSeen('today');
    tipsStore.markSeen('today');
    expect(JSON.parse(mem.getItem(TIPS_KEY)!)).toEqual({ seen: ['today', 'journal'] });
    // a new launch reads it back
    tipsStore.forgetForTest();
    expect([...tipsStore.get().seen].sort()).toEqual(['journal', 'today']);
  });

  it('tells its listeners, and keeps the same snapshot while nothing changes', () => {
    const heard = vi.fn();
    const off = tipsStore.subscribe(heard);
    const a = tipsStore.get();
    expect(tipsStore.get()).toBe(a);
    tipsStore.markSeen('goals');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(tipsStore.get()).not.toBe(a);
    tipsStore.markSeen('goals');
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    tipsStore.markSeen('plan');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('reads a stored value as untrusted: anything in another shape is nothing seen', () => {
    for (const raw of [null, undefined, '', 'not json', 'null', '7', '"today"', '[]', '["today"]', '{}', '{"seen":"today"}', '{"seen":{"today":true}}', '{"seen":[1,null,{}]}', '{"seen":["nowhere","progress","learned"]}']) expect(parseSeen(raw), String(raw)).toEqual([]);
    expect(parseSeen('{"seen":["journal","today","today","nowhere",3]}')).toEqual(['today', 'journal']);
    expect(parseSeen('{"seen":["plan"],"more":1}')).toEqual(['plan']);
  });

  it('shows the tips once more after a damaged copy, then writes it whole', () => {
    mem.setItem(TIPS_KEY, '{"seen":');
    expect([...tipsStore.get().seen]).toEqual([]);
    tipsStore.markSeen('today');
    expect(JSON.parse(mem.getItem(TIPS_KEY)!)).toEqual({ seen: ['today'] });
  });

  it('stays quiet when storage cannot be read: every place counts as seen', () => {
    vi.stubGlobal('localStorage', throwing);
    tipsStore.forgetForTest();
    expect([...tipsStore.get().seen].sort()).toEqual([...TIP_PLACES].sort());
    expect(() => tipsStore.markSeen('today')).not.toThrow();
    expect(() => tipsStore.reset()).not.toThrow();
    // asked for again, they show for as long as the page lives
    expect([...tipsStore.get().seen]).toEqual([]);
    expect(() => tipsStore.markSeen('goals')).not.toThrow();
    expect([...tipsStore.get().seen]).toEqual(['goals']);
  });

  it('stays quiet when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    tipsStore.forgetForTest();
    expect(tipsStore.get().seen.size).toBe(TIP_PLACES.length);
  });

  it('remembers for the session when a write is refused', () => {
    vi.stubGlobal('localStorage', { ...throwing, getItem: () => null });
    tipsStore.forgetForTest();
    expect(tipsStore.get().seen.size).toBe(0);
    tipsStore.markSeen('today');
    expect(tipsStore.get().seen.has('today')).toBe(true);
  });

  it('ignores a place it does not know', () => {
    tipsStore.markSeen('progress' as TipPlace);
    expect(mem.getItem(TIPS_KEY)).toBeNull();
    expect(tipsStore.get().seen.size).toBe(0);
  });

  it('holds the next tip back until the tab changes', () => {
    tipsStore.rose();
    expect(tipsStore.get().rose).toBe(true);
    tipsStore.markSeen('today');
    expect(tipsStore.get().rose).toBe(true);
    tipsStore.tabChanged();
    expect(tipsStore.get().rose).toBe(false);
  });

  it('“Show the tips again” clears what was seen, in storage too, and lets a tip rise where the person is', () => {
    for (const p of TIP_PLACES) tipsStore.markSeen(p);
    tipsStore.rose();
    const heard = vi.fn();
    tipsStore.subscribe(heard);
    tipsStore.reset();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(tipsStore.get()).toEqual({ seen: new Set(), rose: false });
    expect(mem.getItem(TIPS_KEY)).toBeNull();
    expect(tipDue({ path: '/today', prefs: ON, seen: tipsStore.get().seen, overlays: 0, busy: false, replaying: false, rose: tipsStore.get().rose })?.place).toBe('today');
    expect(TIPS_AGAIN).toEqual({ title: 'Show the tips again', sub: 'One short card per tab', done: 'Tips will show again' });
  });
});
