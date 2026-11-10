import { describe, expect, it, vi } from 'vitest';

/**
 * The engine's newer answers (ios-14, ios-16): every sync names the API origin, `corrupt` asks for a new connection, and a
 * `cancelled` run has nothing to say. Run against the development stand-in (lib/health.ts, healthMock).
 */
vi.mock('@/api/client', () => ({ api: async () => ({ connected: true }) }));
vi.mock('./native', () => ({ isNative: false, apiOrigin: 'https://api.example.com' }));

const qc = { getQueryData: (k: unknown) => (JSON.stringify(k) === '["bootstrap"]' ? { user: { id: 'u1' } } : undefined), setQueryData: () => undefined, invalidateQueries: async () => undefined } as never;

describe('syncErrorWords', () => {
  it('asks for a new connection when the phone state is corrupt', async () => {
    const { syncErrorWords } = await import('./healthSync');
    expect(syncErrorWords('corrupt')).toBe('Apple Health needs to be connected again on this phone.');
  });
  it('says nothing for a cancelled run, or for no error', async () => {
    const { syncErrorWords } = await import('./healthSync');
    expect(syncErrorWords('cancelled')).toBeNull();
    expect(syncErrorWords(undefined)).toBeNull();
  });
  it('keeps the plain words for the other codes', async () => {
    const { syncErrorWords } = await import('./healthSync');
    expect(syncErrorWords('locked')).toBe('Unlock your iPhone to read Apple Health.');
    expect(syncErrorWords('unauthorized')).toBe('This phone is no longer connected. Connect again.');
  });
});

describe('healthSyncNow', () => {
  it('passes the API origin to the engine on every run', async () => {
    vi.resetModules();
    const { healthMock } = await import('./health');
    const sync = vi.spyOn(healthMock, 'sync').mockResolvedValue({ uploaded: 0, pending: 0, deadLetter: 0, importing: false });
    await healthMock.connect({ token: 't', apiOrigin: '', historyDays: 30 });
    const { healthSyncNow } = await import('./healthSync');
    await healthSyncNow(qc, 'manual', true);
    expect(sync).toHaveBeenCalledWith({ reason: 'manual', apiOrigin: 'https://api.example.com' });
  });
});
