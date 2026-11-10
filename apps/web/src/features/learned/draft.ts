/**
 * The words in the Learned field, kept outside the component that shows them. Saving the day's first learning swaps the
 * hero for today's list, and a save that the server rejects must still find the field to give the words back to: so the
 * draft outlives any one render of the field (and can be tested without a DOM). Memory only; it goes with the page.
 */
export interface Draft {
  get: () => string;
  set: (text: string) => void;
  subscribe: (fn: () => void) => () => void;
}

export const createDraft = (): Draft => {
  let text = '';
  const subs = new Set<() => void>();
  return {
    get: () => text,
    set: (next) => {
      if (next === text) return;
      text = next;
      for (const f of subs) f();
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
};

/**
 * Save what is in the field. The field empties at once (the line is already in the list); if the save is rejected the
 * words go back in the field, ahead of anything typed since, and `onFail` runs (the toast). Returns false for an empty field.
 */
export const submitDraft = (draft: Draft, send: (text: string) => Promise<unknown>, onFail: () => void): boolean => {
  const words = draft.get().trim();
  if (!words) return false;
  draft.set('');
  send(words).catch(() => {
    const since = draft.get();
    draft.set(since.trim() ? `${words}\n${since}` : words);
    onFail();
  });
  return true;
};

/** Today's field on the Learned tab. */
export const todayDraft = createDraft();
