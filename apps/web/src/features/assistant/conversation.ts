import type { AssistantReply, AssistantScreen, AssistantTurn, Attachment, ISODate } from '@logbook/shared';
import { NetworkError } from '@/api/client';
import { requestTurns, type RequestTurn } from './attach';
import { assistantStore } from './store';

type Ask = (date: ISODate, turns: RequestTurn[], screen?: AssistantScreen) => Promise<AssistantReply>;

/** What an ask that failed says in the chat: the phone could not reach the server, or the server's own message. */
export const failureText = (e: unknown) => {
  const why = e instanceof NetworkError ? 'Couldn’t reach Logbook. Check your connection, then try again.' : e instanceof Error && e.message ? e.message : 'Try again.';
  return `That didn’t go through. ${why}`;
};

/**
 * Sends the conversation as it stands and adds the answer (its proposal and suggested replies) to it. A failure stays in
 * the chat as a turn with Retry. One ask at a time; an answer for a conversation cleared meanwhile is dropped.
 */
export const runAsk = async (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, now = Date.now) => {
  if (assistantStore.busySince() !== null) return;
  const gen = assistantStore.generation();
  assistantStore.setBusy(now());
  let turn: AssistantTurn;
  try {
    const r = await ask(date, requestTurns(assistantStore.get(), assistantStore.filesOf), screen);
    turn = { role: 'assistant', text: r.text, proposal: r.proposal, ...(r.replies?.length ? { replies: r.replies.slice(0, 3) } : {}) };
  } catch (e) {
    turn = { role: 'assistant', text: failureText(e), error: true };
  }
  if (assistantStore.generation() !== gen) return;
  assistantStore.setBusy(null);
  assistantStore.push(turn);
};

/** Retry: the failed turn comes off and the same conversation goes again. */
export const retryAsk = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined) => {
  assistantStore.dropError();
  return runAsk(ask, date, screen);
};

export const sendTurn = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, text: string, files: { shown: AssistantTurn['files']; data: Attachment[] }) => {
  assistantStore.push({ role: 'user', text, ...(files.shown?.length ? { files: files.shown } : {}) }, files.data);
  return runAsk(ask, date, screen);
};
