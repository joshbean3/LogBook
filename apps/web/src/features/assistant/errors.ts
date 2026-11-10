import { NetworkError } from '@/api/client';

/**
 * What a failure says to the person: a plain line chosen by the status and code, never the server's own message (which
 * can be a validation list or a developer note). Codes from Contract C9: rate_limited, claude_busy, claude_not_configured.
 */
const partsOf = (e: unknown): { status: number; code: string | null } => {
  const r = (typeof e === 'object' && e !== null ? e : {}) as { status?: unknown; code?: unknown };
  return { status: typeof r.status === 'number' ? r.status : 0, code: typeof r.code === 'string' ? r.code : null };
};

export const OFFLINE = 'Couldn’t reach Orby. Check your connection, then try again.';
export const UNAVAILABLE = 'The assistant is not available right now. Try again later.';
const TOO_LONG = 'That message was too long to send. Start a new chat or send less.';
const BUSY = 'You’ve asked a lot in a short time. Try again in a few minutes.';
const OURS = 'Something went wrong on our side. Try again.';
const SLOW = 'This is taking longer than it should. Try again, or ask for less at once.';

/** Why an ask did not go through, in one plain line. */
export const whyAskFailed = (e: unknown): string => {
  if (e instanceof NetworkError) return OFFLINE;
  const { status, code } = partsOf(e);
  if (code === 'too_slow') return SLOW;
  if (status === 401 || code === 'unauthenticated') return 'Sign in to continue, then try again.';
  if (code === 'claude_not_configured' || code === 'claude_busy' || status === 503) return UNAVAILABLE;
  if (status === 429 || code === 'rate_limited') return BUSY;
  if (status === 413 || status === 422 || status === 400 || code === 'validation') return TOO_LONG;
  if (code === 'job_gone' || status === 404 || status >= 500) return OURS;
  return OURS;
};

/** What an ask that failed says in the chat. */
export const failureText = (e: unknown) => `That didn’t go through. ${whyAskFailed(e)}`;

/** Why Apply, Undo or Not now on a proposal did not go through. */
export const proposalFailure = (e: unknown): string => {
  if (e instanceof NetworkError) return OFFLINE;
  const { status, code } = partsOf(e);
  if (code === 'stale_proposal') return 'A change no longer fits your plan. Ask again for a fresh proposal.';
  if (status === 409) return 'This proposal is closed. Ask again for a fresh one.';
  if (status === 422 || code === 'validation') return 'Nothing left to apply. Put a change back, or tap Not now.';
  if (status === 404) return 'This proposal is no longer here. Ask again for a fresh one.';
  if (status === 401) return 'Sign in to continue, then try again.';
  return 'That didn’t go through. Try again.';
};
