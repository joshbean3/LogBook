import { describe, expect, it } from 'vitest';
import { kindOf } from './strava.js';

describe('kindOf', () => {
  it('maps Strava sport types onto the three kinds the plan knows', () => {
    expect(kindOf('Run')).toBe('run');
    expect(kindOf('TrailRun')).toBe('run');
    expect(kindOf('WeightTraining')).toBe('lift');
    expect(kindOf('Crossfit')).toBe('lift');
    expect(kindOf('HighIntensityIntervalTraining')).toBe('lift');
    expect(kindOf('Ride')).toBe('cross');
    expect(kindOf('Swim')).toBe('cross');
    expect(kindOf('Yoga')).toBe('cross');
  });
});

describe('syncActivities', () => {
  it('joins a sync already running for the athlete instead of skipping it, and answers with that sync’s changes', async () => {
    const { openDatabase } = await import('../db/index.js');
    const { env } = await import('../env.js');
    const { stravaAccounts, users } = await import('../db/schema.js');
    const { syncActivities, isSyncing } = await import('./strava.js');
    const { db } = openDatabase(':memory:');
    const now = new Date().toISOString();
    db.insert(users).values({ id: 'u1', email: 'a@b.c', passwordHash: 'x', createdAt: now }).run();
    db.insert(stravaAccounts).values({ userId: 'u1', athleteId: '1', athleteName: 'A', accessToken: 't', refreshToken: 'r', expiresAt: Math.floor(Date.now() / 1000) + 3600, connectedAt: now }).run();
    const was = env.stravaConfigured;
    env.stravaConfigured = true;
    const realFetch = globalThis.fetch;
    let lists = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/athlete/activities')) {
        lists++;
        await gate;
        return new Response(JSON.stringify([{ id: 7, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-10-23T06:30:00Z', distance: 5000, moving_time: 1500, elapsed_time: 1500, total_elevation_gain: 10 }]), { status: 200 });
      }
      if (/\/activities\/7/.test(u)) return new Response(JSON.stringify({ laps: [] }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const first = syncActivities(db, 'u1');
      await new Promise((r) => setTimeout(r, 10));
      expect(isSyncing('u1')).toBe(true);
      const second = syncActivities(db, 'u1');
      release();
      const [a, b] = await Promise.all([first, second]);
      expect(lists).toBe(1);
      expect(a.changed).toBe(2);
      expect(a.joined).toBeUndefined();
      expect(b).toEqual({ changed: 2, joined: true });
      expect(isSyncing('u1')).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
      env.stravaConfigured = was;
    }
  });
});
