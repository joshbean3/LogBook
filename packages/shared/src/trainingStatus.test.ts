import { describe, expect, it } from 'vitest';
import { statusOn, untilFor } from './trainingStatus.js';

describe('day status', () => {
  const s = { kind: 'sick' as const, from: '2026-11-08', until: '2026-11-10' };
  it('applies from its first day through its last, inclusive', () => {
    expect(statusOn(s, '2026-11-07')).toBe('training');
    expect(statusOn(s, '2026-11-08')).toBe('sick');
    expect(statusOn(s, '2026-11-10')).toBe('sick');
    expect(statusOn(s, '2026-11-11')).toBe('training');
  });
  it('with no end, holds until changed; none is training', () => {
    expect(statusOn({ ...s, until: null }, '2027-01-01')).toBe('sick');
    expect(statusOn(null, '2026-11-08')).toBe('training');
  });
  it('turns a length into an end day', () => {
    expect(untilFor('2026-11-08', 0)).toBe('2026-11-08');
    expect(untilFor('2026-11-08', 6)).toBe('2026-11-14');
    expect(untilFor('2026-11-08', null)).toBeNull();
  });
});
