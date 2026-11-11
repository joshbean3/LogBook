import { describe, expect, it } from 'vitest';
import { screenLabel, zAssistantScreen } from './assistant.js';

describe('the plan summary screen', () => {
  it('carries the plan block it was opened for', () => {
    expect(zAssistantScreen.parse({ tab: 'plan', plan: 'blk_1' })).toEqual({ tab: 'plan', plan: 'blk_1' });
    expect(zAssistantScreen.safeParse({ tab: 'plan', plan: '' }).success).toBe(false);
  });
  it('reads as "Plan summary", ahead of the week it may also name', () => {
    expect(screenLabel({ tab: 'plan', plan: 'blk_1' })).toBe('Plan summary');
    expect(screenLabel({ tab: 'plan', plan: 'blk_1', week: '2026-11-09' })).toBe('Plan summary');
  });
  it('keeps the week and month labels without a plan', () => {
    expect(screenLabel({ tab: 'plan', week: '2026-11-09' })).toBe('Plan, week of Nov 9');
    expect(screenLabel({ tab: 'plan', month: '2026-11' })).toBe('Plan, November 2026');
  });
});
