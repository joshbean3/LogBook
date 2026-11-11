import { zPlanAssistResult, type PlanAssistRequest, type PlanAssistResult } from '@logbook/shared';
import { api, ApiError } from '@/api/client';
import { settleOrStop } from './draftRequest';

/*
 * One request to `POST /api/plans/template/assist` (the plan builder's assistant). The answer is a few fields, so the wait
 * is short: 45 seconds, then it counts as failed. Stop settles the wait at once, on the phone too (the native HTTP plugin
 * has no cancel): whatever arrives after a Stop or the timeout is dropped and never applied.
 */

/** A little over the server's own limit for the call it makes (40 s). */
export const SHAPE_TIMEOUT_MS = 45_000;

/**
 * Ask for a change to the builder's settings. Rejects with an `ApiError` (code `cancelled` after a Stop, `timeout`, or the
 * server's own code and status) or a `NetworkError`; an answer that is not the contract's shape is `invalid_answer`.
 */
export const requestShape = async (body: PlanAssistRequest, signal: AbortSignal): Promise<PlanAssistResult> => {
  // stopped before it started: nothing is sent
  if (signal.aborted) throw new ApiError('Stopped.', 499, 'cancelled');
  const raw = await settleOrStop(api<unknown>('/plans/template/assist', { method: 'POST', json: body, signal, timeoutMs: SHAPE_TIMEOUT_MS }), signal, SHAPE_TIMEOUT_MS + 2_000);
  const r = zPlanAssistResult.safeParse(raw);
  if (!r.success) throw new ApiError('The answer was not one this app reads.', 502, 'invalid_answer');
  return r.data;
};
