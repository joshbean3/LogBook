import { describe, expect, it } from 'vitest';
import { hm, summarizeNight, type SleepSegment } from './health';

const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 9, h, m)).toISOString();
const s = (from: [number, number], to: [number, number], stage: SleepSegment['stage'], source = 'Watch', device = 'Watch7,1'): SleepSegment => ({ start: t(...from), end: t(...to), stage, source, bundle: 'com.apple.health', device });

describe('last night from raw segments', () => {
  it('adds the stages, leaves awake and in-bed out of sleep, and spans first to last', () => {
    const n = summarizeNight([s([4, 0], [6, 0], 'core'), s([6, 0], [6, 30], 'deep'), s([6, 30], [6, 40], 'awake'), s([6, 40], [8, 0], 'rem'), s([3, 50], [8, 10], 'in_bed', 'Watch')])!;
    expect(n.asleepSec).toBe((120 + 30 + 80) * 60);
    expect(n.stages).toMatchObject({ core: 7200, deep: 1800, rem: 4800, awake: 600 });
    expect(n.start).toBe(t(3, 50));
    expect(n.end).toBe(t(8, 10));
    expect(n.staged).toBe(true);
    expect(hm(n.asleepSec)).toBe('3h 50m');
  });
  it('uses one source: the Apple Watch over another app, never both added', () => {
    const n = summarizeNight([s([4, 0], [8, 0], 'asleep', 'AutoSleep', ''), s([4, 30], [7, 30], 'core')])!;
    expect(n.source).toBe('Watch');
    expect(n.asleepSec).toBe(3 * 3600);
  });
  it('says when a night has no stage detail, and is empty with no segments', () => {
    expect(summarizeNight([s([4, 0], [8, 0], 'asleep', 'iPhone', 'iPhone17,2')])!.staged).toBe(false);
    expect(summarizeNight([])).toBeNull();
  });
});
