import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/api/client';
import { requestShape, SHAPE_TIMEOUT_MS } from './assistRequest';

const body = { kind: 'shape' as const, words: '4 runs a week', settings: null };
const answer = { kind: 'shape', patch: { runsPerWeek: 4 }, dropped: [], cannot: [], note: null };
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

describe('asking the plan builder’s assistant', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('posts the kind, the words and the settings, and hands back the checked answer', async () => {
    fetchMock.mockResolvedValue(json(200, answer));
    await expect(requestShape(body, new AbortController().signal)).resolves.toEqual(answer);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/plans\/template\/assist$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it('an answer that is not the contract’s shape is an invalid answer, never applied', async () => {
    for (const bad of [{ ok: true }, { ...answer, patch: { weeks: 99 } }, { ...answer, kind: 'other' }, 'words']) {
      fetchMock.mockResolvedValue(json(200, bad));
      await expect(requestShape(body, new AbortController().signal)).rejects.toMatchObject({ status: 502, code: 'invalid_answer' });
    }
  });

  it('keeps the server’s status and code for every failure, a missing route included', async () => {
    for (const [status, code] of [[403, 'consent_required'], [404, 'not_found'], [429, 'rate_limited'], [500, 'internal'], [503, 'claude_busy'], [422, 'refused']] as Array<[number, string]>) {
      fetchMock.mockResolvedValue(json(status, { error: 'x', code }));
      await expect(requestShape(body, new AbortController().signal)).rejects.toMatchObject({ status, code });
    }
    // a gateway's bare answer: no body to read
    fetchMock.mockResolvedValue(new Response('Method Not Allowed', { status: 405 }));
    await expect(requestShape(body, new AbortController().signal)).rejects.toMatchObject({ status: 405 });
    fetchMock.mockResolvedValue(new Response('', { status: 501 }));
    await expect(requestShape(body, new AbortController().signal)).rejects.toMatchObject({ status: 501 });
  });

  it('no connection is a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(requestShape(body, new AbortController().signal)).rejects.toBeInstanceOf(NetworkError);
  });

  it('Stop ends the wait at once, and the answer that arrives later is dropped', async () => {
    let arrive!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((ok) => (arrive = ok)));
    const ac = new AbortController();
    const seen: unknown[] = [];
    const p = requestShape(body, ac.signal).then(
      (v) => seen.push(v),
      (e: ApiError) => seen.push(e.code),
    );
    ac.abort();
    await p;
    expect(seen).toEqual(['cancelled']);
    arrive(json(200, answer));
    await new Promise((r) => setTimeout(r, 5));
    expect(seen).toEqual(['cancelled']);
  });

  it('is stopped before it starts when the signal was already aborted, and sends nothing', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(requestShape(body, ac.signal)).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up after 45 seconds with a timeout, not a hang', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_ok, fail) => init.signal?.addEventListener('abort', () => fail(new DOMException('Aborted', 'AbortError')))));
    const out = requestShape(body, new AbortController().signal).catch((e: unknown) => (e instanceof NetworkError ? 'network' : (e as ApiError).code));
    await vi.advanceTimersByTimeAsync(SHAPE_TIMEOUT_MS + 2_000);
    // the request's own clock (45 s) ends it as a failed connection; the outer wait would say timeout 2 s later
    expect(['network', 'timeout']).toContain(await out);
    expect(SHAPE_TIMEOUT_MS).toBe(45_000);
  });
});
