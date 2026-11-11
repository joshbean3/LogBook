import { describe, expect, it, vi } from 'vitest';

// the API client's native half reads `window` when it loads
vi.mock('@/lib/native', () => ({ apiOrigin: '', isNative: false }));
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: vi.fn() } }));
const { ApiError, NetworkError } = await import('@/api/client');
const { routeMissing, walkBackStart } = await import('./historyStart');

type Bundle = { activities: Array<{ kind: string; date: string }>; sessions: Array<{ kind: string; date: string }> };
/** A server's month bundles from a list of dated runs and planned runs; counts what was asked for. */
const server = (runs: string[], planned: string[] = [], lifts: string[] = []) => {
  const asked: string[] = [];
  const month = async (m: string): Promise<Bundle> => {
    asked.push(m);
    return {
      activities: [...runs.filter((d) => d.startsWith(m)).map((date) => ({ kind: 'run', date })), ...lifts.filter((d) => d.startsWith(m)).map((date) => ({ kind: 'lift', date }))],
      sessions: planned.filter((d) => d.startsWith(m)).map((date) => ({ kind: 'run', date })),
    };
  };
  return { month: month as unknown as Parameters<typeof walkBackStart>[0], asked };
};
const T = '2026-11-11';

describe('where history starts, without the route', () => {
  it('finds the first run by walking the months back', async () => {
    const s = server(['2025-09-08', '2025-09-12', '2026-03-01', '2026-11-09']);
    expect(await walkBackStart(s.month, T)).toBe('2025-09-08');
    // it read back to a full year with no run, six months at a time, and no further
    expect(s.asked[0]).toBe('2026-11');
    expect(s.asked).toContain('2025-09');
    expect(s.asked).toContain('2024-09');
    expect(s.asked.length).toBeLessThanOrEqual(30);
    expect(new Set(s.asked).size).toBe(s.asked.length);
  });

  it('counts a run on the plan, and never a lift', async () => {
    expect(await walkBackStart(server([], ['2026-10-05']).month, T)).toBe('2026-10-05');
    expect(await walkBackStart(server([], [], ['2026-06-01']).month, T)).toBeNull();
    expect(await walkBackStart(server(['2026-08-20'], ['2026-07-30']).month, T)).toBe('2026-07-30');
  });

  it('crosses a quiet stretch shorter than a year, and stops at one that is longer', async () => {
    // eleven months off, then back: the earlier runs still count
    expect(await walkBackStart(server(['2025-01-15', '2026-01-10']).month, T)).toBe('2025-01-15');
    // more than a year off: history starts after the break
    expect(await walkBackStart(server(['2024-06-15', '2026-01-10']).month, T)).toBe('2026-01-10');
  });

  it('answers null with no run at all, after one quiet year', async () => {
    const s = server([]);
    expect(await walkBackStart(s.month, T)).toBeNull();
    expect(s.asked).toHaveLength(12);
  });

  it('never reads more months than its limit', async () => {
    // a run every month for 20 years
    const runs = Array.from({ length: 240 }, (_, i) => `${2026 - Math.floor((i + 1) / 12)}-${String(((10 - i) % 12 + 12) % 12 + 1).padStart(2, '0')}-05`);
    const s = server(runs);
    await walkBackStart(s.month, T, 12, 24);
    expect(s.asked).toHaveLength(24);
  });

  it('passes a failed month on (the chart shows Try again, not a wrong start)', async () => {
    const month = (async () => {
      throw new NetworkError();
    }) as unknown as Parameters<typeof walkBackStart>[0];
    await expect(walkBackStart(month, T)).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('a route the server does not have', () => {
  it('is a 404, 405 or 501, and nothing else', () => {
    for (const st of [404, 405, 501]) expect(routeMissing(new ApiError('Not found', st))).toBe(true);
    for (const st of [400, 401, 403, 429, 500, 502, 503]) expect(routeMissing(new ApiError('No', st))).toBe(false);
    expect(routeMissing(new NetworkError())).toBe(false);
    expect(routeMissing(null)).toBe(false);
    expect(routeMissing(undefined)).toBe(false);
  });
});
