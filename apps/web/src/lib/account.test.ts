import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * shell-26 (Contract 2): signing out or deleting the account left the last person's chats and unsent changes on the phone,
 * and the next account saw and inherited them. One wipe now runs on Sign out, on Delete account and when a different
 * account signs in. These tests drive it with stand-ins for the device: two storages, idb-keyval, the notifications plugin
 * and the Apple Health stand-in.
 */
class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key = (i: number) => [...this.m.keys()][i] ?? null;
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, String(v));
  removeItem = (k: string) => void this.m.delete(k);
  keys = () => [...this.m.keys()].sort();
}
let local = new MemStorage();
let session = new MemStorage();

const disk = new Map<string, unknown>();
let idbClear: () => Promise<void> = async () => disk.clear();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => structuredClone(disk.get(k)),
  set: async (k: string, v: unknown) => void disk.set(k, structuredClone(v)),
  clear: () => idbClear(),
}));

const cancelled: number[][] = [];
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { cancel: async ({ notifications }: { notifications: Array<{ id: number }> }) => void cancelled.push(notifications.map((n) => n.id)) },
}));
vi.mock('./native', () => ({ isNative: true, apiOrigin: '' }));
// on the phone `Health` is the Swift plugin; here it is the development stand-in, so the test can see it disconnect
vi.mock('./health', async (original) => {
  const real = await original<typeof import('./health')>();
  return { ...real, Health: real.healthMock };
});
vi.mock('@/api/client', () => ({ NetworkError: class extends Error {}, isOffline: () => true, api: async () => ({}) }));

const boot = { user: { id: 'user-a' } };
const makeQc = () => ({ clear: vi.fn(), cancelQueries: vi.fn(), getQueryData: () => boot, invalidateQueries: vi.fn(async () => undefined) });

const load = async () => {
  vi.resetModules();
  const account = await import('./account');
  const { outbox, write } = await import('@/api/outbox');
  const { healthMock } = await import('./health');
  await account.wipeFinished;
  return { ...account, outbox, write, healthMock };
};

beforeEach(() => {
  local = new MemStorage();
  session = new MemStorage();
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session, location: { replace: vi.fn() } });
  disk.clear();
  idbClear = async () => disk.clear();
  cancelled.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Account A's traces on the device, as the features leave them. */
const leaveTraces = async (m: Awaited<ReturnType<typeof load>>, qc: ReturnType<typeof makeQc>) => {
  m.outbox.attach(qc as never);
  await m.outbox.load();
  m.rememberUser('user-a');
  await m.write('/todos', 'POST', { text: 'account A private to-do' }, [['todos']]);
  local.setItem('logbook.hasAccount', '1');
  local.setItem('logbook.assistant.chats', JSON.stringify([{ id: 'c1', turns: [{ q: 'my knee hurts' }] }]));
  local.setItem('logbook.goalReminders', '1');
  local.setItem('logbook.trainWhen.default', 'morning');
  local.setItem('logbook.intro.user-a.plan', '1');
  local.setItem('someone-elses-key', 'kept');
  session.setItem('logbook.assistant.current', 'c1');
  session.setItem('logbook.onboarding.user-a', '{}');
  disk.set('logbook.cache.v1', JSON.stringify({ clientState: { queries: [{ queryKey: ['bootstrap'], state: { data: boot } }] } }));
  disk.set('logbook.journal.draft.2026-11-10', 'half a memory');
  await m.healthMock.connect({ token: 't', apiOrigin: '', historyDays: 30 });
};

