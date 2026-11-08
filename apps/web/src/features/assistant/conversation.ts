import type { AssistantLive, AssistantReply, AssistantScreen, AssistantTurn, Attachment, ISODate } from '@logbook/shared';
import { NetworkError } from '@/api/client';
import { haptics } from '@/lib/haptics';
import { requestTurns, type RequestTurn } from './attach';
import { AskError } from './poll';
import { assistantStore } from './store';

type Watch = { onJob?: (id: string) => void; onProgress?: (live: AssistantLive) => void };
type Ask = (date: ISODate, turns: RequestTurn[], screen?: AssistantScreen, watch?: Watch) => Promise<AssistantReply>;
type Stop = (jobId: string) => Promise<unknown>;

/** What an ask that failed says in the chat: the phone could not reach the server, or the server's own message. */
export const failureText = (e: unknown) => {
  const why = e instanceof NetworkError ? 'Couldn’t reach Logbook. Check your connection, then try again.' : e instanceof Error && e.message ? e.message : 'Try again.';
  return `That didn’t go through. ${why}`;
};

/** The turn an answer becomes in the chat: its words, proposal, replies and how it reasoned. */
export const turnOf = (r: AssistantReply): AssistantTurn => ({
  role: 'assistant',
  text: r.text,
  proposal: r.proposal,
  ...(r.replies?.length ? { replies: r.replies.slice(0, 3) } : {}),
  ...(r.thoughts ? { thoughts: r.thoughts } : {}),
  ...(typeof r.thoughtSeconds === 'number' ? { thoughtSeconds: r.thoughtSeconds } : {}),
});

/**
 * Sends the conversation as it stands and adds the answer to it. While the answer is written its words show as they come
 * (assistantStore.live); a failure stays in the chat as a turn with Retry; a stopped answer keeps the words it had. One
 * ask at a time; an answer for a conversation cleared meanwhile is dropped.
 */
export const runAsk = async (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, now = Date.now) => {
  if (assistantStore.busySince() !== null) return;
  const gen = assistantStore.generation();
  assistantStore.setBusy(now());
  let turn: AssistantTurn | null;
  try {
    const r = await ask(date, requestTurns(assistantStore.get(), assistantStore.filesOf), screen, {
      onJob: (id) => assistantStore.setJob(id),
      onProgress: (l) => assistantStore.generation() === gen && assistantStore.setLive(l),
    });
    turn = turnOf(r);
    if (r.proposal) haptics.success();
  } catch (e) {
    if (e instanceof AskError && e.code === 'stopped') {
      const words = assistantStore.live()?.text.trim();
      turn = words ? { role: 'assistant', text: words, stopped: true } : null;
    } else turn = { role: 'assistant', text: failureText(e), error: true };
  }
  if (assistantStore.generation() !== gen) return;
  assistantStore.setBusy(null);
  if (turn) assistantStore.push(turn);
};

/** Stop the answer being written: the server aborts it; runAsk keeps its words so far. */
export const stopAsk = async (stop: Stop) => {
  const id = assistantStore.jobId();
  if (!id) return;
  haptics.select();
  try {
    await stop(id);
  } catch {
    /* the answer may have just finished; the next look says so */
  }
};

/** Retry: the failed turn comes off and the same conversation goes again. */
export const retryAsk = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined) => {
  assistantStore.dropError();
  return runAsk(ask, date, screen);
};

/** Regenerate: the last answer comes off and the same question goes again. */
export const regenerate = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined) => {
  assistantStore.dropLastAnswer();
  return runAsk(ask, date, screen);
};

export const sendTurn = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, text: string, files: { shown: AssistantTurn['files']; data: Attachment[] }) => {
  haptics.select();
  assistantStore.push({ role: 'user', text, ...(files.shown?.length ? { files: files.shown } : {}) }, files.data);
  return runAsk(ask, date, screen);
};
