import { describe, expect, it } from 'vitest';
import { keepOnDevice } from './persist';

const q = (queryKey: unknown[], data: unknown = { x: 1 }) => ({ queryKey, state: { data } }) as unknown as Parameters<typeof keepOnDevice>[0];

describe('what is kept on the device', () => {
  it('keeps data, never the sign-in probes or empty queries', () => {
    expect(keepOnDevice(q(['bootstrap']))).toBe(true);
    expect(keepOnDevice(q(['auth-session']))).toBe(false);
    expect(keepOnDevice({ queryKey: ['bootstrap'], state: { data: undefined } } as unknown as Parameters<typeof keepOnDevice>[0])).toBe(false);
  });
  it('never anything from or about Apple Health (gap-leg-50)', () => {
    expect(keepOnDevice(q(['health', 'access']))).toBe(false);
    expect(keepOnDevice(q(['health-daily', '2026-11']))).toBe(false);
    expect(keepOnDevice(q(['apple-health', 'status']))).toBe(false);
    expect(keepOnDevice(q(['apple-health-daily']))).toBe(false);
  });
  it('never a journal search, but the journal itself (perf-21)', () => {
    expect(keepOnDevice(q(['journal', '', false]))).toBe(true);
    expect(keepOnDevice(q(['journal', 'tempo', false]))).toBe(false);
  });
});
