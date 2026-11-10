import { describe, expect, it, vi } from 'vitest';
import { createDraft, submitDraft } from './draft';

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the Learned field', () => {
  it('empties when the words are sent, and stays empty once they are saved', async () => {
    const draft = createDraft();
    const seen: string[] = [];
    draft.subscribe(() => seen.push(draft.get()));
    draft.set('  Strides keep my legs quick.  ');
    const send = vi.fn(async () => undefined);
    const fail = vi.fn();
    expect(submitDraft(draft, send, fail)).toBe(true);
    expect(send).toHaveBeenCalledWith('Strides keep my legs quick.');
    expect(draft.get()).toBe('');
    await settle();
    expect(draft.get()).toBe('');
    expect(fail).not.toHaveBeenCalled();
    expect(seen).toEqual(['  Strides keep my legs quick.  ', '']);
  });

  it('gives the words back and says so when the first save of the day is rejected', async () => {
    const draft = createDraft();
    draft.set('Strides keep my legs quick.');
    const fail = vi.fn();
    submitDraft(draft, () => Promise.reject(new Error('500')), fail);
    // the field is empty while the line shows in the list: the hero has been swapped for today's list by now
    expect(draft.get()).toBe('');
    await settle();
    // the list is empty again and the hero is back; the words are in the draft whichever field is on screen
    expect(draft.get()).toBe('Strides keep my legs quick.');
    expect(fail).toHaveBeenCalledTimes(1);
  });

  it('keeps what was typed after a save that is then rejected', async () => {
    const draft = createDraft();
    draft.set('First thing.');
    let reject: (e: Error) => void = () => undefined;
    submitDraft(draft, () => new Promise((_, r) => (reject = r)), () => undefined);
    draft.set('Second thing, typed while the first was saving.');
    reject(new Error('500'));
    await settle();
    expect(draft.get()).toBe('First thing.\nSecond thing, typed while the first was saving.');
  });

  it('sends nothing for an empty field', () => {
    const draft = createDraft();
    draft.set('   ');
    const send = vi.fn(async () => undefined);
    expect(submitDraft(draft, send, () => undefined)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
