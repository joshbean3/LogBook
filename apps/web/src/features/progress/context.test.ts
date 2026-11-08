import type { PlanBlock } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { blockWords, stravaChip, tileStatus, trendTone } from './context';

const block = (name: string, start: string, end: string): PlanBlock => ({ id: name, name, start, end, source: null, summary: null, createdAt: '2026-01-01T00:00:00Z' });

describe('progress context row', () => {
  it('names the block and the week, or when the next one starts', () => {
    const blocks = [block('Half marathon', '2026-11-02', '2027-01-24')];
    expect(blockWords(blocks, '2026-11-08')).toEqual({ title: 'Half marathon', sub: 'Week 1 of 12' });
    expect(blockWords(blocks, '2026-11-16')).toEqual({ title: 'Half marathon', sub: 'Week 3 of 12' });
    // a block that starts tomorrow says the weekday; one further out says the date
    expect(blockWords([block('Base', '2026-11-09', '2026-12-20')], '2026-11-08')?.sub).toBe('Starts Monday');
    expect(blockWords([block('Base', '2026-11-30', '2026-12-20')], '2026-11-08')?.sub).toBe('Starts Nov 30');
    // a block that has ended is not the day's block
    expect(blockWords([block('Old', '2026-08-01', '2026-10-01')], '2026-11-08')).toBeNull();
  });

  it('says where runs come from and when Strava last answered', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    const s = { connected: true, lastSyncAt: '2026-11-08T11:54:00Z', syncing: false, error: null };
    expect(stravaChip(true, s, now)).toEqual({ title: 'Strava', sub: 'Synced 6 m ago', tone: 'ok', tap: null });
    expect(stravaChip(true, { ...s, syncing: true }, now).sub).toBe('Syncing…');
    expect(stravaChip(true, { ...s, error: 'expired' }, now)).toMatchObject({ sub: 'Sync paused', tone: 'warn', tap: 'settings' });
    expect(stravaChip(true, null, now)).toMatchObject({ sub: 'Not connected', tap: 'connect' });
    expect(stravaChip(false, null, now)).toMatchObject({ title: 'Runs', tap: null });
  });

  it('reads a status as a check, an arrow or not yet', () => {
    const base = { value: 20, hasData: true, variant: {} };
    expect(trendTone({ ...base, standing: 'within' })).toBe('ok');
    expect(trendTone({ ...base, standing: 'above' })).toBe('up');
    expect(trendTone({ ...base, standing: 'below' })).toBe('down');
    // pace: faster (below) points up, the way the chart draws it
    expect(trendTone({ ...base, standing: 'below', variant: { invert: true } })).toBe('up');
    expect(trendTone({ ...base, standing: null })).toBe('none');
    expect(trendTone({ ...base, value: null, standing: 'within' })).toBe('none');
    expect(tileStatus('Building your normal: 9 of 14 days')).toBe('Learning, 9 of 14 days');
    expect(tileStatus('Above your usual')).toBe('Above your usual');
  });
});
