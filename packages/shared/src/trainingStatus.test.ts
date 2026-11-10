import { describe, expect, it } from 'vitest';
import { TRAINING_STATUS_INFO, statusOn, untilFor } from './trainingStatus.js';

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

describe('held days', () => {
  it('sick, injured and rest hold sessions; taper and travel do not', async () => {
    const { heldOn } = await import('./trainingStatus.js');
    const s = (kind: 'sick' | 'taper' | 'rest' | 'travel' | 'injured') => ({ kind, from: '2026-11-08', until: null });
    expect(heldOn(s('sick'), '2026-11-09')).toBe('sick');
    expect(heldOn(s('injured'), '2026-11-09')).toBe('injured');
    expect(heldOn(s('rest'), '2026-11-09')).toBe('rest');
    expect(heldOn(s('taper'), '2026-11-09')).toBeNull();
    expect(heldOn(s('travel'), '2026-11-09')).toBeNull();
    expect(heldOn(s('sick'), '2026-11-07')).toBeNull();
  });
});

describe('the status lines', () => {
  it('say what happens to the plan, with no illness, injury or recovery claims', () => {
    for (const { line } of Object.values(TRAINING_STATUS_INFO)) {
      expect(line).not.toMatch(/recover|heal|hurt|pain|protect|well\b|ill|injur|sick|cure|treat|symptom|doctor/i);
      expect(line).not.toMatch(/—/);
    }
    expect(TRAINING_STATUS_INFO.sick.line).toBe('Time off. Sessions wait until you are back.');
    expect(TRAINING_STATUS_INFO.injured.line).toBe('Time off. Sessions wait until you are back.');
  });
});
