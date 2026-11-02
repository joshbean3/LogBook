/** What the server answers for an ask in the background (GET /assistant/jobs/:id). */
export type JobAnswer<T> = { status: 'running' } | { status: 'done'; reply: T } | { status: 'error'; error: { message: string; status: number; code: string | null } };

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
}

/**
 * Start an ask, then read its answer with short requests until it is ready: 1.2 s apart at first, easing to 3 s. A check
 * that cannot reach the server is tried again (a tunnel, a locked screen) until the time runs out; any other failure ends
 * it. A server with nothing to wait on (no Claude key) answers in the first response.
 */
export const askAndWait = async <T>(start: () => Promise<{ jobId: string } | T>, check: (jobId: string) => Promise<JobAnswer<T>>, opts: WaitOptions = {}): Promise<T> => {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.maxMs ?? 8 * 60_000);
  const first = await start();
  if (!first || typeof first !== 'object' || !('jobId' in first)) return first as T;
  let delay = 1200;
  while (now() < deadline) {
    await sleep(delay);
    delay = Math.min(3000, delay + 300);
    let a: JobAnswer<T>;
    try {
      a = await check(first.jobId);
    } catch (e) {
      if (opts.isTransient?.(e)) continue;
      throw e;
    }
    if (a.status === 'done') return a.reply;
    if (a.status === 'error') throw new AskError(a.error.message, a.error.status, a.error.code);
  }
  throw new AskError('This is taking longer than it should. Try again, or ask for less at once.', 504, 'too_slow');
};
