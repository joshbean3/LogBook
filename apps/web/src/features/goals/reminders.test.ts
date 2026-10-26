import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
const { plannedReminders } = await import('./reminders');

const g = (level: 'day' | 'week', period: string) => ({ id: period, level, period, text: 'x', original: null, why: null, status: 'open' as const, reflection: null, createdAt: '', updatedAt: '', closedAt: null });

describe('goal reminders', () => {
  it('reminds each morning a day has no goal, and on Monday for the week', () => {
    const now = new Date(2026, 9, 25, 9, 0); // Sunday 9:00, after this morning's reminder time
    const due = plannedReminders([g('day', '2026-10-27')], '2026-10-25', now, 7 * 60 + 15);
    expect(due.map((d) => [d.at.getDate(), d.title])).toEqual([
      [26, 'Set today’s and this week’s goals'],
      [28, 'Set today’s goal'],
      [29, 'Set today’s goal'],
      [30, 'Set today’s goal'],
      [31, 'Set today’s goal'],
    ]);
    expect(due[0]!.at.getHours() * 60 + due[0]!.at.getMinutes()).toBe(7 * 60 + 30);
  });
  it('a week set early drops its Monday reminder to the day alone', () => {
    const due = plannedReminders([g('week', '2026-10-26')], '2026-10-26', new Date(2026, 9, 26, 6, 0), 7 * 60);
    expect(due[0]!.title).toBe('Set today’s goal');
  });
});
