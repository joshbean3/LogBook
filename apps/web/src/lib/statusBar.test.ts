import { describe, expect, it, vi } from 'vitest';

const { setStyle } = vi.hoisted(() => ({ setStyle: vi.fn(async (_o: { style: string }) => undefined) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' }, registerPlugin: () => ({}) }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: { setStyle }, Style: { Dark: 'DARK', Light: 'LIGHT' } }));

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('status bar over a sheet (shell-10)', () => {
  it('light glyphs while a sheet is up, dark again when it has gone', async () => {
    const { statusBarOverSheet } = await import('./native');
    statusBarOverSheet(true);
    await settle();
    statusBarOverSheet(false);
    await settle();
    expect(setStyle.mock.calls.map((c) => c[0].style)).toEqual(['DARK', 'LIGHT']);
  });
});
