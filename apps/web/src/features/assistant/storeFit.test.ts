import { describe, expect, it } from 'vitest';
import { fitChats, slimmed, type AssistantChat } from './store';

const chat = (id: string, updatedAt: number, big = 0): AssistantChat => ({
  id,
  title: id,
  updatedAt,
  turns: [
    { role: 'user', text: 'Read this', files: [{ name: 'plan.jpg', mediaType: 'image/jpeg', thumb: `data:image/jpeg;base64,${'A'.repeat(big)}` }] },
    { role: 'assistant', text: 'Done.', thoughts: 'x'.repeat(big) },
  ],
});

describe('saving chats when the phone is full', () => {
  it('saves whole when it fits', () => {
    const list = [chat('a', 2), chat('b', 1)];
    expect(fitChats(list, 'a', () => 'ok')).toEqual({ ok: true, list });
  });
  it('first drops reasoning and photo previews from older chats, then the oldest chats; the open one is kept', () => {
    const list = [chat('open', 1, 1000), chat('new', 3, 1000), chat('old', 2, 1000)];
    // room for the open chat whole plus slimmed others
    const roomy = fitChats(list, 'open', (json) => (json.length < 3000 ? 'ok' : 'full'));
    expect(roomy.ok).toBe(true);
    expect(roomy.list.map((c) => c.id)).toEqual(['open', 'new', 'old']);
    expect(roomy.list[0]).toEqual(list[0]);
    expect(roomy.list[1]!.turns[1]!.thoughts).toBeUndefined();
    expect(roomy.list[1]!.turns[0]!.files![0]!.thumb).toBeUndefined();
    expect(roomy.list[1]!.turns[0]!.files![0]!.name).toBe('plan.jpg');
    // less room: the oldest other chat goes first
    const tight = fitChats(list, 'open', (json) => (json.length < JSON.stringify([list[0], slimmed(list[1]!)]).length + 1 ? 'ok' : 'full'));
    expect(tight.list.map((c) => c.id)).toEqual(['open', 'new']);
  });
  it('says so when even the open chat alone does not fit', () => {
    const r = fitChats([chat('open', 1, 10), chat('b', 2)], 'open', () => 'full');
    expect(r.ok).toBe(false);
  });
  it('trims nothing when storage is closed (private mode): the chats stay in memory', () => {
    const list = [chat('open', 1, 10), chat('b', 2, 10)];
    expect(fitChats(list, 'open', () => 'closed')).toEqual({ ok: true, list });
  });
});
