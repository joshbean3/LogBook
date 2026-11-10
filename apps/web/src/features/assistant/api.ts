import type { AssistantReply, AssistantScreen, ISODate } from '@logbook/shared';
import { api, NetworkError } from '@/api/client';
import type { RequestTurn } from './attach';
import { askAndWait, type JobAnswer, type WaitOptions } from './poll';

/**
 * The assistant's requests, kept with the sheet (feature-local, so the sheet can resume an answer after a reload, say when
 * the connection drops and stop looking while the app is out of view).
 */
export type Watch = Pick<WaitOptions, 'onJob' | 'onProgress' | 'onConnection'>;

const whenVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden'
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const on = () => {
          if (document.visibilityState === 'hidden') return;
          document.removeEventListener('visibilitychange', on);
          resolve();
        };
        document.addEventListener('visibilitychange', on);
      });

const checkJob = (id: string) => api<JobAnswer<AssistantReply>>(`/assistant/jobs/${encodeURIComponent(id)}`);
const options = (watch: Watch): WaitOptions => ({ isTransient: (e) => e instanceof NetworkError, whenVisible, ...watch });

/** Ask: the server answers in the background and the app reads the answer with short requests (poll.ts). */
export const askAssistant = (date: ISODate, turns: RequestTurn[], screen?: AssistantScreen, watch: Watch = {}) =>
  askAndWait<AssistantReply>(() => api<{ jobId: string } | AssistantReply>('/assistant?async=1', { method: 'POST', json: { date, turns, ...(screen ? { screen } : {}) } }), checkJob, options(watch));

/** Carry on reading an answer already asked for (the app was reloaded while it was written). */
export const waitForJob = (jobId: string, watch: Watch = {}) => askAndWait<AssistantReply>(async () => ({ jobId }), checkJob, options(watch));

/** Stop an answer partway (the Stop button, or an answer that took too long). */
export const stopAssistant = (jobId: string) => api<{ stopped: boolean }>(`/assistant/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
