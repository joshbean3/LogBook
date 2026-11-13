import { emptyRewards, parseISO, RULES, shiftDays, type Rewards } from '@logbook/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The selectors the screens read Orbs through. Each returns a primitive (or one remembered object), so a screen that
 * shows the same thing does not render again; with Orbs switched off, or before there is a store, each returns its
 * nothing. Rendered on the server renderer, which needs no DOM.
 */
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));
const U = 'u_owner';
const MON = shiftDays(RULES.startsOn, 21);
const TODAY = shiftDays(MON, 2);
const g = globalThis as unknown as Record<string, unknown>;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const stored = (): Rewards => ({
  ...emptyRewards(U, RULES.startsOn),
  clock: TODAY,
  days: {
    ...Object.fromEntries(Array.from({ length: 21 }, (_, i) => [shiftDays(RULES.startsOn, i), { n: 10, a: 4, c: 1 as const }]).filter((_, i) => i % 7 < 5)),
    [MON]: { n: 6, a: 3, k: { habit: 3, 'goal:day': 3 }, c: 1 },
    [TODAY]: { n: 12, a: 7, k: { todo: 2, habit: 5, full: 5 } },
  },
  once: { [`week:${RULES.startsOn}`]: { on: shiftDays(RULES.startsOn, 8), n: 5 }, [`week:${shiftDays(RULES.startsOn, 7)}`]: { on: shiftDays(RULES.startsOn, 15), n: 10 } },
  challenges: { [`challenge:d:${TODAY}`]: { item: 'habits', target: 5, base: 0, state: 'offered', at: '2026-12-09T08:00:00.000Z' } },
  keepsakes: { first: { on: RULES.startsOn }, 'days:10': { on: shiftDays(RULES.startsOn, 13) } },
  seen: { first: RULES.startsOn },
});
const launch = async (s: Rewards | null) => {
  vi.resetModules();
  const local = mem();
  Object.assign(g, { localStorage: local, sessionStorage: mem() });
  if (s) local.setItem('logbook.orbs', JSON.stringify(s));
  const store = await import('./store');
  store.openOrbs(U);
  return store;
};
type Store = typeof import('./store');
const Probe = ({ s }: { s: Store }) => {
  const level = s.useLevelInfo();
  const count = s.useCount();
  return (
    <p>
      {[
        `on=${s.useOrbsOn()}`,
        `show=${s.useShowOrbs()}`,
        `today=${s.useOrbsToday()}`,
        `monday=${s.useOrbsOnDay(MON)}`,
        `total=${s.useOrbsTotal()}`,
        `level=${s.useLevel()}`,
        `left=${level.left}`,
        `marks=${s.useWeekMarks()}`,
        `days=${s.useDaysInAll()}`,
        `weeks=${s.useWeeksInRow()}`,
        `week=${count.thisWeek}/${count.target}`,
        `target=${s.useWeekTarget()}`,
        `cadence=${s.useChallengeCadence()}`,
        `size=${s.useChallengeSize()}`,
        `new=${s.useNewCount()}`,
        `challenge=${s.useChallenge(`challenge:d:${TODAY}`)?.item ?? 'none'}`,
        `store=${s.useOrbsStore() ? 'yes' : 'no'}`,
      ].join(' ')}
    </p>
  );
};
const read = (s: Store) => renderToStaticMarkup(<Probe s={s} />).replace(/<\/?p>/g, '');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = parseISO(TODAY);
  now.setHours(12);
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  delete g.localStorage;
  delete g.sessionStorage;
});

describe('the selectors', () => {
  it('read the store as primitives', async () => {
    const s = await launch(stored());
    // 15 counted days before this week at 10, Monday 6, today 12, and two weekly bonuses
    expect(read(s)).toBe('on=true show=true today=12 monday=6 total=183 level=3 left=17 marks=1010000 days=17 weeks=3 week=2/5 target=5 cadence=1 size=steady new=1 challenge=habits store=yes');
  });
  it('return the same object while the store stands, and a new one when it changes', async () => {
    const s = await launch(stored());
    const seen: unknown[] = [];
    const Hold = () => {
      seen.push(s.useCount(), s.useLevelInfo(), s.useChallenge(`challenge:d:${TODAY}`));
      return null;
    };
    renderToStaticMarkup(<Hold />);
    renderToStaticMarkup(<Hold />);
    expect(seen[0]).toBe(seen[3]);
    expect(seen[1]).toBe(seen[4]);
    expect(seen[2]).toBe(seen[5]);
    s.updateOrbs((r) => ({ ...r, days: { ...r.days, [TODAY]: { n: 13, a: 8, k: { todo: 3, habit: 5, full: 5 } } } }));
    renderToStaticMarkup(<Hold />);
    expect(seen[6]).not.toBe(seen[0]);
    expect(seen[7]).not.toBe(seen[1]);
    expect(seen[8]).toBe(seen[2]);
  });
  it('with Orbs switched off everything reads as nothing, and nothing is lost', async () => {
    const s = await launch(stored());
    s.setSwitches({ on: false });
    expect(read(s)).toBe('on=false show=false today=0 monday=0 total=0 level=1 left=25 marks=0000000 days=0 weeks=0 week=0/5 target=5 cadence=1 size=steady new=0 challenge=none store=no');
    expect(s.pendingMoments()).toEqual([]);
    expect(s.newKeys()).toEqual([]);
    s.setSwitches({ on: true });
    expect(read(s)).toContain('total=183');
  });
  it('“Show Orbs when you earn them” off keeps the count and says not to show', async () => {
    const s = await launch(stored());
    s.setSwitches({ show: false });
    expect(read(s)).toContain('on=true show=false today=12');
  });
  it('before there is a store (a first open, another account’s copy) everything reads as nothing', async () => {
    const s = await launch({ ...stored(), userId: 'u_someone_else' });
    expect(read(s)).toBe('on=true show=true today=0 monday=0 total=0 level=1 left=25 marks=0000000 days=0 weeks=0 week=0/5 target=5 cadence=1 size=steady new=0 challenge=none store=no');
  });
  it('a change tells its listeners once, and a change that changes nothing tells no one', async () => {
    const s = await launch(stored());
    const heard = vi.fn();
    const off = s.onOrbsChange(heard);
    s.markSeen('days:10');
    expect(heard).toHaveBeenCalledTimes(1);
    s.markSeen('days:10');
    s.setSwitches({ weekTarget: 5 });
    s.updateOrbs((r) => r);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    s.setSwitches({ weekTarget: 3 });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(s.getSwitches().weekTarget).toBe(3);
    expect(s.getOrbs()?.set.weekTarget).toBe(3);
  });
});
