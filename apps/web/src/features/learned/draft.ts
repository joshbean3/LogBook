/**
 * The words in the Learned field, kept outside the component that shows them. Saving the day's line swaps the field for
 * the saved line, and a save that the server rejects must still find the field to give the words back to: so the draft
 * outlives any one render of the field (and can be tested without a DOM). Memory only; it goes with the page.
 *
 * A draft nobody has typed in is `untouched`: the field then shows its starter (starter.ts), which is not the person's
 * words yet. The first change makes it theirs, even a change that clears it.
 */
export interface Draft {
  get: () => string;
  set: (text: string) => void;
  /** Has the person changed the field since it was last reset? */
  touched: () => boolean;
  /** Back to empty and untouched (after a save): the field shows its starter again. */
  reset: () => void;
  subscribe: (fn: () => void) => () => void;
}

export const createDraft = (): Draft => {
  let text = '';
  let touched = false;
  const subs = new Set<() => void>();
  const tell = () => {
    for (const f of subs) f();
  };
  return {
    get: () => text,
    set: (next) => {
      if (next === text && touched) return;
      text = next;
      touched = true;
      tell();
    },
    touched: () => touched,
    reset: () => {
      if (!touched && text === '') return;
      text = '';
      touched = false;
      tell();
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
};

/**
 * Save what is in the field. The field resets at once (the line is already on the page); if the save is rejected the
 * words go back in the field, ahead of anything typed since, and `onFail` runs (the toast). Returns false for an empty field.
 */
export const submitDraft = (draft: Draft, send: (text: string) => Promise<unknown>, onFail: () => void): boolean => {
  const words = draft.get().trim();
  if (!words) return false;
  draft.reset();
  send(words).catch(() => {
    const since = draft.get();
    draft.set(since.trim() ? `${words}\n${since}` : words);
    onFail();
  });
  return true;
};

/** Today's field on the Learned tab. */
export const todayDraft = createDraft();
