import { describe, expect, it } from 'vitest';
import { jumpWords, LAST_RUN_DAY, milesJump } from './trainingModel';

describe('the rebuild warning', () => {
  it('warns only for a rise of more than 30% over the current week', () => {
    expect(milesJump(20, 26)).toBeNull(); // exactly 30%
    expect(milesJump(20, 27)).toEqual({ from: 20, to: 27, pct: 35 });
    expect(milesJump(25, 80)).toEqual({ from: 25, to: 80, pct: 220 });
    expect(milesJump(25, 20)).toBeNull();
  });
  it('has nothing to compare with when there is no plan', () => {
    expect(milesJump(null, 40)).toBeNull();
    expect(milesJump(0, 40)).toBeNull();
  });
  it('says the two numbers and the rise', () => {
    expect(jumpWords({ from: 25, to: 40, pct: 60 })).toBe('That is 60% more than now, 25 to 40 miles a week. Jumps this big are where injuries tend to start.');
    expect(LAST_RUN_DAY).toBe('Keep at least one run day.');
  });
});
