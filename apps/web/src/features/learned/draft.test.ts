import { describe, expect, it, vi } from 'vitest';
import { createDraft, dropIfLanded, lineDay, submitDraft } from './draft';

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

describe('an untouched draft', () => {
  it('is untouched until the person changes it, and clearing the field counts as a change', () => {
    const draft = createDraft();
    expect(draft.touched()).toBe(false);
    draft.set('');
    expect(draft.touched()).toBe(true);
    expect(draft.get()).toBe('');
  });

  it('is untouched again after a save, and touched when a rejected save gives the words back', async () => {
    const draft = createDraft();
    draft.set('On the bike today I learned to start slow.');
    submitDraft(draft, () => Promise.reject(new Error('500')), () => undefined);
    expect(draft.touched()).toBe(false);
    await settle();
    expect(draft.touched()).toBe(true);
    expect(draft.get()).toBe('On the bike today I learned to start slow.');
    let told = 0;
    draft.subscribe(() => told++);
    draft.reset();
    draft.reset();
    expect(told).toBe(1);
  });
});

/** A stand-in for the device's storage: what `save` was last given, as `load` gives it back after a restart. */
const disk = () => {
  let kept: unknown = null;
  return { load: () => structuredClone(kept), save: (v: unknown) => void (kept = structuredClone(v)), peek: () => kept, put: (v: unknown) => void (kept = v) };
};
const NOW = Date.parse('2026-11-12T22:00:00Z');
const own = (t: string) => t.trim() !== '' && t.trim() !== 'Today I learned';

describe('a draft outlives the page', () => {
  it('comes back after the page is killed, with the day it was begun on', () => {
    const d = disk();
    const first = createDraft({ keep: d, worth: own, now: () => NOW });
    first.set('Today I learned that the tide comes twice a day', '2026-11-12');
    // the page dies; the next one reads the device
    const next = createDraft({ keep: d, worth: own, now: () => NOW + 60_000 });
    expect(next.get()).toBe('Today I learned that the tide comes twice a day');
    expect(next.touched()).toBe(true);
    expect(next.day()).toBe('2026-11-12');
    expect(next.unsure()).toBe(false);
  });

  it('keeps nothing for a field that holds only the starter, or nothing', () => {
    const d = disk();
    const draft = createDraft({ keep: d, worth: own, now: () => NOW });
    draft.set('Today I learned ', '2026-11-12');
    expect(d.peek()).toBeNull();
    draft.set('Today I learned x', '2026-11-12');
    expect(d.peek()).toMatchObject({ text: 'Today I learned x', day: '2026-11-12' });
    draft.set('');
    expect(d.peek()).toBeNull();
    expect(createDraft({ keep: d, worth: own, now: () => NOW }).touched()).toBe(false);
  });

  it('is gone from the device once the line is saved', async () => {
    const d = disk();
    const draft = createDraft({ keep: d, worth: own, now: () => NOW });
    draft.set('A line.', '2026-11-12');
    let done: () => void = () => undefined;
    submitDraft(draft, () => new Promise<void>((r) => (done = r)), () => undefined);
    // on the wire: the words are still on the device, marked as sent
    expect(d.peek()).toMatchObject({ text: 'A line.', day: '2026-11-12', sent: true });
    done();
    await settle();
    expect(d.peek()).toBeNull();
  });

  it('gives the words back when the page died with the save on the wire, until the line is seen in the list', async () => {
    const d = disk();
    const draft = createDraft({ keep: d, worth: own, now: () => NOW });
    draft.set('A line.', '2026-11-12');
    submitDraft(draft, () => new Promise<void>(() => undefined), () => undefined);
    const next = createDraft({ keep: d, worth: own, now: () => NOW + 5000 });
    expect(next.get()).toBe('A line.');
    expect(next.unsure()).toBe(true);
    // a provisional copy is not proof, and neither is the same words on another day
    expect(dropIfLanded(next, [{ id: 'tmp-abc', date: '2026-11-12', text: 'A line.' }])).toBe(false);
    expect(dropIfLanded(next, [{ id: 'l1', date: '2026-11-11', text: 'A line.' }])).toBe(false);
    expect(next.get()).toBe('A line.');
    // the server has it: the field is not offered the same words again
    expect(dropIfLanded(next, [{ id: 'l2', date: '2026-11-12', text: 'A line.' }])).toBe(true);
    expect(next.touched()).toBe(false);
    expect(d.peek()).toBeNull();
    // words the person has changed since are theirs: never dropped
    const again = createDraft({ keep: d, worth: own, now: () => NOW });
    again.set('A line, changed.', '2026-11-12');
    expect(dropIfLanded(again, [{ id: 'l2', date: '2026-11-12', text: 'A line, changed.' }])).toBe(false);
  });

  it('a rejected save puts the words back on the device too, under their day', async () => {
    const d = disk();
    const draft = createDraft({ keep: d, worth: own, now: () => NOW });
    draft.set('A line.', '2026-11-12');
    submitDraft(draft, () => Promise.reject(new Error('422')), () => undefined);
    await settle();
    expect(draft.day()).toBe('2026-11-12');
    expect(d.peek()).toMatchObject({ text: 'A line.', day: '2026-11-12' });
    expect((d.peek() as { sent?: boolean }).sent).toBeUndefined();
  });

  it('reads nothing from a copy that is old, in a bad shape, or that throws', () => {
    const bad: unknown[] = [undefined, 'words', 42, [], {}, { text: 7, at: NOW }, { text: '   ', at: NOW }, { text: 'x', at: 'now' }, { text: 'An old one.', day: '2026-10-01', at: NOW - 31 * 86_400_000 }];
    for (const v of bad) {
      const d = disk();
      d.put(v);
      const draft = createDraft({ keep: d, worth: own, now: () => NOW });
      expect(draft.touched()).toBe(false);
      expect(draft.get()).toBe('');
    }
    const d = disk();
    d.put({ text: 'x'.repeat(5000), day: 'someday', at: NOW });
    const long = createDraft({ keep: d, worth: own, now: () => NOW });
    expect(long.get()).toHaveLength(1000);
    expect(long.day()).toBeNull();
    const broken = createDraft({ keep: { load: () => { throw new Error('denied'); }, save: () => { throw new Error('full'); } }, worth: own, now: () => NOW });
    expect(broken.touched()).toBe(false);
    // typing still works when the device refuses to keep it
    broken.set('Still typing.', '2026-11-12');
    expect(broken.get()).toBe('Still typing.');
  });
});

describe('midnight with a line half written', () => {
  it('the page stays on the day the line was begun, one day at most; the line is that day’s', () => {
    // 23:58 on the 12th: words in the field; at midnight the clock says the 13th
    expect(lineDay('2026-11-13', '2026-11-12', true)).toBe('2026-11-12');
    // nothing of their own in the field: the page moves on
    expect(lineDay('2026-11-13', '2026-11-12', false)).toBe('2026-11-13');
    expect(lineDay('2026-11-13', null, true)).toBe('2026-11-13');
    // a draft left for days is today's line when it is finished
    expect(lineDay('2026-11-15', '2026-11-12', true)).toBe('2026-11-15');
    // the phone went back a day (a flight west): never a day that has not come
    expect(lineDay('2026-11-11', '2026-11-12', true)).toBe('2026-11-11');
    // across a month and a year
    expect(lineDay('2027-01-01', '2026-12-31', true)).toBe('2026-12-31');
    expect(lineDay('2028-03-01', '2028-02-29', true)).toBe('2028-02-29');
  });
});
