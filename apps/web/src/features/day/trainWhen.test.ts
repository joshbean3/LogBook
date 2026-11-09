import { describe, expect, it } from 'vitest';
import { afternoonStops, DEFAULT_AFTERNOON, faceForWhen, sessionMinutes } from './trainWhen';
import type { Face } from './faces';

describe('when you train', () => {
  it('builds the afternoon from the end of work, the way home and the run’s length', () => {
    const s = afternoonStops(DEFAULT_AFTERNOON, 40);
    expect(s.map((x) => x.label)).toEqual(['Off work', 'Run', 'Back', 'Dinner']);
    expect(s.map((x) => x.at)).toEqual([1050, 1090, 1130, 1160]);
  });
  it('times a run from its minutes, else its miles at the easy pace', () => {
    expect(sessionMinutes({ minutes: 50, miles: 4 }, 540)).toBe(50);
    expect(sessionMinutes({ minutes: null, miles: 4 }, 540)).toBe(36);
    expect(sessionMinutes(null, 540)).toBe(45);
  });
  const face = { key: 'm', kind: 'morning', eyebrow: 'THIS MORNING', stamp: 'EASY 4', line: 'Out the door in 20 min', stops: [{ key: 'wake', label: 'Wake', at: 390 }], stopsLabel: 'x', lead: { session: { kind: 'run', miles: 4, minutes: null } } } as unknown as Face;
  it('swaps in the afternoon’s line on a training day', () => {
    const f = faceForWhen(face, 'afternoon', DEFAULT_AFTERNOON, 540);
    expect(f.stopsKind).toBe('afternoon');
    expect(f.stops?.[1]?.label).toBe('Run');
    expect(f.line).toMatch(/^Run at /);
  });
  it('hides the line for no set time, and leaves morning as planned', () => {
    expect(faceForWhen(face, 'none', DEFAULT_AFTERNOON, 540).stops).toBeUndefined();
    expect(faceForWhen(face, 'morning', DEFAULT_AFTERNOON, 540)).toBe(face);
  });
  it('never touches a rest day', () => {
    const rest = { ...face, lead: undefined } as unknown as Face;
    expect(faceForWhen(rest, 'afternoon', DEFAULT_AFTERNOON, 540)).toBe(rest);
  });
});
