import type { Consent, GoalRefinement } from '@logbook/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false }, CapacitorHttp: {} }));
const { ApiError, NetworkError } = await import('@/api/client');
const { AS_TYPED_WORDS, reviewAccess, reviewGoal, SLOW_WORDS } = await import('./refine');

const input = { level: 'day' as const, period: '2026-11-10', text: 'Run more' };
const consent = (c: Partial<Consent>): Consent => ({ training: false, health: null, recall: false, reads: false, at: null, version: null, ...c });
const answer: GoalRefinement = { text: 'Run 5 miles before work.', why: 'It names the distance.', changed: true, steps: ['Lay out kit'], available: true };
const online = () => false;

describe('who may have a goal reviewed', () => {
  it('is on only with a recorded yes to assistant access', () => {
    expect(reviewAccess(consent({ training: true, at: '2026-11-10T08:00:00Z' }), true)).toBe('on');
    expect(reviewAccess(consent({ training: false, at: '2026-11-10T08:00:00Z' }), true)).toBe('off');
    // never asked: nothing was agreed to, whatever the stored default says
    expect(reviewAccess(consent({ training: true, at: null }), true)).toBe('off');
  });
  it('is unknown until the choice has loaded, and none on a server with no assistant', () => {
    expect(reviewAccess(undefined, true)).toBe('unknown');
    expect(reviewAccess(consent({ training: true, at: 'x' }), false)).toBe('none');
  });
});

describe('the goal review', () => {
  it('sends nothing with assistant access off, and says how to turn it on', async () => {
    const send = vi.fn();
    const r = await reviewGoal(input, 'off', { send, offline: online });
    expect(send).not.toHaveBeenCalled();
    expect(r).toEqual({ kind: 'asTyped', why: 'consent' });
    expect(AS_TYPED_WORDS.consent).toBe('Saved as written. Turn on Training data in Settings, Privacy, to have goals reviewed.');
  });
  it('sends nothing while the choice is unknown or the server has no assistant', async () => {
    const send = vi.fn();
    expect(await reviewGoal(input, 'unknown', { send, offline: online })).toEqual({ kind: 'asTyped', why: 'unavailable' });
    expect(await reviewGoal(input, 'none', { send, offline: online })).toEqual({ kind: 'asTyped', why: 'unavailable' });
    expect(send).not.toHaveBeenCalled();
    expect(AS_TYPED_WORDS.unavailable).toBe('Saved as written. The review was not available.');
  });
  it('sends nothing offline', async () => {
    const send = vi.fn();
    expect(await reviewGoal(input, 'on', { send, offline: () => true })).toEqual({ kind: 'asTyped', why: 'offline' });
    expect(send).not.toHaveBeenCalled();
  });
  it('returns the review when Claude answers', async () => {
    const send = vi.fn(async () => answer);
    expect(await reviewGoal(input, 'on', { send, offline: online })).toEqual({ kind: 'reviewed', text: answer.text, why: answer.why, changed: true, steps: ['Lay out kit'] });
    expect(send).toHaveBeenCalledWith(input, expect.any(AbortSignal));
  });
  it('saves as typed when the server says the review is not available', async () => {
    const send = async () => ({ ...answer, text: input.text, changed: false, available: false });
    expect(await reviewGoal(input, 'on', { send, offline: online })).toEqual({ kind: 'asTyped', why: 'unavailable' });
  });
  it('saves as typed on a refusal, a limit, an outage, a missing permission and a dropped connection', async () => {
    const failing = (e: unknown) => reviewGoal(input, 'on', { send: () => Promise.reject(e), offline: online });
    expect(await failing(new ApiError('No', 422, 'refused'))).toEqual({ kind: 'asTyped', why: 'declined' });
    expect(await failing(new ApiError('Slow down', 429, 'rate_limited'))).toEqual({ kind: 'asTyped', why: 'limit' });
    expect(await failing(new ApiError('Busy', 503, 'claude_busy'))).toEqual({ kind: 'asTyped', why: 'unavailable' });
    expect(await failing(new ApiError('Bad', 400, 'bad_period'))).toEqual({ kind: 'asTyped', why: 'unavailable' });
    expect(await failing(new ApiError('Choose first', 403, 'consent_required'))).toEqual({ kind: 'asTyped', why: 'consent' });
    expect(await failing(new NetworkError())).toEqual({ kind: 'asTyped', why: 'offline' });
  });
  it('stays in the field when the session has ended', async () => {
    const r = await reviewGoal(input, 'on', { send: () => Promise.reject(new ApiError('Sign in to continue', 401, 'unauthenticated')), offline: online });
    expect(r).toEqual({ kind: 'failed', message: 'Sign in to continue' });
  });
  it('gives up after the timeout and drops the request', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const send = (_i: unknown, signal: AbortSignal) => {
      seen = signal;
      return new Promise<GoalRefinement>(() => undefined);
    };
    const p = reviewGoal(input, 'on', { send, offline: online, timeoutMs: 15_000 });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ kind: 'slow' });
    expect(seen?.aborted).toBe(true);
    expect(SLOW_WORDS).toBe('The review took too long. Save as written?');
    vi.useRealTimers();
  });
  it('drops the request when the editor is left', async () => {
    const left = new AbortController();
    let seen: AbortSignal | undefined;
    const send = (_i: unknown, signal: AbortSignal) => {
      seen = signal;
      return new Promise<GoalRefinement>((_, reject) => signal.addEventListener('abort', () => reject(new NetworkError())));
    };
    const r = reviewGoal(input, 'on', { send, offline: online, signal: left.signal });
    expect(seen?.aborted).toBe(false);
    left.abort();
    expect(seen?.aborted).toBe(true);
    // the editor is gone and ignores this; it still settles
    expect((await r).kind).toBe('asTyped');
  });
});
