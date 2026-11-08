import { Bike, Dumbbell, Flag, Footprints, Gauge, Moon, Route, Zap } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { sessionIcon } from './sessionIcon';

describe('sessionIcon', () => {
  it('gives each kind of session its glyph', () => {
    expect(sessionIcon(null)).toBe(Footprints);
    expect(sessionIcon({ kind: 'rest', type: null, title: null })).toBe(Moon);
    expect(sessionIcon({ kind: 'lift', type: 'Strength', title: 'Lower body' })).toBe(Dumbbell);
    expect(sessionIcon({ kind: 'cross', type: 'Bike', title: null })).toBe(Bike);
  });
  it('tells runs apart by their type', () => {
    expect(sessionIcon({ kind: 'run', type: 'easy', title: 'Easy 4' })).toBe(Footprints);
    expect(sessionIcon({ kind: 'run', type: 'long', title: 'Long 11' })).toBe(Route);
    expect(sessionIcon({ kind: 'run', type: 'tempo', title: 'Tempo 6' })).toBe(Zap);
    expect(sessionIcon({ kind: 'run', type: 'intervals', title: '6 x 800' })).toBe(Gauge);
    expect(sessionIcon({ kind: 'run', type: 'Race', title: 'Half marathon' })).toBe(Flag);
  });
});
