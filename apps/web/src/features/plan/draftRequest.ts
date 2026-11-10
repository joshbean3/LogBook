import { CapacitorHttp } from '@capacitor/core';
import { today, type PlanDraft } from '@logbook/shared';
import { ApiError, LOCAL_DATE_HEADER, onUnauthorized } from '@/api/client';
import { apiOrigin, isNative } from '@/lib/native';

/*
 * One request to `POST /api/plans/draft`. The server answers only when the plan is written, which takes 20 to 60 seconds
 * and can pass two minutes for a long plan, so this request waits longer than any other in the app:
 *  - in the iPhone app the JSON modes go through the native HTTP plugin with both of its timeouts at 150 s. iOS reads
 *    `connectTimeout` as the whole idle timeout, so the shared 20 s value would give up while the plan is being written;
 *  - Stop settles the wait at once, on the phone too (the native plugin has no cancel): whatever answer arrives after a
 *    Stop or a timeout is dropped and never shown.
 */

/** As long as the server itself waits for the plan. */
export const DRAFT_TIMEOUT_MS = 150_000;

export type DraftMode = 'file' | 'text' | 'describe' | 'revise';
export interface DraftInput {
  mode: DraftMode;
  file: File | null;
  text: string;
  instructions: string;
  start: string;
  end: string;
}

const stopped = () => new ApiError('Stopped.', 499, 'cancelled');
const tooLong = () => new ApiError('That took too long. Try again, or ask for a shorter plan.', 0, 'timeout');

/**
 * Waits for `work` until it settles, `signal` aborts (Stop) or `ms` pass, whichever is first. After a Stop or a timeout the
 * promise has already rejected, so a late answer from `work` goes nowhere.
 */
export const settleOrStop = <T>(work: Promise<T>, signal: AbortSignal, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(stopped());
    const timer = setTimeout(() => done(() => reject(tooLong())), ms);
    const onAbort = () => done(() => reject(stopped()));
    let settled = false;
    const done = (f: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      f();
    };
    signal.addEventListener('abort', onAbort);
    work.then(
      (v) => done(() => resolve(v)),
      (e: unknown) => done(() => reject(e)),
    );
  });

/** What the screen says for an answer that is not a draft. The server's own sentence wins when it sent one. */
export const draftError = (status: number, body: { error?: string; code?: string | null }): ApiError => {
  const code = body.code ?? null;
  const fallback =
    code === 'consent_required'
      ? 'Allow the assistant first.'
      : code === 'claude_busy' || status === 503
        ? 'The assistant is busy. Try again in a minute.'
        : code === 'rate_limited' || status === 429
          ? 'You’ve reached the limit for now. Try again later.'
          : 'Something interrupted the request. Try again.';
  return new ApiError(body.error ?? fallback, status, code);
};

const send = async (input: DraftInput, signal: AbortSignal): Promise<Response> => {
  const url = `${apiOrigin}/api/plans/draft`;
  if (input.mode === 'file') {
    if (!input.file) throw new ApiError('Choose a PDF or a photo of your plan first.', 422, 'no_file');
    const fd = new FormData();
    fd.set('mode', 'file');
    fd.set('start', input.start);
    if (input.instructions) fd.set('instructions', input.instructions);
    fd.set('file', input.file);
    return fetch(url, { method: 'POST', body: fd, headers: { [LOCAL_DATE_HEADER]: today() }, credentials: isNative ? 'include' : 'same-origin', signal });
  }
  const body = JSON.stringify({ mode: input.mode, text: input.mode === 'text' ? input.text : undefined, instructions: input.instructions || undefined, start: input.start, end: input.end || undefined });
  const headers = { 'content-type': 'application/json', [LOCAL_DATE_HEADER]: today() };
  if (!isNative) return fetch(url, { method: 'POST', headers, body, credentials: 'same-origin', signal });
  // the iPhone app: the native HTTP plugin (its cookie jar holds the sign-in), with the long timeout on both settings
  const r = await CapacitorHttp.request({ url, method: 'POST', headers, data: body, responseType: 'text', connectTimeout: DRAFT_TIMEOUT_MS, readTimeout: DRAFT_TIMEOUT_MS });
  const text = typeof r.data === 'string' ? r.data : r.data == null ? '' : JSON.stringify(r.data);
  return new Response(r.status === 204 ? null : text, { status: r.status });
};

/** Ask for a draft. Rejects with an `ApiError`: code `cancelled` after a Stop, `timeout`, or the server's own code. */
export const requestDraft = async (input: DraftInput, signal: AbortSignal): Promise<PlanDraft> => {
  // the browser's own request is cancelled with the wait; the native one cannot be, so its late answer is dropped
  const own = new AbortController();
  const stop = () => own.abort();
  signal.addEventListener('abort', stop);
  let res: Response;
  try {
    res = await settleOrStop(send(input, own.signal), signal, DRAFT_TIMEOUT_MS);
  } catch (e) {
    own.abort();
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw stopped();
    throw new ApiError('Couldn’t connect. Check your connection.', 0);
  } finally {
    signal.removeEventListener('abort', stop);
  }
  if (res.status === 401) {
    for (const fn of onUnauthorized) fn();
    throw new ApiError('Sign in to continue', 401, 'unauthenticated');
  }
  if (!res.ok) throw draftError(res.status, (await res.json().catch(() => ({}))) as { error?: string; code?: string | null });
  return (await res.json()) as PlanDraft;
};
