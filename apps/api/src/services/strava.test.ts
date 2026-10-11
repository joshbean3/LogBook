import { describe, expect, it } from 'vitest';
import { kindOf } from './strava.js';

describe('kindOf', () => {
  it('maps Strava sport types onto the three kinds the plan knows', () => {
    expect(kindOf('Run')).toBe('run');
    expect(kindOf('TrailRun')).toBe('run');
    expect(kindOf('WeightTraining')).toBe('lift');
    expect(kindOf('Crossfit')).toBe('lift');
    expect(kindOf('HighIntensityIntervalTraining')).toBe('lift');
    expect(kindOf('Ride')).toBe('cross');
    expect(kindOf('Swim')).toBe('cross');
    expect(kindOf('Yoga')).toBe('cross');
  });
});
