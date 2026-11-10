import { describe, expect, it } from 'vitest';
import { reminderRow } from './reminderModel';

describe('the Morning goal reminder row', () => {
  it('follows the app switch while iOS allows notifications', () => {
    expect(reminderRow('granted', true)).toEqual({ on: true, sub: 'Each morning with no goal set, and Mondays for the week.', showSettingsLink: false });
    expect(reminderRow('granted', false).on).toBe(false);
    expect(reminderRow('prompt', false).showSettingsLink).toBe(false);
  });
  it('reads off and points to iOS Settings once iOS said no', () => {
    expect(reminderRow('denied', true)).toEqual({ on: false, sub: 'Turned off in iOS Settings.', showSettingsLink: true });
  });
});

describe('Rate Logbook', () => {
  it('opens the write-review page for a real id and hides without one', async () => {
    const { rateUrl } = await import('./reminderModel');
    expect(rateUrl('6740012345')).toBe('https://apps.apple.com/app/id6740012345?action=write-review');
    expect(rateUrl('id6740012345')).toBe('https://apps.apple.com/app/id6740012345?action=write-review');
    expect(rateUrl(undefined)).toBeNull();
    expect(rateUrl('')).toBeNull();
    expect(rateUrl('todo')).toBeNull();
  });
});
