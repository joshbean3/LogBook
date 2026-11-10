import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ios-04: signing out did not stop the phone's Health engine, so it went on reading Apple Health and uploading to the
 * account that had left. healthSyncNow now does nothing while signed out, and disconnects the phone when the signed-in
 * account's server says it is not connected. Run against the development stand-in (lib/health.ts, healthMock).
 */
let serverStatus: { connected: boolean } | Error = { connected: true };
const asked: string[] = [];
vi.mock('@/api/client', () => ({
  api: async (path: string) => {
    asked.push(path);
    if (serverStatus instanceof Error) throw serverStatus;
    return serverStatus;
  },
}));

type Qc = { getQueryData: (k: unknown) => unknown; setQueryData: (k: unknown, v: unknown) => void; invalidateQueries: () => Promise<void> };
const client = (userId: string | null) => {
  const set = vi.fn();
  const qc: Qc = { getQueryData: (k) => (JSON.stringify(k) === '["bootstrap"]' && userId ? { user: { id: userId } } : undefined), setQueryData: set, invalidateQueries: async () => undefined };
  return { qc: qc as never, set };
};

const fresh = async () => {
  vi.resetModules();
  const { healthMock } = await import('./health');
  const sync = vi.spyOn(healthMock, 'sync').mockResolvedValue({ uploaded: 1, pending: 0, deadLetter: 0, importing: false });
  const disconnect = vi.spyOn(healthMock, 'disconnect');
  const { healthSyncNow } = await import('./healthSync');
  await healthMock.connect({ token: 't', apiOrigin: '', historyDays: 30 });
  return { healthMock, healthSyncNow, sync, disconnect };
};

beforeEach(() => {
  serverStatus = { connected: true };
  asked.length = 0;
});

describe('Apple Health sync follows the signed-in account (ios-04)', () => {
  it('returns early while signed out: the phone is not asked and nothing is read', async () => {
    const { healthSyncNow, sync, healthMock } = await fresh();
    const status = vi.spyOn(healthMock, 'status');
    expect(await healthSyncNow(client(null).qc, 'open')).toBeNull();
    expect(await healthSyncNow(client(null).qc, 'manual', true)).toBeNull();
    expect(status).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(asked).toEqual([]);
  });

  it('signed in and connected on both sides: it syncs', async () => {
    const { healthSyncNow, sync, disconnect } = await fresh();
    const { qc, set } = client('u1');
    expect(await healthSyncNow(qc, 'open')).toMatchObject({ uploaded: 1 });
    expect(asked).toEqual(['/apple-health/status']);
    expect(set).toHaveBeenCalledWith(['apple-health', 'status'], { connected: true });
    expect(sync).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('the server says this account is not connected: the phone is disconnected and nothing is read', async () => {
    const { healthSyncNow, sync, disconnect, healthMock } = await fresh();
    serverStatus = { connected: false };
    expect(await healthSyncNow(client('u2').qc, 'open')).toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(sync).not.toHaveBeenCalled();
    expect((await healthMock.status()).connected).toBe(false);
  });

  it('no answer from the server is not a no: the phone stays connected and the run goes on', async () => {
    const { healthSyncNow, sync, disconnect } = await fresh();
    serverStatus = new Error('offline');
    expect(await healthSyncNow(client('u1').qc, 'open')).toMatchObject({ uploaded: 1 });
    expect(disconnect).not.toHaveBeenCalled();
    expect(sync).toHaveBeenCalledOnce();
  });

  it('a run the person started (right after connecting, or Sync now) does not wait on the server status', async () => {
    const { healthSyncNow, sync, disconnect } = await fresh();
    // the cached status may still say "not connected" for a moment after Connect: that must never undo the connection
    serverStatus = { connected: false };
    expect(await healthSyncNow(client('u1').qc, 'import', true)).toMatchObject({ uploaded: 1 });
    expect(asked).toEqual([]);
    expect(disconnect).not.toHaveBeenCalled();
    expect(sync).toHaveBeenCalledOnce();
  });
});
