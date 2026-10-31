import { describe, expect, it } from 'vitest';
import { startersFor } from './AssistantSheet';

describe('startersFor', () => {
  it('offers starters for the tab the owner asked from', () => {
    expect(startersFor({ tab: 'today', date: '2026-10-31' }, '2026-10-31', '2026-10-31')).toEqual(['What’s left today?', 'Plan my morning', 'Move today’s run to the next day']);
    expect(startersFor({ tab: 'plan', date: '2026-10-26' }, '2026-10-26', '2026-10-31')).toEqual(['Pick a plan', 'Push my missed runs to next week', 'How is my week looking?']);
    expect(startersFor({ tab: 'goals' }, '2026-10-31', '2026-10-31')[0]).toBe('Set this week’s goal from my plan');
    expect(startersFor({ tab: 'journal', date: '2026-10-31' }, '2026-10-31', '2026-10-31')[0]).toBe('What happened this month?');
    expect(startersFor(undefined, '2026-10-31', '2026-10-31')[0]).toBe('What’s left today?');
  });
});
