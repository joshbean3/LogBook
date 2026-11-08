import { describe, expect, it } from 'vitest';
import { ago, versionLine } from '../settings/format';
import { introDue } from './introDue';

describe('feature intros', () => {
  it('show once, only to an enrolled account, only when the moment is right', () => {
    expect(introDue('plan', { seen: [] }, false, true)).toBe(true);
    // not enrolled (an account from before first run had intros): never
    expect(introDue('plan', { seen: null }, false, true)).toBe(false);
    // not loaded yet: wait
    expect(introDue('plan', undefined, false, true)).toBe(false);
    // seen on the account, or on this device
    expect(introDue('plan', { seen: ['plan'] }, false, true)).toBe(false);
    expect(introDue('plan', { seen: [] }, true, true)).toBe(false);
    // another tab's mark does not count
    expect(introDue('learned', { seen: ['plan'] }, false, true)).toBe(true);
    // not at the tab's root
    expect(introDue('journal', { seen: [] }, false, false)).toBe(false);
  });
});

describe('settings words', () => {
  it('says how old a sync is', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    expect(ago(null, now)).toBeNull();
    expect(ago('nonsense', now)).toBeNull();
    expect(ago('2026-11-08T11:59:50Z', now)).toBe('just now');
    expect(ago('2026-11-08T11:54:00Z', now)).toBe('6 min ago');
    expect(ago('2026-11-08T09:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-11-05T12:00:00Z', now)).toBe('3 days ago');
  });
  it('names the version, with the build when it differs', () => {
    expect(versionLine('1.0.0')).toBe('Version 1.0.0');
    expect(versionLine('1.2', '34')).toBe('Version 1.2 (34)');
    expect(versionLine('1.2', '1.2')).toBe('Version 1.2');
  });
});
