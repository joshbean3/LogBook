import { ApiError, uid } from '../lib/util.js';

/**
 * An ask the phone does not wait on. A long ask (reading photos of a plan and writing fifty changes) can run for minutes;
 * a phone holding one request open that long loses it to a timeout, a weak signal or a locked screen. So the ask runs
 * here in the background and the phone checks on it with short requests until it is done.
 *
 * Jobs live in memory, one process, kept for 30 minutes after they start. A restart loses the running ones; the phone
 * then hears "not found" and says to send it again.
 */
export type JobState<T> = { status: 'running' } | { status: 'done'; reply: T } | { status: 'error'; error: { message: string; status: number; code: string | null } };

interface Job<T> {
  userId: string;
  startedAt: number;
  state: JobState<T>;
}

export const JOB_TTL_MS = 30 * 60_000;
const jobs = new Map<string, Job<unknown>>();

const purge = (now: number) => {
  for (const [id, j] of jobs) if (now - j.startedAt > JOB_TTL_MS) jobs.delete(id);
};

/** Start `work` for a user; answers the job's id at once. */
export const startJob = <T>(userId: string, work: () => Promise<T>, now = Date.now()): string => {
  purge(now);
  const id = uid('aj');
  const job: Job<T> = { userId, startedAt: now, state: { status: 'running' } };
  jobs.set(id, job as Job<unknown>);
  void work().then(
    (reply) => {
      job.state = { status: 'done', reply };
    },
    (e: unknown) => {
      const status = e instanceof ApiError ? e.status : 500;
      const code = e instanceof ApiError ? (e.code ?? null) : 'internal';
      if (!(e instanceof ApiError)) console.error('[assistant job]', e);
      job.state = { status: 'error', error: { message: e instanceof ApiError ? e.message : 'The assistant hit a problem on the server. Try again.', status, code } };
    },
  );
  return id;
};

/** A user's job, or null when it is not theirs, never existed or has expired. */
export const jobState = <T>(userId: string, id: string, now = Date.now()): JobState<T> | null => {
  purge(now);
  const j = jobs.get(id);
  return j && j.userId === userId ? (j.state as JobState<T>) : null;
};
