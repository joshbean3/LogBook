import { afterEach, describe, expect, it } from 'vitest';
import { withoutFitnessBoot, withoutFitnessMonths } from '@/features/log/useLog';
import { exampleOf } from '@/features/goals/model';
import { consentSwitches } from '@/features/settings/privacyModel';
import { privacyFacts } from '@/features/auth/PrivacyFacts';
import { FITNESS_METRICS, metricDef } from '@/features/progress/metrics';
import { matchRoute, resolveRoute, shownTabs } from '@/ui/nav';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { disclaimer } from './copy';
import { adoptStoredPrefs, DEFAULT_PREFS, fitnessOn, getPrefs, hasStoredPrefs, isFitnessPath, normalizePrefs, onPrefsChange, parseStoredPrefs, resetPrefsForTest, seedPrefs, setFitness, setTodaySection, TODAY_SECTIONS, todayParts } from './prefs';

const WORDS = /\b(run|runs|running|ran|lift|lifts|mile|miles|mi|plan|plans|planned|training|workout|workouts|strava|fitness)\b/i;

afterEach(() => resetPrefsForTest(null));

describe('the preferences: one place that says what is on', () => {
  it('starts with Fitness on and every Today section showing', () => {
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
    expect(fitnessOn()).toBe(true);
    expect(hasStoredPrefs()).toBe(false);
  });

  it('reads anything stored as whole: only an explicit false is off, unknown keys are dropped', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ fitness: false })).toEqual({ fitness: false, today: { habits: true, day: true, learned: true } });
    expect(normalizePrefs({ fitness: 0, today: { habits: false, other: false } })).toEqual({ fitness: true, today: { habits: false, day: true, learned: true } });
    expect(normalizePrefs('nonsense')).toEqual(DEFAULT_PREFS);
  });

  it('a change is kept, told to listeners, and turning Fitness back on restores the same sections', () => {
    const seen: boolean[] = [];
    const off = onPrefsChange((next) => seen.push(next.fitness));
    setTodaySection('habits', false);
    setFitness(false);
    expect(fitnessOn()).toBe(false);
    expect(hasStoredPrefs()).toBe(true);
    setFitness(true);
    expect(getPrefs()).toEqual({ fitness: true, today: { habits: false, day: true, learned: true } });
    expect(seen).toEqual([true, false, true]);
    off();
  });

  it('the account’s copy seeds a device that has none, and never overrides a choice made here', () => {
    seedPrefs({ fitness: false });
    expect(fitnessOn()).toBe(false);
    resetPrefsForTest(null);
    setFitness(true);
    seedPrefs({ fitness: false });
    expect(fitnessOn()).toBe(true);
  });
});

