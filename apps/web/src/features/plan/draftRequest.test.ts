import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftError, DRAFT_TIMEOUT_MS, settleOrStop } from './draftRequest';

describe('waiting for a plan draft', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits as long as the server does, well past the 20 s the phone gives other requests', () => {
    expect(DRAFT_TIMEOUT_MS).toBe(150_000);
  });

  it('hands back the draft when it arrives in time', async () => {
    const work = new Promise<string>((ok) => setTimeout(() => ok('draft'), 60_000));
    const p = settleOrStop(work, new AbortController().signal, DRAFT_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(p).resolves.toBe('draft');
  });

  it('Stop ends the wait at once and a late answer is dropped', async () => {
    const ac = new AbortController();
    const work = new Promise<string>((ok) => setTimeout(() => ok('late draft'), 40_000));
    const seen: string[] = [];
    const p = settleOrStop(work, ac.signal, DRAFT_TIMEOUT_MS).then(
      (v) => seen.push(v),
      (e: { code?: string }) => seen.push(`rejected:${e.code}`),
    );
    await vi.advanceTimersByTimeAsync(5_000);
    ac.abort();
    await p;
    expect(seen).toEqual(['rejected:cancelled']);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen).toEqual(['rejected:cancelled']);
  });

  it('gives up after the timeout with words, not a hang', async () => {
    const p = settleOrStop(new Promise<string>(() => {}), new AbortController().signal, DRAFT_TIMEOUT_MS);
    const out = p.catch((e: { code?: string; message: string }) => `${e.code}: ${e.message}`);
    await vi.advanceTimersByTimeAsync(DRAFT_TIMEOUT_MS);
    await expect(out).resolves.toBe('timeout: That took too long. Try again, or ask for a shorter plan.');
  });

  it('is stopped before it starts when Stop was already tapped', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(settleOrStop(Promise.resolve('x'), ac.signal, 1000)).rejects.toMatchObject({ code: 'cancelled' });
  });
});

describe('a draft that did not come back', () => {
  it('keeps the server’s code so the builder can ask for permission', () => {
    expect(draftError(403, { code: 'consent_required' })).toMatchObject({ status: 403, code: 'consent_required' });
  });
  it('says the assistant is busy, or over its limit, in plain words', () => {
    expect(draftError(503, { code: 'claude_busy' }).message).toBe('The assistant is busy. Try again in a minute.');
    expect(draftError(429, { code: 'rate_limited' }).message).toBe('You’ve reached the limit for now. Try again later.');
    expect(draftError(500, {}).message).toBe('Something interrupted the request. Try again.');
  });
  it('prefers the server’s sentence', () => {
    expect(draftError(422, { error: 'Paste the plan text first.', code: 'no_text' }).message).toBe('Paste the plan text first.');
  });
});
