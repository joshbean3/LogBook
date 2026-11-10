import { describe, expect, it, vi } from 'vitest';

/**
 * A Capacitor plugin on iOS is a proxy that answers every property: `then` too, as a method that rejects. Resolving a
 * promise with it calls that `then` (settings-34). This stand-in does the same, so a function that ever hands the plugin
 * to a promise fails here.
 */
const calls: string[] = [];
const pluginProxy = new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => {
    if (typeof prop !== 'string') return undefined;
    return (...args: unknown[]) => {
      if (prop === 'then') {
        const reject = args[1] as ((e: Error) => void) | undefined;
        reject?.(new Error('LocalNotifications.then() is not implemented on ios'));
        return undefined;
      }
      calls.push(prop);
      if (prop === 'requestPermissions' || prop === 'checkPermissions') return Promise.resolve({ display: 'granted' });
      if (prop === 'addListener') return Promise.resolve({ remove: async () => undefined });
      return Promise.resolve(undefined);
    };
  },
});

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: pluginProxy }));

describe('goal reminders with the iOS plugin proxy', () => {
  it('turns on, schedules, checks and turns off without awaiting the plugin itself', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const r = await import('./reminders');
    const today = new Date().toISOString().slice(0, 10);
    await expect(r.enableReminders({ goals: [], today, wake: 23 * 60 + 40 })).resolves.toBe(true);
    await expect(r.scheduleReminders([], today, 7 * 60)).resolves.toBeUndefined();
    await expect(r.reminderPermission()).resolves.toBe('granted');
    await expect(r.disableReminders()).resolves.toBeUndefined();
    const off = r.onReminderTap(() => undefined);
    await new Promise((ok) => setTimeout(ok, 0));
    off();
    expect(calls).toContain('requestPermissions');
    expect(calls).toContain('cancel');
    expect(calls).toContain('addListener');
    vi.unstubAllGlobals();
  });
});