describe('what is stored is read at the boundary (edge cases)', () => {
  const OFF = { fitness: false, today: { habits: true, day: true, learned: true } };
  it('nothing, an empty string, junk, null, a number, a string or a list is no device copy at all', () => {
    for (const raw of [null, undefined, '', ' ', 'null', '42', '0', 'true', '"off"', '[]', '[{"fitness":false}]', '{"fitness":fal', 'x'.repeat(100_000)]) expect(parseStoredPrefs(raw)).toBeNull();
  });
  it('a record with wrong types, unknown keys or a newer shape defaults safely: Fitness on, every section on', () => {
    expect(parseStoredPrefs('{}')).toEqual(DEFAULT_PREFS);
    expect(parseStoredPrefs('{"fitness":"no","today":5}')).toEqual(DEFAULT_PREFS);
    expect(parseStoredPrefs('{"fitness":0,"today":{"habits":"off","day":null,"learned":[]}}')).toEqual(DEFAULT_PREFS);
    expect(parseStoredPrefs('{"version":3,"prefs":{"fitness":false},"sections":["habits"]}')).toEqual(DEFAULT_PREFS);
    expect(parseStoredPrefs('{"fitness":false,"today":{"learned":false,"zzz":false},"theme":"x"}')).toEqual({ fitness: false, today: { habits: true, day: true, learned: false } });
    expect(Object.keys(parseStoredPrefs('{"fitness":false,"extra":1}')!)).toEqual(['fitness', 'today']);
  });
  it('a stored value that is no record leaves the account free to seed this device', () => {
    expect(parseStoredPrefs('null')).toBeNull();
    seedPrefs(OFF);
    expect(fitnessOn()).toBe(false);
  });
  it('another tab’s change is followed here, told to the screens, and not sent to the account a second time', () => {
    const sent: unknown[] = [];
    const off = onPrefsChange((next) => sent.push(next));
    adoptStoredPrefs(JSON.stringify(OFF));
    expect(getPrefs()).toEqual(OFF);
    expect(hasStoredPrefs()).toBe(true);
    expect(sent).toEqual([]);
    // junk, or the key removed (the other tab signed out), changes nothing here
    adoptStoredPrefs('nonsense');
    adoptStoredPrefs(null);
    expect(getPrefs()).toEqual(OFF);
    off();
  });
  it('ten changes in a row end on the last one, each told once', () => {
    let n = 0;
    const off = onPrefsChange(() => n++);
    for (let i = 0; i < 10; i++) setFitness(i % 2 === 1);
    setFitness(true);
    expect(fitnessOn()).toBe(true);
    // the first call (on to on, nothing stored yet) writes the copy; then nine real changes; the last is no change
    expect(n).toBe(10);
    off();
  });
});

describe('what Today shows', () => {
  it('names its sections as a person reads them: the last is Journal, one line is enough, under the key it always had', () => {
    expect(TODAY_SECTIONS.map((s) => [s.id, s.title, s.sub])).toEqual([
      ['habits', 'Habits', 'The tiles you tap each day'],
      ['day', 'Plan your day', 'Today’s goal and to-dos'],
      ['learned', 'Journal', 'One line is enough'],
    ]);
    // no switch still names the tab that Journal took in, and a copy stored under the old label's key still reads
    for (const s of TODAY_SECTIONS) expect(`${s.title} ${s.sub}`).not.toMatch(/learn/i);
    expect(parseStoredPrefs('{"fitness":true,"today":{"learned":false}}')?.today.learned).toBe(false);
  });
  it('with Fitness on the training card leads, then Plan your day, Habits and the Journal row', () => {
    expect(todayParts(DEFAULT_PREFS)).toEqual(['fitness', 'day', 'habits', 'learned']);
  });
  it('with Fitness off the day’s own content leads: Plan your day, then Habits, then the prompt', () => {
    expect(todayParts({ ...DEFAULT_PREFS, fitness: false })).toEqual(['day', 'habits', 'learned']);
  });
  it('a section switched off is left out, and with everything off there is nothing to draw', () => {
    expect(todayParts({ fitness: true, today: { habits: false, day: true, learned: false } })).toEqual(['fitness', 'day']);
    expect(todayParts({ fitness: false, today: { habits: false, day: false, learned: false } })).toEqual([]);
  });
});

