import type { Consent } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { gateOf } from './gate';

const consent = (c: Partial<Consent> = {}): Consent => ({ training: false, health: null, recall: false, reads: false, at: null, version: null, ...c });

describe('the assistant’s permission gate', () => {
  it('asks an account that never chose, whatever its switches say', () => {
    expect(gateOf(consent(), false, false)).toBe('ask');
    expect(gateOf(consent({ training: true }), false, false)).toBe('ask');
  });

  it('opens once a choice is stored, Allow or Only what I type', () => {
    expect(gateOf(consent({ training: true, at: '2026-11-10T09:00:00.000Z', version: '2026-11' }), false, false)).toBe('open');
    expect(gateOf(consent({ training: false, at: '2026-11-10T09:00:00.000Z', version: '2026-11' }), false, false)).toBe('open');
  });

  it('asks when the server says no choice is stored, even if the phone remembers one', () => {
    expect(gateOf(consent({ training: true, at: '2026-11-01T09:00:00.000Z' }), true, false)).toBe('ask');
  });

  it('never opens while the choice is not known', () => {
    expect(gateOf(undefined, false, false)).toBe('checking');
    expect(gateOf(null, false, false)).toBe('checking');
    expect(gateOf(undefined, false, true)).toBe('unknown');
  });
});
