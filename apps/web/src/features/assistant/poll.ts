import type { AssistantLive } from '@logbook/shared';

/** What the server answers for an ask in the background (GET /assistant/jobs/:id). */
export type JobAnswer<T> = { status: 'running'; live?: AssistantLive } | { status: 'done'; reply: T } | { status: 'error'; error: { message: string; status: number; code: string | null } };

export class AskError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null = null,
  ) {
    super(message);
  }
}

export interface WaitOptions {
  /** Give up after this long (default 8 minutes: a plan built from photos can take a few). */
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** True for an error that means "the phone could not reach the server" this time (worth another try). */
  isTransient?: (e: unknown) => boolean;
  /** The job's id as soon as the server gives it (so the ask can be stopped). */
  onJob?: (id: string) => void;
  /** Each new look at the answer while it is written: what it is doing, its words so far, its reasoning. */
  onProgress?: (live: AssistantLive) => void;
  /** False after two looks in a row could not reach the server; true again on the next one that does. */
  onConnection?: (ok: boolean) => void;
  /** Resolves once the app is in view again: no looks while the phone is locked or the app is in the background. */
  whenVisible?: () => Promise<void>;
}

/** How long to wait before the next look: quick while words arrive, easing off while nothing changes. */
export const nextDelay = (prev: number, changed: boolean) => (changed ? 350 : Math.min(1500, Math.round(prev * 1.35)));

/**
 * Start an ask, then read its answer with short requests until it is ready. While the answer is being written the server
 * holds its words so far; each look passes them on (`onProgress`), about three a second while they change, easing to
 * one and a half seconds apart while nothing does. A look that cannot reach the server is tried again (a tunnel, a locked
 * screen) until the time runs out; any other failure ends it. A server with nothing to wait on (no Claude key) answers in
 * the first response.
 */
export const askAndWait = async <T>(start: () => Promise<{ jobId: string } | T>, check: (jobId: string) => Promise<JobAnswer<T>>, opts: WaitOptions = {}): Promise<T> => {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const first = await start();
  if (!first || typeof first !== 'object' || !('jobId' in first)) return first as T;
  opts.onJob?.(first.jobId);
  let deadline = now() + (opts.maxMs ?? 8 * 60_000);
  let delay = 400;
  let seen = '';
  let misses = 0;
  while (now() < deadline) {
    await sleep(delay);
    if (opts.whenVisible) {
      // time out of view does not count against the answer
      const away = now();
      await opts.whenVisible();
      deadline += now() - away;
    }
    let a: JobAnswer<T>;
    try {
      a = await check(first.jobId);
    } catch (e) {
      if (opts.isTransient?.(e)) {
        if (++misses === 2) opts.onConnection?.(false);
        delay = 1500;
        continue;
      }
      throw e;
    }
    if (misses >= 2) opts.onConnection?.(true);
    misses = 0;
    if (a.status === 'done') return a.reply;
    if (a.status === 'error') throw new AskError(a.error.message, a.error.status, a.error.code);
    const key = a.live ? `${a.live.phase}|${a.live.text.length}|${a.live.thoughts.length}` : '';
    const changed = key !== seen;
    seen = key;
    if (a.live && changed) opts.onProgress?.(a.live);
    delay = nextDelay(delay, changed);
  }
  throw new AskError('This is taking longer than it should. Try again, or ask for less at once.', 504, 'too_slow');
};
