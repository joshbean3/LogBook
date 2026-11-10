import { CapacitorHttp } from '@capacitor/core';
import { today, type PlanDraft } from '@logbook/shared';
import { ApiError, LOCAL_DATE_HEADER, onUnauthorized } from '@/api/client';
import { apiOrigin, isNative } from '@/lib/native';

/*
 * One request to `POST /api/plans/draft`. The server answers only when the plan is written, which takes 20 to 60 seconds
 * and can pass two minutes for a long plan, so this request waits longer than any other in the app:
 *  - in the iPhone app every mode goes through the native HTTP plugin with both of its timeouts at 150 s. iOS reads
 *    `connectTimeout` as the whole idle timeout, so the shared 20 s value would give up while the plan is being written.
 *    A file goes the same way, as the form parts the plugin builds a multipart body from (`formParts`), so a PDF or a
 *    camera photo has the same long wait and the same Stop as text;
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
  // the one server sentence that names the provider where the glossary says "the assistant"
  if (code === 'no_instructions') return new ApiError('Say what you want first.', status, code);
  return new ApiError(body.error ?? fallback, status, code);
};

/** One part of a multipart form as the native HTTP plugin reads it (`dataType: 'formData'`). */
export type FormPart = { key: string; value: string; type: 'string' } | { key: string; value: string; type: 'base64File'; contentType: string; fileName: string };

/**
 * The file mode's form for the native plugin: the same fields the browser's FormData carries, the file as base64. The
 * file name goes into a quoted header on the phone, so quotes, slashes and line breaks are taken out of it.
 */
export const formParts = (input: Pick<DraftInput, 'start' | 'instructions'>, file: { name: string; type: string }, base64: string): FormPart[] => [
  { key: 'mode', value: 'file', type: 'string' },
  { key: 'start', value: input.start, type: 'string' },
  ...(input.instructions ? [{ key: 'instructions', value: input.instructions, type: 'string' as const }] : []),
  { key: 'file', value: base64, type: 'base64File', contentType: file.type || 'application/pdf', fileName: file.name.replace(/["\\/\r\n]/g, '_').trim() || 'plan' },
];

const base64Of = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new ApiError('Couldn’t read that file. Choose it again.', 0, 'file_read'));
    fr.onload = () => {
      const s = String(fr.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    fr.readAsDataURL(file);
  });

const nativePost = async (url: string, headers: Record<string, string>, data: unknown, dataType?: 'formData'): Promise<Response> => {
  const r = await CapacitorHttp.request({ url, method: 'POST', headers, data, ...(dataType ? { dataType } : {}), responseType: 'text', connectTimeout: DRAFT_TIMEOUT_MS, readTimeout: DRAFT_TIMEOUT_MS });
  const text = typeof r.data === 'string' ? r.data : r.data == null ? '' : JSON.stringify(r.data);
  return new Response(r.status === 204 ? null : text, { status: r.status });
};

const send = async (input: DraftInput, signal: AbortSignal): Promise<Response> => {
  const url = `${apiOrigin}/api/plans/draft`;
  if (input.mode === 'file') {
    if (!input.file) throw new ApiError('Choose a PDF or a photo of your plan first.', 422, 'no_file');
    // the iPhone app: the native plugin writes the multipart body (and its boundary) from the parts
    if (isNative) return nativePost(url, { 'Content-Type': 'multipart/form-data', [LOCAL_DATE_HEADER]: today() }, formParts(input, input.file, await base64Of(input.file)), 'formData');
    const fd = new FormData();
    fd.set('mode', 'file');
    fd.set('start', input.start);
    if (input.instructions) fd.set('instructions', input.instructions);
    fd.set('file', input.file);
    return fetch(url, { method: 'POST', body: fd, headers: { [LOCAL_DATE_HEADER]: today() }, credentials: 'same-origin', signal });
  }
  const body = JSON.stringify({ mode: input.mode, text: input.mode === 'text' ? input.text : undefined, instructions: input.instructions || undefined, start: input.start, end: input.end || undefined });
  const headers = { 'content-type': 'application/json', [LOCAL_DATE_HEADER]: today() };
  if (!isNative) return fetch(url, { method: 'POST', headers, body, credentials: 'same-origin', signal });
  // the iPhone app: the native HTTP plugin (its cookie jar holds the sign-in), with the long timeout on both settings
  return nativePost(url, headers, body);
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