describe('Fitness off: the tab, the routes and the data', () => {
  it('draws four tabs, in the same order, without Fitness', () => {
    expect(shownTabs(true).map((t) => t.label)).toEqual(['Today', 'Goals', 'Fitness', 'Progress', 'Journal']);
    expect(shownTabs(false).map((t) => t.label)).toEqual(['Today', 'Goals', 'Progress', 'Journal']);
  });

  it('knows which routes are Fitness', () => {
    for (const p of ['/plan', '/plan/week/2026-11-09', '/plan/morning', '/fitness', '/settings/training', '/settings/plans', '/progress/metric/mileage', '/progress/metric/pace', '/progress/metric/lifts']) expect(isFitnessPath(p)).toBe(true);
    for (const p of ['/today', '/goals', '/progress', '/progress/metric/sleep', '/progress/metric/consistency', '/settings', '/settings/habits', '/planet']) expect(isFitnessPath(p)).toBe(false);
  });

  it('sends every Fitness route to Today while it is off, and back where it was when it is on again', () => {
    expect(resolveRoute('/fitness').path).toBe('/plan');
    expect(matchRoute('/plan').tab).toBe('plan');
    setFitness(false);
    for (const p of ['/plan', '/fitness', '/plan/week/2026-11-09', '/settings/training', '/settings/plans', '/progress/metric/mileage', '/habits/morning']) expect(resolveRoute(p).path).toBe('/today');
    expect(resolveRoute('/progress/metric/sleep').path).toBe('/progress/metric/sleep');
    expect(resolveRoute('/settings/habits').path).toBe('/settings/habits');
    setFitness(true);
    expect(resolveRoute('/plan/week/2026-11-09').path).toBe('/plan/week/2026-11-09');
  });

  it('leaves training out of what screens read, and deletes nothing', () => {
    const b = { month: '2026-11', sessions: [{ id: 's' }], checks: [{ id: 'c' }], lifts: [{ id: 'l' }], activities: [{ id: 'a' }], morningDays: { '2026-11-12': { wake: 400 } }, journal: [{ id: 'j' }], coach: [{ id: 'k' }] } as unknown as MonthBundle;
    const out = withoutFitnessMonths({ '2026-11': b })['2026-11']!;
    expect([out.sessions, out.activities, out.lifts, out.coach]).toEqual([[], [], [], []]);
    expect([out.checks, out.journal, out.morningDays]).toEqual([b.checks, b.journal, b.morningDays]);
    expect(b.sessions).toHaveLength(1);
    const boot = { user: { id: 'u', email: 'e', status: { kind: 'sick' }, trainingProfile: { goal: 'half' } }, habits: [{ id: 'h' }], blocks: [{ id: 'b' }], zones: [{}], strava: { connected: true }, features: { claude: true, strava: true } } as unknown as Bootstrap;
    const plain = withoutFitnessBoot(boot);
    expect(plain.blocks).toEqual([]);
    expect(plain.user.status).toBeNull();
    expect(plain.user.trainingProfile).toBeNull();
    expect(plain.strava.connected).toBe(false);
    expect(plain.features).toEqual({ claude: true, strava: false });
    expect(plain.habits).toBe(boot.habits);
    expect(boot.blocks).toHaveLength(1);
  });
});

describe('Fitness off: the words the code writes', () => {
  const clean = (s: string) => expect(s).not.toMatch(WORDS);

  it('the goal examples, the notice, the consent switches and the facts list say nothing of training', () => {
    for (const level of ['year', 'month', 'week', 'day'] as const) clean(exampleOf(level, false));
    expect(exampleOf('week', true)).toMatch(/runs/);
    clean(disclaimer(false));
    for (const s of consentSwitches(false)) clean(`${s.title} ${s.sub}`);
    expect(consentSwitches(true)[0]!.title).toBe('Training data');
    const all = { training: true, recall: true, reads: true, health: null, at: '2026-01-01', version: 1 };
    for (const c of [null, all, { ...all, training: false }]) {
      const f = privacyFacts(c as never, false);
      for (const r of [...f.sent, ...f.notSent]) clean(r.text);
    }
  });

  it('Progress keeps Habits and Health: their words are clean, and the training metrics are named as such', () => {
    expect(FITNESS_METRICS).toEqual(['mileage', 'pace', 'lifts']);
    for (const id of ['consistency', 'sleep', 'hrv', 'rhr'] as const) {
      const d = metricDef(id, false);
      clean([d.name, d.what, d.why, d.how, d.emptyLine, ...d.variants.map((v) => `${v.chip ?? ''} ${v.lineName ?? ''}`)].join(' '));
    }
    expect(metricDef('consistency', false).variants.map((v) => v.id)).toEqual(['habits']);
    expect(metricDef('consistency', true).variants.map((v) => v.id)).toEqual(['habits', 'plan']);
  });
});
