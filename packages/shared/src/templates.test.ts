import { describe, expect, it } from 'vitest';
import { daysBetween } from './dates.js';
import { zTemplateInput, type TemplateInput } from './schemas.js';
import { label } from './sessions.js';
import { buildTemplate, GOAL_SPECS, TemplateError, TEMPLATE_RULES, weekdayOf, type Template } from './templates.js';

const base: TemplateInput = { goal: 'half', startDate: '2026-10-19', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 20, weeks: 12 };
const full = (t: Template) => t.weeks.filter((w) => w.week > 0);
const ofWeek = (t: Template, w: number) => t.sessions.filter((s) => s.week === w);
const nonRace = (t: Template, w: number) => ofWeek(t, w).filter((s) => s.type !== 'Race');
const sum = (xs: Array<{ miles: number }>) => Math.round(xs.reduce((a, s) => a + s.miles, 0) * 10) / 10;

describe('buildTemplate', () => {
  it('names and dates the block, and names sessions the way the app does', () => {
    const t = buildTemplate(base);
    expect(t.name).toBe('Half marathon · 12 weeks');
    expect(t.start).toBe('2026-10-19');
    expect(t.end).toBe('2027-01-10');
    expect(t.weeks).toHaveLength(12);
    for (const s of t.sessions) {
      expect(s.title).toBeNull();
      expect(label({ kind: s.kind, type: s.type, title: s.title, miles: s.miles })).toMatch(/^(Easy|Long|Tempo|Threshold|Intervals|Hills|Speed|Fartlek|Race) \d+(\.\d+)?$/);
    }
    expect(label(t.sessions.find((s) => s.type === 'Long')!)).toBe('Long 6');
    expect(t.summary).toMatch(/^20 to \d+(\.5)? mi a week, a down week every 4th/);
  });

  it('puts runs only on the chosen days, the long run on its day', () => {
    for (const goal of ['base', '5k', '10k', 'half', 'marathon'] as const) {
      const t = buildTemplate({ ...base, goal, runDays: ['mon', 'wed', 'fri'], longRunDay: 'sat' });
      for (const s of t.sessions) expect(['mon', 'wed', 'fri', 'sat']).toContain(weekdayOf(s.date));
      for (const s of t.sessions.filter((x) => x.type === 'Long')) expect(weekdayOf(s.date)).toBe('sat');
      // one session a day at most, all inside the block
      expect(new Set(t.sessions.map((s) => s.date)).size).toBe(t.sessions.length);
      for (const s of t.sessions) expect(s.date >= t.start && s.date <= t.end).toBe(true);
    }
  });

  it('week 1 is the athlete’s volume and each week adds up to its target', () => {
    const t = buildTemplate(base);
    expect(full(t)[0]!.target).toBe(20);
    for (const w of full(t)) {
      expect(sum(ofWeek(t, w.week))).toBe(w.miles);
      expect(Math.abs(w.miles - w.target)).toBeLessThanOrEqual(0.5);
    }
  });

  it('builds 8–10% a week, with a down week every 4th', () => {
    const t = buildTemplate({ ...base, goal: 'marathon', weeks: 16, weeklyMiles: 30, runDays: ['tue', 'wed', 'thu', 'sat', 'sun'] });
    const ws = full(t);
    for (let i = 1; i < ws.length; i++) {
      const w = ws[i]!;
      if (w.week % 4 === 0) {
        expect(w.kind).toBe('down');
        const prev = ws[i - 1]!.target;
        expect(w.target).toBeLessThan(prev);
        expect(w.target / prev).toBeGreaterThan(0.7);
        expect(w.target / prev).toBeLessThan(0.8);
      } else {
        expect(w.kind).toBe('build');
        // growth from the last build week, rounded to half miles
        const lastBuild = [...ws.slice(0, i)].reverse().find((x) => x.kind === 'build')!.target;
        expect(w.target).toBeGreaterThanOrEqual(lastBuild);
        expect(w.target).toBeLessThanOrEqual(lastBuild * TEMPLATE_RULES.growSmall + 0.5);
      }
    }
    expect(ws[1]!.target).toBe(32.5); // 30 * 1.08 = 32.4 → 32.5
    // the build tops out at 1.6x the start (48), under the marathon ceiling of 60
    expect(Math.max(...ws.map((w) => w.target))).toBe(48);
  });

  it('long run is ~25–30% of the week with 4+ days, the longest run of the week, under the goal cap', () => {
    for (const goal of ['5k', '10k', 'half', 'marathon', 'base'] as const) {
      const t = buildTemplate({ ...base, goal, weeklyMiles: 30, runDays: ['tue', 'wed', 'thu', 'sat', 'sun'] });
      for (const w of full(t)) {
        const long = ofWeek(t, w.week).find((s) => s.type === 'Long')!;
        expect(long).toBeTruthy();
        expect(long.miles).toBeLessThanOrEqual(GOAL_SPECS[goal].longCap);
        for (const s of ofWeek(t, w.week)) expect(s.miles).toBeLessThanOrEqual(long.miles);
        if (long.miles < GOAL_SPECS[goal].longCap) {
          expect(long.miles / w.target).toBeGreaterThanOrEqual(0.23);
          expect(long.miles / w.target).toBeLessThanOrEqual(0.32);
        }
      }
    }
  });

  it('one quality session a week for race goals, away from the long run; none for base', () => {
    const quality = /^(Intervals|Hills|Speed|Tempo|Threshold)$/;
    for (const goal of ['5k', '10k', 'half', 'marathon'] as const) {
      const t = buildTemplate({ ...base, goal, weeklyMiles: 25 });
      for (const w of full(t)) {
        const q = ofWeek(t, w.week).filter((s) => quality.test(s.type));
        if (w.kind === 'build') {
          expect(q).toHaveLength(1);
          // Tue/Thu/Sat/Sun with the long run Sunday: Thursday is farthest
          expect(weekdayOf(q[0]!.date)).toBe('thu');
          expect(q[0]!.details).toMatch(/wu, .*, [\d.]+ mi cd$/);
        }
        if (w.kind === 'down') {
          expect(q).toHaveLength(0);
          expect(ofWeek(t, w.week).some((s) => s.type === 'Fartlek')).toBe(true);
        }
      }
    }
    const b = buildTemplate({ ...base, goal: 'base', weeklyMiles: 25 });
    expect(b.sessions.some((s) => quality.test(s.type))).toBe(false);
    expect(b.sessions.some((s) => s.details === 'Easy with 4 × 20 s strides')).toBe(true);
    // the marathon rotation includes marathon pace
    const m = buildTemplate({ ...base, goal: 'marathon', weeklyMiles: 30 });
    expect(m.sessions.some((s) => /marathon pace/.test(s.details ?? ''))).toBe(true);
  });

  it('tapers into race day: 3 weeks for a marathon, 2 for a half, 1 for 5K/10K', () => {
    const cases = [
      { goal: 'marathon' as const, race: '2027-02-21', taper: 3, miles: 26.2 },
      { goal: 'half' as const, race: '2027-01-17', taper: 2, miles: 13.1 },
      { goal: '10k' as const, race: '2026-12-19', taper: 1, miles: 6.2 },
      { goal: '5k' as const, race: '2026-12-12', taper: 1, miles: 3.1 },
    ];
    for (const c of cases) {
      const t = buildTemplate({ ...base, goal: c.goal, raceDate: c.race, weeklyMiles: 25, weeks: undefined });
      expect(t.end).toBe(c.race);
      expect(t.name).toMatch(/· (Feb 21|Jan 17|Dec 19|Dec 12)$/);
      const race = t.sessions.filter((s) => s.type === 'Race');
      expect(race).toHaveLength(1);
      expect(race[0]).toMatchObject({ date: c.race, miles: c.miles, floorMin: null });
      expect(t.sessions.every((s) => s.date <= c.race)).toBe(true);
      const ws = full(t);
      const tapered = ws.filter((w) => w.kind === 'taper' || w.kind === 'race');
      expect(tapered).toHaveLength(c.taper);
      expect(ws[ws.length - 1]!.kind).toBe('race');
      const peak = Math.max(...ws.filter((w) => w.kind === 'build').map((w) => w.target));
      // each taper week lighter than the one before, race week the lightest
      let prev = peak;
      for (const w of tapered) {
        expect(w.target).toBeLessThan(prev);
        prev = w.target;
      }
      const raceWeek = ws[ws.length - 1]!;
      expect(sum(nonRace(t, raceWeek.week))).toBeLessThanOrEqual(raceWeek.target + 0.5);
      expect(nonRace(t, raceWeek.week).some((s) => s.type === 'Long')).toBe(false);
      // the day before is a 3 mi shakeout when it is a run day
      const eve = nonRace(t, raceWeek.week).find((s) => daysBetween(s.date, c.race) === 1);
      if (eve) expect(eve).toMatchObject({ miles: 3, details: 'Shakeout with 4 × 20 s strides' });
    }
  });

  it('every run has a floor in minutes, consistent with floorFor, and the run is longer than it', () => {
    const t = buildTemplate({ ...base, goal: 'marathon', raceDate: '2027-02-21', weeklyMiles: 15, weeks: undefined, runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
    for (const s of t.sessions) {
      if (s.type === 'Race') continue;
      expect(s.floorMin).toBe(s.type === 'Long' ? 30 : 20);
      // even at 12:00/mi the run is past its floor
      expect(s.miles * 12).toBeGreaterThan(s.floorMin!);
      expect(s.minutes).toBeNull();
      expect(s.miles).toBeGreaterThanOrEqual(TEMPLATE_RULES.easyMin);
    }
  });

  it('low volume on many days drops easy days rather than writing 1-mile runs', () => {
    const t = buildTemplate({ goal: 'base', startDate: '2026-10-19', weeks: 4, runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], longRunDay: 'sat', weeklyMiles: 10 });
    const w1 = ofWeek(t, 1);
    expect(sum(w1)).toBe(10);
    expect(w1.length).toBeLessThan(6);
    for (const s of t.sessions) expect(s.miles).toBeGreaterThanOrEqual(3);
  });

  it('a mid-week start gets a lead-in (easy runs, and the long run on its day), then full weeks from Monday', () => {
    const t = buildTemplate({ ...base, startDate: '2026-10-15', weeks: 4 }); // a Thursday
    expect(t.weeks[0]).toMatchObject({ week: 0, kind: 'lead-in' });
    const lead = ofWeek(t, 0);
    expect(lead.map((s) => s.date)).toEqual(['2026-10-15', '2026-10-17', '2026-10-18']);
    expect(lead.map((s) => s.type)).toEqual(['Easy', 'Easy', 'Long']);
    expect(lead.some((s) => /Tempo|Threshold|Intervals|Hills|Speed/.test(s.type))).toBe(false);
    expect(full(t)).toHaveLength(4);
    expect(t.end).toBe('2026-11-15');
  });

  it('adds the long run day to the run days if it was left out; one run day makes it the only run', () => {
    const t = buildTemplate({ ...base, runDays: ['tue', 'thu'], longRunDay: 'sun' });
    expect(new Set(t.sessions.map((s) => weekdayOf(s.date)))).toEqual(new Set(['tue', 'thu', 'sun']));
    const one = buildTemplate({ goal: 'base', startDate: '2026-10-19', weeks: 2, runDays: ['sat'], longRunDay: 'sat', weeklyMiles: 6 });
    expect(one.sessions.map((s) => [s.type, s.miles])).toEqual([
      ['Long', 6],
      ['Long', 6.5],
    ]);
  });

  it('refuses a race too far out or too close', () => {
    expect(() => buildTemplate({ ...base, raceDate: '2027-12-01' })).toThrow(TemplateError);
    expect(() => buildTemplate({ ...base, startDate: '2026-10-15', raceDate: '2026-10-17' })).toThrow(TemplateError);
  });

  it('validates input with zod', () => {
    expect(zTemplateInput.safeParse(base).success).toBe(true);
    expect(zTemplateInput.safeParse({ ...base, goal: 'ultra' }).success).toBe(false);
    expect(zTemplateInput.safeParse({ ...base, runDays: [] }).success).toBe(false);
    expect(zTemplateInput.safeParse({ ...base, runDays: ['monday'] }).success).toBe(false);
    expect(zTemplateInput.safeParse({ ...base, raceDate: '2026-10-01' }).success).toBe(false);
    expect(zTemplateInput.safeParse({ ...base, weeks: 31 }).success).toBe(false);
  });

  describe('the first week a new athlete sees (contract 7)', () => {
    const easyOf = (t: Template, w: number) => ofWeek(t, w).filter((x) => x.type === 'Easy').map((x) => x.miles);
    const longOf = (t: Template, w: number) => ofWeek(t, w).find((x) => x.type === 'Long');
    const cases: TemplateInput[] = [
      { goal: 'base', startDate: '2026-10-19', runDays: ['mon', 'tue', 'thu', 'sat'], longRunDay: 'sun', weeklyMiles: 22 },
      { goal: 'half', startDate: '2026-10-19', runDays: ['tue', 'wed', 'fri', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 25 },
      { goal: '10k', startDate: '2026-10-19', runDays: ['mon', 'wed', 'fri', 'sun'], longRunDay: 'sun', weeklyMiles: 15 },
      { goal: 'marathon', startDate: '2026-10-19', runDays: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], longRunDay: 'sat', weeklyMiles: 35 },
    ];
    it('varies the easy days by 0.5–1 mi and keeps the week on its target', () => {
      for (const c of cases) {
        const t = buildTemplate(c);
        const easy = easyOf(t, 1);
        expect(easy.length, c.goal).toBeGreaterThanOrEqual(2);
        expect(new Set(easy).size, `${c.goal} ${easy}`).toBeGreaterThan(1);
        for (let i = 0; i < easy.length; i++)
          for (let j = i + 1; j < easy.length; j++) {
            const d = Math.abs(easy[i]! - easy[j]!);
            if (d) expect(d, `${c.goal} ${easy}`).toBeGreaterThanOrEqual(0.5);
            expect(d, `${c.goal} ${easy}`).toBeLessThanOrEqual(1);
          }
        expect(Math.abs(sum(ofWeek(t, 1)) - t.weeks.find((w) => w.week === 1)!.target)).toBeLessThanOrEqual(0.5);
      }
    });
    it('puts the long run on the chosen long-run day, longer than any other run that week', () => {
      for (const c of cases) {
        const t = buildTemplate(c);
        const long = longOf(t, 1)!;
        expect(weekdayOf(long.date)).toBe(c.longRunDay);
        for (const s of ofWeek(t, 1)) if (s !== long) expect(s.miles, `${c.goal} ${s.type}`).toBeLessThan(long.miles);
      }
    });
    it('a block starting tomorrow (onboarding "start tomorrow") reaches the long-run day in its lead-in', () => {
      // Thursday start, runs Tue/Thu/Sat with the long run Sunday: Thu, Sat easy (not the same), Sun long
      const t = buildTemplate({ goal: 'base', startDate: '2026-10-15', runDays: ['tue', 'thu', 'sat'], longRunDay: 'sun', weeklyMiles: 22 });
      const lead = ofWeek(t, 0);
      expect(lead.map((s) => [weekdayOf(s.date), s.type])).toEqual([['thu', 'Easy'], ['sat', 'Easy'], ['sun', 'Long']]);
      expect(lead[0]!.miles).not.toBe(lead[1]!.miles);
      expect(lead[2]!.miles).toBeGreaterThan(Math.max(lead[0]!.miles, lead[1]!.miles));
    });
  });
});
