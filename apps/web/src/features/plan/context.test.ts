import { describe, expect, it } from 'vitest';
import { mileageHead, phaseWords, shortName, weekTitle } from './context';

describe('Plan context words', () => {
  it('drops the length a block name ends with, and keeps any other name', () => {
    expect(shortName('Half marathon · 12 weeks')).toBe('Half marathon');
    expect(shortName('Base · 1 week')).toBe('Base');
    expect(shortName('Spring 10K')).toBe('Spring 10K');
  });

  it('names a week by where it sits from today', () => {
    const today = '2026-11-08'; // a Sunday: its week starts Nov 2
    expect(weekTitle('2026-11-02', today)).toBe('This week');
    expect(weekTitle('2026-10-26', today)).toBe('Last week');
    expect(weekTitle('2026-11-09', today)).toBe('Next week');
    expect(weekTitle('2026-11-16', today)).toBe('Week of Nov 16');
  });

  it('says a week’s phase, a down week, and a month’s run of phases', () => {
    const phases = {
      '2026-11-09': { phase: 'base' as const, down: false },
      '2026-11-16': { phase: 'base' as const, down: false },
      '2026-11-23': { phase: 'build' as const, down: false },
      '2026-11-30': { phase: 'build' as const, down: true },
    };
    expect(phaseWords(phases, ['2026-11-09'])).toEqual({ phase: 'base', title: 'Base', sub: 'Easy miles first' });
    expect(phaseWords(phases, ['2026-11-30'])?.sub).toBe('A lighter week');
    expect(phaseWords(phases, ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])).toEqual({ phase: 'build', title: 'Base to build', sub: '4 weeks' });
    expect(phaseWords(phases, ['2026-11-02'])).toBeNull();
  });
});

describe('the mileage card head', () => {
  it('leads with what was run against the plan', () => {
    expect(mileageHead({ ran: 10.46, planned: 26, runsDone: 2, runsPlanned: 4, ahead: false })).toEqual({ value: '10.5', unit: 'of 26 mi', runsWord: '2 of 4 runs', hit: false });
  });
  it('says what a week ahead plans', () => {
    expect(mileageHead({ ran: 0, planned: 25, runsDone: 0, runsPlanned: 4, ahead: true })).toMatchObject({ value: '25', unit: 'mi planned', runsWord: '4 runs' });
  });
  it('never shows a zero headline for an empty week, and marks a week that ran its target', () => {
    expect(mileageHead({ ran: 0, planned: 0, runsDone: 0, runsPlanned: 0, ahead: false })).toEqual({ value: '–', unit: 'mi', runsWord: '', hit: false });
    expect(mileageHead({ ran: 26, planned: 26, runsDone: 4, runsPlanned: 4, ahead: false }).hit).toBe(true);
  });
});
