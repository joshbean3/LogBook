import { screenLabel } from '@logbook/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/NavController', () => ({ useNavInternal: () => null }));
const { screenOf } = await import('./screen');

describe('the screen the assistant was opened from', () => {
  it('carries the day on Today, the week or month on Plan, and only the tab elsewhere', () => {
    expect(screenOf('today', '/today/2026-11-10', undefined, '2026-11-10', '2026-11-08')).toEqual({ tab: 'today', date: '2026-11-10' });
    expect(screenOf('plan', '/plan/week/2026-11-09', undefined, '2026-11-08', '2026-11-08')).toEqual({ tab: 'plan', week: '2026-11-09' });
    expect(screenOf('plan', '/plan/month/2026-12', undefined, '2026-11-08', '2026-11-08')).toEqual({ tab: 'plan', month: '2026-12' });
    expect(screenOf('plan', '/plan', undefined, '2026-11-08', '2026-11-08')).toEqual({ tab: 'plan', week: '2026-11-02' });
    expect(screenOf('progress', '/progress', undefined, '2026-11-08', '2026-11-08')).toEqual({ tab: 'progress' });
    expect(screenOf('today', '/today', '/settings/you', '2026-11-08', '2026-11-08')).toBeUndefined();
  });

  it('reads in words on the chip', () => {
    expect(screenLabel({ tab: 'today', date: '2026-11-08' })).toBe('Today, Sun Nov 8');
    expect(screenLabel({ tab: 'plan', week: '2026-11-09' })).toBe('Fitness, week of Nov 9');
    expect(screenLabel({ tab: 'plan', month: '2026-12' })).toBe('Fitness, December 2026');
    expect(screenLabel({ tab: 'journal' })).toBe('Journal');
    // a chat opened from the tab that was What I learned (an older build, a stored chat) reads as Journal
    expect(screenLabel({ tab: 'learned' })).toBe('Journal');
  });
});
