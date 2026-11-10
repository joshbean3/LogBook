import type { AssistantLive, AssistantReply, AssistantScreen, AssistantTurn, Attachment, ISODate } from '@logbook/shared';
import { NetworkError } from '@/api/client';
import { haptics } from '@/lib/haptics';
import { requestTurns, type RequestTurn } from './attach';
import { AskError } from './poll';
import { cleanTurn } from './sanitize';
import { assistantStore } from './store';

type Watch = { onJob?: (id: string) => void; onProgress?: (live: AssistantLive) => void };
type Ask = (date: ISODate, turns: RequestTurn[], screen?: AssistantScreen, watch?: Watch) => Promise<AssistantReply>;
type Stop = (jobId: string) => Promise<unknown>;

/** What an ask that failed says in the chat: the phone could not reach the server, or the server's own message. */
export const failureText = (e: unknown) => {
  const why = e instanceof NetworkError ? 'Couldn’t reach Logbook. Check your connection, then try again.' : e instanceof Error && e.message ? e.message : 'Try again.';
  return `That didn’t go through. ${why}`;
};

/**
 * The turn an answer becomes in the chat: its words, proposal, replies and how it reasoned, each kept only in the shape
 * the thread can draw (sanitize.ts). An answer with nothing to show is null: the chat says it did not go through.
 */
export const turnOf = (r: AssistantReply): AssistantTurn | null =>
  cleanTurn({ role: 'assistant', text: r?.text, proposal: r?.proposal ?? null, replies: r?.replies, thoughts: r?.thoughts, thoughtSeconds: r?.thoughtSeconds, steps: r?.steps });

/** The server's "ask first" (Contract C1): no choice about the assistant is stored for this account yet. */
const needsConsent = (e: unknown) => e instanceof Error && (e as { code?: unknown }).code === 'consent_required';

/**
 * Sends the conversation as it stands and adds the answer to it. While the answer is written its words show as they come
 * (assistantStore.live); a failure stays in the chat as a turn with Retry; a stopped answer keeps the words it had. One
 * ask at a time; the answer lands in the chat that asked, even when the owner has opened another or started a new one.
 */
export const runAsk = async (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, now = Date.now) => {
  if (assistantStore.busySince() !== null) return;
  const chat = assistantStore.currentId();
  assistantStore.setBusy(now(), chat);
  let turn: AssistantTurn | null;
  try {
    const r = await ask(date, requestTurns(assistantStore.get(), assistantStore.filesOf), screen, {
      onJob: (id) => assistantStore.setJob(id),
      onProgress: (l) => assistantStore.setLive(l),
    });
    turn = turnOf(r) ?? { role: 'assistant', text: failureText(null), error: true };
    if (typeof r?.title === 'string') assistantStore.name(chat, r.title);
    if (turn.proposal) haptics.success();
  } catch (e) {
    if (e instanceof AskError && e.code === 'stopped') {
      const words = assistantStore.live()?.text.trim();
      turn = words ? { role: 'assistant', text: words, stopped: true } : null;
    } else if (needsConsent(e)) {
      // nothing went to Claude: the sheet asks, and the question waits in the chat for the answer
      turn = null;
      assistantStore.setConsentNeeded(true);
    } else turn = { role: 'assistant', text: failureText(e), error: true };
  }
  assistantStore.setBusy(null);
  if (turn) assistantStore.pushTo(chat, turn);
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

/** Edit a question already sent: everything from it on comes off, and the new words go in its place (ChatGPT's Edit). */
export const editTurn = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, index: number, text: string) => {
  if (assistantStore.busySince() !== null || assistantStore.get()[index]?.role !== 'user') return;
  assistantStore.truncate(index);
  return sendTurn(ask, date, screen, text, { shown: undefined, data: [] });
};
