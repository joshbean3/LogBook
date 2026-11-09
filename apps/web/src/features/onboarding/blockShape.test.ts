import { describe, expect, it } from 'vitest';
import { blockLine, blockShape, buildSteps, defaultRaceDay, safeTemplate, type TrainingProfile } from './model';

const start = '2026-11-10';
const half: TrainingProfile = { goal: 'half', raceDate: defaultRaceDay('half', start), runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18 };

describe('the block shape under the first questions', () => {
  it('reads weeks, the build range and the taper off the real template', () => {
    const s = blockShape(safeTemplate(half, start))!;
    expect(s.weeks).toBeGreaterThan(6);
    expect(s.taperWeeks).toBeGreaterThan(0);
    expect(s.peak).toBeGreaterThan(s.from);
    expect(s.raceDate).toBe(half.raceDate);
    expect(s.bars.at(-1)!.kind).toBe('race');
    expect(Math.max(...s.bars.map((b) => b.h))).toBeLessThanOrEqual(1);
    expect(blockLine(s)).toMatch(/^\d+ weeks\. \d+ to \d+ mi a week, then a \d-week taper\.$/);
  });

  it('moves when the answers move: more miles now, a higher peak', () => {
    const lo = blockShape(safeTemplate(half, start))!;
    const hi = blockShape(safeTemplate({ ...half, weeklyMiles: 30 }, start))!;
    expect(hi.peak).toBeGreaterThan(lo.peak);
  });

  it('has no taper for just running, and says nothing of one', () => {
    const s = blockShape(safeTemplate({ ...half, goal: 'base', raceDate: null }, start))!;
    expect(s.taperWeeks).toBe(0);
    expect(blockLine(s)).not.toMatch(/taper/);
  });

  it('lists only steps the answers asked for', () => {
    const s = blockShape(safeTemplate(half, start));
    const steps = buildSteps(half, s, 390, 510, 2);
    expect(steps[1]).toBe('Putting the long run on Sunday');
    expect(steps).toContain('Fitting runs between 6:30 and 8:30');
    expect(steps.at(-1)).toBe('Adding 2 lights to Today');
    expect(buildSteps({ ...half, goal: 'base', raceDate: null }, null, 390, 510, 0).some((x) => /taper|race|lights/i.test(x))).toBe(false);
  });
});