describe('clearLocalAccount (Contract 2)', () => {
  it('empties the outbox, the cache, idb-keyval and every logbook. key but the has-account flag; cancels reminders; disconnects Health; then reloads', async () => {
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    expect(m.outbox.size()).toBe(1);
    expect(local.getItem('logbook.user')).toBe('user-a');
    const disconnect = vi.spyOn(m.healthMock, 'disconnect');
    const reload = vi.fn();

    await m.clearLocalAccount(qc as never, { to: '/start', reload });

    // the outbox
    expect(m.outbox.size()).toBe(0);
    // the query cache, in memory and on the device, and everything else in idb-keyval
    expect(qc.clear).toHaveBeenCalledOnce();
    expect([...disk.keys()]).toEqual([]);
    // no key starting with "logbook." remains except logbook.hasAccount; other apps' keys are not touched
    expect(local.keys()).toEqual(['logbook.hasAccount', 'someone-elses-key']);
    expect(session.keys().filter((k) => k.startsWith('logbook.'))).toEqual([]);
    // no reminder is pending: ids 7000 to 7006 were cancelled through the plugin
    expect(cancelled).toEqual([[7000, 7001, 7002, 7003, 7004, 7005, 7006]]);
    // Apple Health stopped on this phone
    expect(disconnect).toHaveBeenCalledOnce();
    expect((await m.healthMock.status()).connected).toBe(false);
    // and the page starts over where it was told to
    expect(reload).toHaveBeenCalledExactlyOnceWith('/start');
    expect(m.isLeaving()).toBe(true);
  });

  it('a second call joins the first: one wipe, one reload', async () => {
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    const reload = vi.fn();
    await Promise.all([m.clearLocalAccount(qc as never, { reload }), m.clearLocalAccount(qc as never, { reload })]);
    expect(reload).toHaveBeenCalledOnce();
    expect(cancelled).toHaveLength(1);
  });

  it('a part that fails or hangs does not stop the rest, and the page still reloads', async () => {
    vi.useFakeTimers();
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    vi.spyOn(m.healthMock, 'disconnect').mockRejectedValue(new Error('plugin missing'));
    idbClear = () => new Promise(() => undefined);
    const reload = vi.fn();
    const done = m.clearLocalAccount(qc as never, { reload });
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(local.keys()).toEqual(['logbook.hasAccount', 'someone-elses-key']);
    expect(m.outbox.size()).toBe(0);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('the next page finishes the wipe: what was written while the old page unloaded goes too', async () => {
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    await m.clearLocalAccount(qc as never, { reload: () => undefined });
    // a draft's debounce and a store saving on its way out, after the sweep and before the document is gone
    local.setItem('logbook.assistant.chats', '[{"id":"late"}]');
    disk.set('logbook.journal.draft.2026-11-10', 'late write');
    // the reload: a fresh module, the same tab's session storage
    const next = await load();
    expect(local.keys()).toEqual(['logbook.hasAccount', 'someone-elses-key']);
    expect([...disk.keys()]).toEqual([]);
    expect(next.isLeaving()).toBe(false);
    // and it does not run again on the open after that
    local.setItem('logbook.trainWhen.default', 'afternoon');
    await load();
    expect(local.getItem('logbook.trainWhen.default')).toBe('afternoon');
  });

  it('sign out, then sign up as someone else: nothing of the first account is left to see or send', async () => {
    const a = await load();
    const qcA = makeQc();
    await leaveTraces(a, qcA);
    await a.clearLocalAccount(qcA as never, { reload: () => undefined });

    const b = await load();
    const sent: string[] = [];
    const qcB = { ...makeQc(), getQueryData: () => ({ user: { id: 'user-b' } }) };
    b.outbox.attach(qcB as never);
    await b.outbox.load();
    expect(b.isOtherAccount('user-b')).toBe(false);
    b.rememberUser('user-b');
    // History is empty and there is no current chat
    expect(local.getItem('logbook.assistant.chats')).toBeNull();
    expect(session.getItem('logbook.assistant.current')).toBeNull();
    // the outbox is empty: nothing of A's can replay into B's account
    expect(b.outbox.size()).toBe(0);
    expect(b.outbox.peek().map((x) => x.path)).toEqual(sent);
    expect(local.getItem('logbook.user')).toBe('user-b');
  });
});

describe('a different account signing in is noticed', () => {
  it('compares the bootstrap user with the one the app last ran for here', async () => {
    const m = await load();
    expect(m.isOtherAccount('user-a')).toBe(false);
    m.rememberUser('user-a');
    expect(m.isOtherAccount('user-a')).toBe(false);
    expect(m.isOtherAccount('user-b')).toBe(true);
  });

  it("another person's unsent change on the device counts, even when the remembered id is gone", async () => {
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    // "Reset what this phone saved" (or a private window) removed logbook.user; the queued change still names user-a
    local.removeItem('logbook.user');
    expect(m.isOtherAccount('user-a')).toBe(false);
    expect(m.isOtherAccount('user-b')).toBe(true);
  });

  it('a session that ran out keeps the queue for the same person; another person signing in wipes it', async () => {
    const m = await load();
    const qc = makeQc();
    await leaveTraces(m, qc);
    // 401: nothing is cleared (only Sign out, Delete account and a different account do that)
    expect(m.outbox.size()).toBe(1);
    expect(m.isOtherAccount('user-a')).toBe(false);
    // user-b signs in on the same phone: App.tsx sees the mismatch and wipes
    expect(m.isOtherAccount('user-b')).toBe(true);
    const reload = vi.fn();
    await m.clearLocalAccount(qc as never, { reload });
    expect(m.outbox.size()).toBe(0);
    expect(local.getItem('logbook.assistant.chats')).toBeNull();
    expect(reload).toHaveBeenCalledWith('/');
  });
});
