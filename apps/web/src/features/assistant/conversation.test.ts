import type { AssistantReply } from '@logbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/api/client';
import { retryAsk, runAsk, sendTurn } from './conversation';
import { assistantStore } from './store';

const reply = (r: Partial<AssistantReply> = {}): AssistantReply => ({ text: 'Two runs left.', proposal: null, available: true, ...r });
const none = { shown: undefined, data: [] };

beforeEach(() => assistantStore.clear());

describe('a conversation with the assistant', () => {
  it('sends the turns and the screen, and keeps the suggested replies with the answer (three at most)', async () => {
    const ask = vi.fn(async () => reply({ replies: ['Move Thursday', 'And next week?', 'Shorter long run', 'Extra'] }));
    await sendTurn(ask, '2026-11-08', { tab: 'plan', week: '2026-11-09' }, 'What is left?', none);
    expect(ask).toHaveBeenCalledWith('2026-11-08', [{ role: 'user', text: 'What is left?' }], { tab: 'plan', week: '2026-11-09' });
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
});
