import type { AssistantReply, AssistantScreen, AssistantTurn, Attachment, ISODate } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import type { Watch } from './api';
import { requestTurns, type RequestTurn } from './attach';
import { failureText, UNAVAILABLE } from './errors';
import { AskError } from './poll';
import { cleanTurn } from './sanitize';
import { assistantStore } from './store';

export { failureText } from './errors';

type Ask = (date: ISODate, turns: RequestTurn[], screen?: AssistantScreen, watch?: Watch) => Promise<AssistantReply>;
type Stop = (jobId: string) => Promise<unknown>;
type Wait = (jobId: string, watch?: Watch) => Promise<AssistantReply>;

/**
 * The turn an answer becomes in the chat: its words, proposal, replies and how it reasoned, each kept only in the shape
 * the thread can draw (sanitize.ts). An answer with nothing to show is null: the chat says it did not go through.
 */
export const turnOf = (r: AssistantReply): AssistantTurn | null =>
  cleanTurn({ role: 'assistant', text: r?.text, proposal: r?.proposal ?? null, replies: r?.replies, thoughts: r?.thoughts, thoughtSeconds: r?.thoughtSeconds, steps: r?.steps });

const codeOf = (e: unknown) => (e instanceof Error ? (e as { code?: unknown }).code : undefined);
const statusOf = (e: unknown) => (e instanceof Error ? (e as { status?: unknown }).status : undefined);

/**
 * Reads an answer to its end and adds it to the chat that asked. A failure stays in the chat as a turn with Retry; a
 * stopped answer keeps the words it had (none: the thread says Stopped); "ask first" holds the question for the
 * permission step; a 401 leaves the question for later (the app goes to sign in). An answer that took too long is
 * stopped on the server too.
 */
const settle = async (chat: string, read: (watch: Watch) => Promise<AssistantReply>, stop?: Stop) => {
  let turn: AssistantTurn | null;
  let started = false;
  const watch: Watch = {
    onJob: (id) => assistantStore.setJob(id),
    onProgress: (l) => {
      // one light tick as the first words land; none per word
      if (!started && l.text) {
        started = true;
        haptics.tick();
      }
      assistantStore.setLive(l);
    },
    onConnection: (ok) => assistantStore.setOffline(!ok),
  };
  try {
    const r = await read(watch);
    if (r && r.available === false) turn = { role: 'assistant', text: `That didn’t go through. ${UNAVAILABLE}`, error: true };
    else {
      turn = turnOf(r) ?? { role: 'assistant', text: failureText(null), error: true };
      if (typeof r?.title === 'string') assistantStore.name(chat, r.title);
    }
  } catch (e) {
    if (e instanceof AskError && e.code === 'stopped') {
      const words = assistantStore.live()?.text.trim();
      turn = words ? { role: 'assistant', text: words, stopped: true } : null;
      if (!words) assistantStore.setStopped(chat);
    } else if (codeOf(e) === 'consent_required') {
      // nothing went to Claude: the sheet asks, and the question waits in the chat for the answer
      turn = null;
      assistantStore.setConsentNeeded(true);
    } else if (statusOf(e) === 401) {
      // signed out: the app goes to sign in; the question stays and the thread offers Retry when back
      turn = null;
    } else {
      if (codeOf(e) === 'too_slow') {
        const id = assistantStore.jobId();
        if (id && stop) void stop(id).catch(() => undefined);
      }
      turn = { role: 'assistant', text: failureText(e), error: true };
    }
  }
  assistantStore.setBusy(null);
  if (turn) {
    // one at the end: success for changes to review, error for a failure, a light tick for words
    if (turn.error) haptics.error();
    else if (turn.proposal) haptics.success();
    else haptics.tick();
    assistantStore.pushTo(chat, turn);
  }
};

/**
 * Sends the conversation as it stands and adds the answer to it. While the answer is written its words show as they come
 * (assistantStore.live). One ask at a time; the answer lands in the chat that asked, even when the owner has opened
 * another or started a new one.
 */
export const runAsk = async (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, now = Date.now, stop?: Stop, chatId?: string) => {
  if (assistantStore.busySince() !== null) return;
  // the open chat, or a pane's own (AssistantPane): the answer lands in the chat that asked
  const chat = chatId ?? assistantStore.currentId();
  assistantStore.setBusy(now(), chat);
  await settle(chat, (watch) => ask(date, requestTurns(assistantStore.turnsFor(chat), assistantStore.filesOf), screen, watch), stop);
};

/**
 * After a reload while an answer was written: carry on reading it (the server still has it), or, if it is gone, say so
 * in the chat with Retry.
 */
export const resumeAsk = async (wait: Wait, stop?: Stop) => {
  const job = assistantStore.pendingJob();
  if (!job || assistantStore.busySince() !== null) return;
  assistantStore.setBusy(job.startedAt, job.chatId);
  assistantStore.setJob(job.jobId);
  await settle(job.chatId, (watch) => wait(job.jobId, { onProgress: watch.onProgress, onConnection: watch.onConnection }), stop);
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
export const retryAsk = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, stop?: Stop, chatId?: string) => {
  assistantStore.dropError(chatId);
  return runAsk(ask, date, screen, Date.now, stop, chatId);
};

/** Regenerate: the last answer comes off and the same question goes again. */
export const regenerate = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, stop?: Stop, chatId?: string) => {
  assistantStore.dropLastAnswer(chatId);
  return runAsk(ask, date, screen, Date.now, stop, chatId);
};

export const sendTurn = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, text: string, files: { shown: AssistantTurn['files']; data: Attachment[] }, stop?: Stop, chatId?: string) => {
  haptics.select();
  assistantStore.push({ role: 'user', text, ...(files.shown?.length ? { files: files.shown } : {}) }, files.data, chatId);
  return runAsk(ask, date, screen, Date.now, stop, chatId);
};

/** Edit a question already sent: everything from it on comes off, and the new words go in its place (the usual Edit in chat apps). */
export const editTurn = (ask: Ask, date: ISODate, screen: AssistantScreen | undefined, index: number, text: string, stop?: Stop, chatId?: string) => {
  const chat = chatId ?? assistantStore.currentId();
  if (assistantStore.busySince() !== null || assistantStore.turnsFor(chat)[index]?.role !== 'user') return;
  assistantStore.truncate(index, chat);
  return sendTurn(ask, date, screen, text, { shown: undefined, data: [] }, stop, chat);
};
