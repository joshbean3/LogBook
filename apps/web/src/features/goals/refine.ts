import { fitnessOn } from '@/lib/prefs';
import type { Consent, GoalLevel, GoalRefinement } from '@logbook/shared';
import { api, ApiError, isOffline } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { useConsent } from '@/lib/consent';

/**
 * The goal review (POST /goals/refine): Claude rewrites a goal to be specific, measurable and due at the period's end.
 * The words leave the phone only when the account said yes to assistant access (consent `training`, with an answer on
 * record). Every other outcome saves the goal as typed and says why, so nothing a person writes waits on the review.
 */

/** How long the editor waits for the review before it gives the words back. */
export const REVIEW_TIMEOUT_MS = 15_000;

/**
 * Whether the review may run. `on`: the account allowed it. `off`: assistant access is off, or was never chosen.
 * `none`: this server has no assistant. `unknown`: the choice has not loaded, so nothing is sent.
 */
export type ReviewAccess = 'on' | 'off' | 'none' | 'unknown';

export const reviewAccess = (consent: Consent | null | undefined, claude: boolean | undefined): ReviewAccess => {
  if (claude === false) return 'none';
  if (!consent) return 'unknown';
  return consent.training === true && consent.at != null ? 'on' : 'off';
};

/** The account's choice, from the bootstrap (or from the consent record when that is the newer of the two). */
export const useReviewAccess = (): ReviewAccess => {
  const boot = useBootstrap();
  const own = useConsent();
  const fromBoot = boot.data?.consent;
  const consent = fromBoot && boot.dataUpdatedAt >= own.dataUpdatedAt ? fromBoot : (own.data ?? fromBoot);
  return reviewAccess(consent, boot.data?.features.claude);
};

/** Why a goal is saved as typed, without a review. */
export type AsTyped = 'consent' | 'unavailable' | 'offline' | 'declined' | 'limit';

export type Review =
  /** Claude answered: its words, why, and any steps it suggests. */
  | { kind: 'reviewed'; text: string; why: string | null; changed: boolean; steps: string[] }
  /** No review: save the words as they are. */
  | { kind: 'asTyped'; why: AsTyped }
  /** No answer in time: back to the field, with the choice to save as written. */
  | { kind: 'slow' }
  /** The request cannot be made at all (signed out): stay in the field. */
  | { kind: 'failed'; message: string };

export const AS_TYPED_WORDS: Record<AsTyped, string> = {
  consent: 'Saved as written. Turn on Training data in Settings, Privacy, to have goals reviewed.',
  unavailable: 'Saved as written. The review was not available.',
  offline: 'Saved as written. The review needs a connection.',
  declined: 'Saved as written. The review could not help with this one.',
  limit: 'Saved as written. The review is at its limit for now.',
};
/** The words for a goal saved without a review; with Fitness off (lib/prefs.ts) the switch is named as that person sees it. */
export const asTypedWords = (why: AsTyped, fitness = fitnessOn()): string => (why === 'consent' && !fitness ? 'Saved as written. Turn on Your data in Settings, Privacy, to have goals reviewed.' : AS_TYPED_WORDS[why]);
export const SLOW_WORDS = 'The review took too long. Save as written?';

type Input = { level: GoalLevel; period: string; text: string };
type Post = (input: Input, signal: AbortSignal) => Promise<GoalRefinement>;
const post: Post = (input, signal) => api<GoalRefinement>('/goals/refine', { method: 'POST', json: input, signal });

/**
 * Ask for the review. With access off (or not known) no request is made. `signal` drops the request when the editor is
 * left; a request with no answer after `timeoutMs` is dropped too. Never throws.
 */
export const reviewGoal = async (
  input: Input,
  access: ReviewAccess,
  opts: { signal?: AbortSignal; timeoutMs?: number; send?: Post; offline?: () => boolean } = {},
): Promise<Review> => {
  if (access === 'off') return { kind: 'asTyped', why: 'consent' };
  if (access !== 'on') return { kind: 'asTyped', why: 'unavailable' };
  if ((opts.offline ?? isOffline)()) return { kind: 'asTyped', why: 'offline' };
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  opts.signal?.addEventListener('abort', stop);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<Review>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'slow' }), opts.timeoutMs ?? REVIEW_TIMEOUT_MS);
  });
  const answer = (opts.send ?? post)(input, ctl.signal).then(
    (r): Review => (r.available === false ? { kind: 'asTyped', why: 'unavailable' } : { kind: 'reviewed', text: r.text, why: r.why ?? null, changed: !!r.changed, steps: Array.isArray(r.steps) ? r.steps : [] }),
    (e: unknown): Review => {
      if (!(e instanceof ApiError)) return { kind: 'asTyped', why: 'offline' };
      if (e.status === 401) return { kind: 'failed', message: e.message };
      if (e.code === 'consent_required') return { kind: 'asTyped', why: 'consent' };
      if (e.code === 'refused') return { kind: 'asTyped', why: 'declined' };
      if (e.status === 429) return { kind: 'asTyped', why: 'limit' };
      return { kind: 'asTyped', why: 'unavailable' };
    },
  );
  try {
    return await Promise.race([answer, slow]);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', stop);
    // whichever lost the race, the request has no reader left
    ctl.abort();
  }
};
