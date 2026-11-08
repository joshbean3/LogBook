import type { AssistantReply } from '@logbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/api/client';
import { regenerate, retryAsk, runAsk, sendTurn, stopAsk } from './conversation';
import { AskError } from './poll';
import { assistantStore } from './store';

const reply = (r: Partial<AssistantReply> = {}): AssistantReply => ({ text: 'Two runs left.', proposal: null, available: true, ...r });
const none = { shown: undefined, data: [] };

beforeEach(() => assistantStore.clear());

describe('a conversation with the assistant', () => {
  it('sends the turns and the screen, and keeps the suggested replies with the answer (three at most)', async () => {
    const ask = vi.fn(async () => reply({ replies: ['Move Thursday', 'And next week?', 'Shorter long run', 'Extra'] }));
    await sendTurn(ask, '2026-11-08', { tab: 'plan', week: '2026-11-09' }, 'What is left?', none);
    expect(ask).toHaveBeenCalledWith('2026-11-08', [{ role: 'user', text: 'What is left?' }], { tab: 'plan', week: '2026-11-09' }, { onJob: expect.any(Function), onProgress: expect.any(Function) });
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

  it('asks once at a time, and drops an answer for a conversation cleared meanwhile', async () => {
    let finish!: (r: AssistantReply) => void;
    const ask = vi.fn(() => new Promise<AssistantReply>((r) => (finish = r)));
    const first = sendTurn(ask, '2026-11-08', undefined, 'one', none);
    await runAsk(ask, '2026-11-08', undefined);
    expect(ask).toHaveBeenCalledTimes(1);
    assistantStore.clear();
    finish(reply());
    await first;
    expect(assistantStore.get()).toEqual([]);
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
  });

  it('Ask again takes the last answer off and sends the same question', async () => {
    const ask = vi.fn(async () => reply()).mockResolvedValueOnce(reply({ text: 'First try.' }));
    await sendTurn(ask, '2026-11-08', undefined, 'What is left?', none);
    await regenerate(ask, '2026-11-08', undefined);
    expect((ask.mock.calls[1] as unknown[])[1]).toEqual([{ role: 'user', text: 'What is left?' }]);
    expect(assistantStore.get().map((t) => t.text)).toEqual(['What is left?', 'Two runs left.']);
  });
});
