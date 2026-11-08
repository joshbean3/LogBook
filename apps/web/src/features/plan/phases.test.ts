import { buildTemplate, shiftDays } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { phasesOf } from './phases';

const MON = '2026-11-09';

describe('training phases from a block’s shape', () => {
  it('reads the template’s taper, race week and down weeks back from its volumes', () => {
    const t = buildTemplate({ goal: 'half', startDate: MON, runDays: ['mon', 'wed', 'fri', 'sat'], longRunDay: 'sat', weeklyMiles: 22, raceDate: shiftDays(MON, 7 * 11 + 6) });
    const weeks = t.weeks.filter((w) => w.week > 0);
    const p = phasesOf(
      weeks.map((w) => w.miles),
      { race: true, base: false },
    );
    expect(p.length).toBe(weeks.length);
    weeks.forEach((w, i) => {
      if (w.kind === 'race') expect(p[i]!.phase).toBe('race');
      if (w.kind === 'taper') expect(p[i]!.phase).toBe('taper');
      if (w.kind === 'down') expect(p[i]!.down).toBe(true);
    });
    expect(p[0]!.phase).toBe('base');
    expect(p.some((w) => w.phase === 'build')).toBe(true);
    expect(p.some((w) => w.phase === 'peak')).toBe(true);
    // in order: base, then build, then peak, then taper, then race week (down weeks keep their place)
    const order = ['base', 'build', 'peak', 'taper', 'race'];
    const seq = p.map((w) => order.indexOf(w.phase));
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });

  it('keeps a down week just before the taper a down week', () => {
    const p = phasesOf([20, 22, 24, 18, 26, 26, 19.5, 21, 14, 8], { race: true, base: false });
    expect(p[6]).toEqual({ phase: 'build', down: true });
    expect(p.slice(7).map((w) => w.phase)).toEqual(['taper', 'taper', 'race']);
    expect(p[5]!.phase).toBe('peak');
  });

  it('builds to a peak at the end with no race, and calls every week of a base block base', () => {
    const noRace = phasesOf([20, 22, 24, 18, 26, 28], { race: false, base: false });
    expect(noRace.map((w) => w.phase)).toEqual(['base', 'base', 'build', 'build', 'build', 'peak']);
    expect(noRace[3]!.down).toBe(true);
    expect(phasesOf([20, 22, 16, 24], { race: false, base: true }).every((w) => w.phase === 'base')).toBe(true);
  });

  it('copes with nothing planned yet', () => {
    expect(phasesOf([], { race: false, base: false })).toEqual([]);
    expect(phasesOf([0, 0, 0], { race: false, base: false }).map((w) => w.phase)).toEqual(['base', 'build', 'build']);
  });
});
