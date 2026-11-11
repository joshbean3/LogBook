import type { AssistantReply } from '@logbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatsFrom } from './store';
import { editTurn, regenerate, retryAsk, runAsk, sendTurn } from './conversation';
import { assistantStore } from './store';

/**
 * The pane's own chat (layout plan C-1): the plan summary hosts the assistant with a chat of its own, which must never move
 * the dock's open chat, must still show in History once it has a turn, and is found again by its plan block.
 */
const reply = (r: Partial<AssistantReply> = {}): AssistantReply => ({ text: 'Done.', proposal: null, available: true, ...r });
const none = { shown: undefined, data: [] };

beforeEach(() => {
  assistantStore.clear();
  assistantStore.setConsentNeeded(false);
});

describe("a pane's own chat", () => {
  it('asks and answers in its own chat, leaving the open chat alone', async () => {
    const open = assistantStore.currentId();
    const pane = assistantStore.newChat('blk_1');
    const ask = vi.fn(async () => reply());
    await sendTurn(ask, '2026-11-11', { tab: 'plan', plan: 'blk_1' }, 'Make week 3 easier', none, undefined, pane);
    expect(assistantStore.currentId()).toBe(open);
    expect(assistantStore.get()).toEqual([]);
    expect(assistantStore.turnsFor(pane).map((t) => t.text)).toEqual(['Make week 3 easier', 'Done.']);
    expect(ask).toHaveBeenCalledWith('2026-11-11', [{ role: 'user', text: 'Make week 3 easier' }], { tab: 'plan', plan: 'blk_1' }, expect.any(Object));
    // saved, so it shows in History, and it carries the block it was started for
    expect(assistantStore.chats().find((c) => c.id === pane)).toMatchObject({ plan: 'blk_1' });
  });

  it('is not saved until it has a turn, and an answer still lands in it', async () => {
    const pane = assistantStore.newChat('blk_2');
    expect(assistantStore.chats().some((c) => c.id === pane)).toBe(false);
    expect(assistantStore.turnsFor(pane)).toEqual([]);
    // the same empty list each time, so a screen reading it does not draw again for nothing
    expect(assistantStore.turnsFor(pane)).toBe(assistantStore.turnsFor(pane));
    assistantStore.pushTo(pane, { role: 'assistant', text: 'Hello' });
    expect(assistantStore.turnsFor(pane).map((t) => t.text)).toEqual(['Hello']);
  });

  it('finds the newest chat for a plan block', async () => {
    const ask = vi.fn(async () => reply());
    const older = assistantStore.newChat('blk_3');
    await sendTurn(ask, '2026-11-11', undefined, 'first', none, undefined, older);
    const newer = assistantStore.newChat('blk_3');
    await new Promise((r) => setTimeout(r, 2));
    await sendTurn(ask, '2026-11-11', undefined, 'second', none, undefined, newer);
    expect(assistantStore.chatForPlan('blk_3')).toBe(newer);
    expect(assistantStore.chatForPlan('blk_none')).toBeNull();
  });

  it('retries, regenerates and edits in its own chat', async () => {
    const pane = assistantStore.newChat();
    const ask = vi.fn<(...a: unknown[]) => Promise<AssistantReply>>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(reply());
    await sendTurn(ask, '2026-11-11', undefined, 'one', none, undefined, pane);
    expect(assistantStore.turnsFor(pane)[1]).toMatchObject({ error: true });
    await retryAsk(ask, '2026-11-11', undefined, undefined, pane);
    expect(assistantStore.turnsFor(pane).map((t) => t.text)).toEqual(['one', 'Done.']);
    await regenerate(ask, '2026-11-11', undefined, undefined, pane);
    expect(assistantStore.turnsFor(pane).map((t) => t.text)).toEqual(['one', 'Done.']);
    await editTurn(ask, '2026-11-11', undefined, 0, 'two', undefined, pane);
    expect(assistantStore.turnsFor(pane).map((t) => t.text)).toEqual(['two', 'Done.']);
    expect(assistantStore.get()).toEqual([]);
  });

  it('keeps one ask at a time across the dock and a pane', async () => {
    let finish!: (r: AssistantReply) => void;
    const slow = vi.fn(() => new Promise<AssistantReply>((r) => (finish = r)));
    const first = sendTurn(slow, '2026-11-11', undefined, 'dock question', none);
    const pane = assistantStore.newChat();
    const other = vi.fn(async () => reply());
    await runAsk(other, '2026-11-11', undefined, Date.now, undefined, pane);
    expect(other).not.toHaveBeenCalled();
    finish(reply());
    await first;
  });

  it('keeps the plan block through a reload (saved chats are read back with it)', () => {
    const [c] = chatsFrom([{ id: 'c1', title: 'Week 3', updatedAt: 1, turns: [{ role: 'user', text: 'hi' }], plan: 'blk_9' }]);
    expect(c).toMatchObject({ id: 'c1', plan: 'blk_9' });
    const [d] = chatsFrom([{ id: 'c2', title: 'x', updatedAt: 1, turns: [{ role: 'user', text: 'hi' }], plan: 42 }]);
    expect(d && 'plan' in d).toBe(false);
  });
});
