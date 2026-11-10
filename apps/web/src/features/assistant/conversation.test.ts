import type { AssistantReply } from '@logbook/shared';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ApiError, NetworkError } from '@/api/client';
import { editTurn, regenerate, resumeAsk, retryAsk, runAsk, sendTurn, stopAsk } from './conversation';
import { AskError } from './poll';
import { assistantStore } from './store';

const reply = (r: Partial<AssistantReply> = {}): AssistantReply => ({ text: 'Two runs left.', proposal: null, available: true, ...r });
const none = { shown: undefined, data: [] };

beforeEach(() => {
  assistantStore.clear();
  assistantStore.setConsentNeeded(false);
});

describe('a conversation with the assistant', () => {
  it('sends the turns and the screen, and keeps the suggested replies with the answer (three at most)', async () => {
    const ask = vi.fn(async () => reply({ replies: ['Move Thursday', 'And next week?', 'Shorter long run', 'Extra'] }));
    await sendTurn(ask, '2026-11-08', { tab: 'plan', week: '2026-11-09' }, 'What is left?', none);
    expect(ask).toHaveBeenCalledWith('2026-11-08', [{ role: 'user', text: 'What is left?' }], { tab: 'plan', week: '2026-11-09' }, { onJob: expect.any(Function), onProgress: expect.any(Function), onConnection: expect.any(Function) });
    expect(assistantStore.get()[1]).toEqual({ role: 'assistant', text: 'Two runs left.', proposal: null, replies: ['Move Thursday', 'And next week?', 'Shorter long run'] });
    expect(assistantStore.busySince()).toBeNull();
  });

  it('keeps a failure in the chat, and Retry sends the same turns again without it', async () => {
    const ask = vi.fn<(...a: unknown[]) => Promise<AssistantReply>>().mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(reply());
    await sendTurn(ask, '2026-11-08', undefined, 'hi', none);
    const failed = assistantStore.get()[1]!;
    expect(failed).toMatchObject({ role: 'assistant', error: true });
    expect(failed.text).toMatch(/^That didn’t go through\. Couldn’t reach Logbook/);
    await retryAsk(ask, '2026-11-08', undefined);
    expect(ask.mock.calls[1]![1]).toEqual([{ role: 'user', text: 'hi' }]);
    expect(assistantStore.get().map((t) => t.text)).toEqual(['hi', 'Two runs left.']);
  });

  it('asks once at a time; a new chat started meanwhile stays empty and the answer lands in the chat that asked', async () => {
    let finish!: (r: AssistantReply) => void;
    const ask = vi.fn(() => new Promise<AssistantReply>((r) => (finish = r)));
    const first = sendTurn(ask, '2026-11-08', undefined, 'one', none);
    const asked = assistantStore.currentId();
    await runAsk(ask, '2026-11-08', undefined);
    expect(ask).toHaveBeenCalledTimes(1);
    assistantStore.clear();
    finish(reply({ title: 'Counting runs' }));
    await first;
    expect(assistantStore.get()).toEqual([]);
    const chat = assistantStore.chats().find((c) => c.id === asked)!;
    expect(chat).toMatchObject({ title: 'Counting runs', named: true });
    expect(chat.turns.map((t) => t.text)).toEqual(['one', 'Two runs left.']);
    assistantStore.open(asked);
    expect(assistantStore.get()).toHaveLength(2);
  });

  it('keeps every chat in History, titled by its first words until the assistant names it', async () => {
    await sendTurn(vi.fn(async () => reply()), '2026-11-08', undefined, 'Move my long run to Sunday because of the wedding', none);
    const id = assistantStore.currentId();
    expect(assistantStore.chats()[0]).toMatchObject({ id, title: 'Move my long run to Sunday because…' });
    assistantStore.remove(id);
    expect(assistantStore.chats().some((c) => c.id === id)).toBe(false);
    expect(assistantStore.get()).toEqual([]);
  });

  it('Edit takes the question and everything after it off, and sends the new words', async () => {
    const ask = vi.fn(async () => reply());
    await sendTurn(ask, '2026-11-08', undefined, 'What is left?', none);
    await sendTurn(ask, '2026-11-08', undefined, 'And lifts?', none);
    await editTurn(ask, '2026-11-08', undefined, 2, 'And next week?');
    expect(assistantStore.get().map((t) => t.text)).toEqual(['What is left?', 'Two runs left.', 'And next week?', 'Two runs left.']);
    expect((ask.mock.calls[2] as unknown[])[1]).toEqual([{ role: 'user', text: 'What is left?' }, { role: 'assistant', text: 'Two runs left.' }, { role: 'user', text: 'And next week?' }]);
  });

  it('rates an answer, and a second tap on the same thumb takes it off', async () => {
    await sendTurn(vi.fn(async () => reply()), '2026-11-08', undefined, 'hi', none);
    assistantStore.rate(1, 'up');
    expect(assistantStore.get()[1]!.rating).toBe('up');
    assistantStore.rate(1, 'up');
    expect(assistantStore.get()[1]!.rating).toBeUndefined();
  });

  it('shows the words as they come, and keeps how it reasoned with the answer', async () => {
    const seen: string[] = [];
    const off = assistantStore.subscribe(() => assistantStore.live() && seen.push(assistantStore.live()!.text));
    const ask = vi.fn(async (_d: unknown, _t: unknown, _s: unknown, watch?: { onProgress?: (l: never) => void }) => {
      watch?.onProgress?.({ phase: 'writing', text: 'Two', thoughts: 'Checking.', seconds: 1 } as never);
      watch?.onProgress?.({ phase: 'writing', text: 'Two runs', thoughts: 'Checking.', seconds: 2 } as never);
      return reply({ thoughts: 'Checking.', thoughtSeconds: 3 });
    });
    await sendTurn(ask, '2026-11-08', undefined, 'What is left?', none);
    off();
    expect(seen).toEqual(['Two', 'Two runs']);
    expect(assistantStore.get()[1]).toMatchObject({ text: 'Two runs left.', thoughts: 'Checking.', thoughtSeconds: 3 });
    expect(assistantStore.live()).toBeNull();
  });

  it('Stop keeps the words so far as a stopped answer; a stop before any words leaves nothing', async () => {
    let fail!: (e: unknown) => void;
    const ask = vi.fn((_d: unknown, _t: unknown, _s: unknown, watch?: { onJob?: (id: string) => void; onProgress?: (l: never) => void }) => {
      watch?.onJob?.('aj1');
      watch?.onProgress?.({ phase: 'writing', text: 'Half an answer', thoughts: '', seconds: 2 } as never);
      return new Promise<AssistantReply>((_, rej) => (fail = rej));
    });
    const stop = vi.fn(async () => ({ stopped: true }));
    const running = sendTurn(ask, '2026-11-08', undefined, 'Plan my month', none);
    await stopAsk(stop);
    expect(stop).toHaveBeenCalledWith('aj1');
    fail(new AskError('Stopped.', 499, 'stopped'));
    await running;
    expect(assistantStore.get()[1]).toEqual({ role: 'assistant', text: 'Half an answer', stopped: true });

    assistantStore.clear();
    const early = vi.fn(async () => Promise.reject(new AskError('Stopped.', 499, 'stopped')));
    await sendTurn(early, '2026-11-08', undefined, 'Plan my month', none);
    expect(assistantStore.get()).toHaveLength(1);
    // the thread says Stopped under the question, until it is asked again
    expect(assistantStore.stoppedChat()).toBe(assistantStore.currentId());
    await runAsk(vi.fn(async () => reply()), '2026-11-08', undefined);
    expect(assistantStore.stoppedChat()).toBeNull();
  });

  it('an answer that took too long is stopped on the server too, and says so in plain words', async () => {
    const stop = vi.fn(async () => ({ stopped: true }));
    const slow = vi.fn(async (_d: unknown, _t: unknown, _s: unknown, watch?: { onJob?: (id: string) => void }) => {
      watch?.onJob?.('aj9');
      throw new AskError('This is taking longer than it should.', 504, 'too_slow');
    });
    await sendTurn(slow, '2026-11-08', undefined, 'Plan my year', none, stop);
    expect(stop).toHaveBeenCalledWith('aj9');
    expect(assistantStore.get()[1]).toMatchObject({ error: true, text: expect.stringMatching(/taking longer than it should/) });
  });

  it('a server with no assistant (available: false) gives a failure with Retry, never a saved answer', async () => {
    await sendTurn(vi.fn(async () => ({ text: 'The assistant needs a Claude key on the server (ANTHROPIC_API_KEY).', proposal: null, available: false })), '2026-11-08', undefined, 'hi', none);
    expect(assistantStore.get()[1]).toEqual({ role: 'assistant', text: 'That didn’t go through. The assistant is not available right now. Try again later.', error: true });
  });

  it('signed out mid-ask: no failure card, the question waits for Retry', async () => {
    await sendTurn(vi.fn(async () => Promise.reject(new ApiError('Sign in to continue', 401, 'unauthenticated'))), '2026-11-08', undefined, 'hi', none);
    expect(assistantStore.get()).toEqual([{ role: 'user', text: 'hi' }]);
  });

  it('after a reload, carries on reading the answer that was being written; one that is gone says so', async () => {
    const box = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => box.set(k, v), removeItem: (k: string) => box.delete(k) });
    onTestFinished(() => {
      vi.unstubAllGlobals();
      assistantStore.setBusy(null);
    });
    let finish!: (r: AssistantReply) => void;
    const ask = vi.fn((_d: unknown, _t: unknown, _s: unknown, watch?: { onJob?: (id: string) => void }) => {
      watch?.onJob?.('aj5');
      return new Promise<AssistantReply>((r) => (finish = r));
    });
    const chat = assistantStore.currentId();
    void sendTurn(ask, '2026-11-08', undefined, 'Plan my week', none);
    expect(assistantStore.pendingJob()).toMatchObject({ chatId: chat, jobId: 'aj5' });
    // the page goes away mid-answer: memory is lost, the job is not
    assistantStore.setBusy(null);
    sessionStorage.setItem('logbook.assistant.job', JSON.stringify({ chatId: chat, jobId: 'aj5', startedAt: 1 }));
    const wait = vi.fn(async () => reply({ text: 'Your week.' }));
    await resumeAsk(wait);
    expect(wait).toHaveBeenCalledWith('aj5', expect.anything());
    expect(assistantStore.get().map((t) => t.text)).toEqual(['Plan my week', 'Your week.']);
    expect(assistantStore.pendingJob()).toBeNull();
    finish(reply());

    assistantStore.clear();
    assistantStore.push({ role: 'user', text: 'Again' });
    sessionStorage.setItem('logbook.assistant.job', JSON.stringify({ chatId: assistantStore.currentId(), jobId: 'gone', startedAt: 1 }));
    await resumeAsk(vi.fn(async () => Promise.reject(new AskError('That answer is no longer here (the server may have restarted).', 404, 'job_gone'))));
    expect(assistantStore.get()[1]).toMatchObject({ error: true, text: 'That didn’t go through. Something went wrong on our side. Try again.' });
  });

  it('Ask again takes the last answer off and sends the same question', async () => {
    const ask = vi.fn(async () => reply()).mockResolvedValueOnce(reply({ text: 'First try.' }));
    await sendTurn(ask, '2026-11-08', undefined, 'What is left?', none);
    await regenerate(ask, '2026-11-08', undefined);
    expect((ask.mock.calls[1] as unknown[])[1]).toEqual([{ role: 'user', text: 'What is left?' }]);
    expect(assistantStore.get().map((t) => t.text)).toEqual(['What is left?', 'Two runs left.']);
  });

  it('holds the question and asks for permission when the server says no choice is stored (403 consent_required)', async () => {
    const ask = vi.fn<(...a: unknown[]) => Promise<AssistantReply>>().mockRejectedValueOnce(new ApiError('Choose first', 403, 'consent_required')).mockResolvedValueOnce(reply());
    await sendTurn(ask, '2026-11-10', undefined, 'What is left?', none);
    // no error card: the question waits, and the sheet shows its permission step
    expect(assistantStore.get()).toEqual([{ role: 'user', text: 'What is left?' }]);
    expect(assistantStore.consentNeeded()).toBe(true);
    expect(assistantStore.busySince()).toBeNull();
    // the same answer from a job that was already running
    assistantStore.setConsentNeeded(false);
    await runAsk(vi.fn(async () => Promise.reject(new AskError('Choose first', 403, 'consent_required'))), '2026-11-10', undefined);
    expect(assistantStore.consentNeeded()).toBe(true);
    // once the choice is stored the held question goes
    assistantStore.setConsentNeeded(false);
    await runAsk(ask, '2026-11-10', undefined);
    expect(assistantStore.get().map((t) => t.text)).toEqual(['What is left?', 'Two runs left.']);
  });

  it('never saves an answer the thread cannot draw: a proposal with no changes goes, an empty answer is a failure', async () => {
    const bad = { text: 'Here it is.', proposal: { id: 'a1', summary: 'Move it', status: 'proposed' }, available: true } as unknown as AssistantReply;
    await sendTurn(vi.fn(async () => bad), '2026-11-10', undefined, 'Move the tempo', none);
    expect(assistantStore.get()[1]).toEqual({ role: 'assistant', text: 'Here it is.' });
    assistantStore.clear();
    await sendTurn(vi.fn(async () => ({ available: true }) as unknown as AssistantReply), '2026-11-10', undefined, 'hi', none);
    expect(assistantStore.get()[1]).toEqual({ role: 'assistant', text: 'That didn’t go through. Something went wrong on our side. Try again.', error: true });
    assistantStore.clear();
    await sendTurn(vi.fn(async () => null as unknown as AssistantReply), '2026-11-10', undefined, 'hi', none);
    expect(assistantStore.get()[1]).toMatchObject({ role: 'assistant', error: true });
  });
});

describe('a clean start after the sheet could not draw (logbook:assistant-reset)', () => {
  it('opens a new chat and keeps the old one in History; a chat that fails twice is taken off', async () => {
    await sendTurn(vi.fn(async () => reply()), '2026-11-10', undefined, 'What is left?', none);
    const first = assistantStore.currentId();
    assistantStore.reset();
    expect(assistantStore.currentId()).not.toBe(first);
    expect(assistantStore.get()).toEqual([]);
    expect(assistantStore.chats().some((c) => c.id === first)).toBe(true);
    // a new chat works straight away
    await sendTurn(vi.fn(async () => reply({ text: 'Hello.' })), '2026-11-10', undefined, 'hi', none);
    expect(assistantStore.get().map((t) => t.text)).toEqual(['hi', 'Hello.']);
    // opened again from History, it stops the sheet again: gone
    assistantStore.open(first);
    assistantStore.reset();
    expect(assistantStore.chats().some((c) => c.id === first)).toBe(false);
    expect(assistantStore.get()).toEqual([]);
  });
});
