import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/native', () => ({ apiOrigin: '', isNative: false }));
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: vi.fn() } }));

const { api, ApiError, DEFAULT_TIMEOUT_MS, formDataEntries, NetworkError, retryAfterOf, shouldRetryRead } = await import('./client');

describe('shouldRetryRead (perf-23)', () => {
  it('retries a missing answer and a gateway hiccup, at most twice', () => {
    expect(shouldRetryRead(0, new NetworkError())).toBe(true);
    expect(shouldRetryRead(1, new ApiError('x', 503))).toBe(true);
    expect(shouldRetryRead(0, new ApiError('x', 502))).toBe(true);
    expect(shouldRetryRead(0, new ApiError('x', 504))).toBe(true);
    expect(shouldRetryRead(2, new NetworkError())).toBe(false);
  });
  it('shows any other answer at once', () => {
    for (const s of [400, 401, 403, 404, 409, 422, 429, 500]) expect(shouldRetryRead(0, new ApiError('x', s))).toBe(false);
    expect(shouldRetryRead(0, new Error('parse'))).toBe(false);
  });
});

describe('retryAfterOf', () => {
  it('reads seconds and dates', () => {
    expect(retryAfterOf('30')).toBe(30);
    expect(retryAfterOf(null)).toBeNull();
    expect(retryAfterOf('soon')).toBeNull();
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(retryAfterOf('Tue, 10 Nov 2026 12:01:00 GMT', now)).toBe(60);
  });
});

describe('formDataEntries (plan-17)', () => {
  it('sends strings as they are and files as base64 with their name and type', async () => {
    const fd = new FormData();
    fd.set('mode', 'file');
    fd.set('file', new File([new Uint8Array([104, 105])], 'plan.pdf', { type: 'application/pdf' }));
    expect(await formDataEntries(fd)).toEqual([
      { key: 'mode', value: 'file', type: 'string' },
      { key: 'file', value: 'aGk=', type: 'base64File', contentType: 'application/pdf', fileName: 'plan.pdf' },
    ]);
  });
});

describe('api() timeouts and errors', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = realFetch;
  });
  const hang = () =>
    vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));

  it('gives up on an ordinary request after 20 s, as a network failure', async () => {
    globalThis.fetch = hang() as unknown as typeof fetch;
    const p = api('/slow');
    const seen = expect(p).rejects.toBeInstanceOf(NetworkError);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await seen;
    expect(DEFAULT_TIMEOUT_MS).toBe(20_000);
  });

  it('lets a call name a longer timeout', async () => {
    globalThis.fetch = hang() as unknown as typeof fetch;
    let done = false;
    const p = api('/draft', { timeoutMs: 60_000 }).catch((e: unknown) => {
      done = true;
      return e;
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toBeInstanceOf(NetworkError);
  });

  it("still honours the caller's own signal", async () => {
    globalThis.fetch = hang() as unknown as typeof fetch;
    const ac = new AbortController();
    const p = api('/pick', { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(NetworkError);
  });

  it('carries Retry-After on a refusal', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Slow down', code: 'rate_limited' }), { status: 429, headers: { 'retry-after': '12' } })) as unknown as typeof fetch;
    const e = (await api('/x').catch((x: unknown) => x)) as InstanceType<typeof ApiError>;
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.retryAfter]).toEqual([429, 'rate_limited', 12]);
  });
});
