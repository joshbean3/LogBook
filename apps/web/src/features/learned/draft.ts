import { isISODate, LEARNING_MAX, shiftDays } from '@logbook/shared';
import { isStarterOnly } from './starter';

/**
 * The words in the Learned field, kept outside the component that shows them. Saving the day's line swaps the field for
 * the saved line, and a save that the server rejects must still find the field to give the words back to: so the draft
 * outlives any one render of the field (and can be tested without a DOM).
 *
 * It outlives the page too. The words are written to the device as they are typed (`keep`), with the day they were begun
 * on, so a reload or a WebView killed in the background brings them back. Words that were sent stay on the device, marked
 * `sent`, until the save has settled: if the page dies with a save on the wire, the next one gives them back, and lets
 * them go only once the list shows that line (`dropIfLanded`).
 *
 * A draft nobody has typed in is `untouched`: the field then shows its starter (starter.ts), which is not the person's
 * words yet. The first change makes it theirs, even a change that clears it.
 */
export interface Draft {
  get: () => string;
  /** `day`: the day the page stands on, remembered from the first change on. */
  set: (text: string, day?: string | null) => void;
  /** Has the person changed the field since it was last reset? */
  touched: () => boolean;
  /** The day the words were begun on; null when untouched (or not told). */
  day: () => string | null;
  /** The words came back from a save that was on the wire when the page went away: it may have landed. */
  unsure: () => boolean;
  /** Back to empty and untouched (after a save): the field shows its starter again. */
  reset: () => void;
  /** Words on their way to the server stay on the device until the returned function is called. */
  hold: (words: string, day: string | null) => () => void;
  subscribe: (fn: () => void) => () => void;
}

/** What the device keeps of the field. */
export interface KeptDraft {
  text: string;
  day: string | null;
  /** When it was written (ms). */
  at: number;
  /** These words were sent and the save had not settled. */
  sent?: true;
}
/** Where a draft is kept between pages. Both may throw (storage that is full or refused): the draft then lives in memory. */
export interface DraftKeep {
  load: () => unknown;
  save: (v: KeptDraft | null) => void;
}
export interface DraftOptions {
  keep?: DraftKeep;
  /** Is this text worth keeping (more than nothing, more than a starter)? Default: anything but blank. */
  worth?: (text: string) => boolean;
  now?: () => number;
}

/** A draft untouched this long is not brought back. */
const MAX_AGE_MS = 30 * 86_400_000;

/** A kept draft as far as it can be trusted: words, a real day or none, a time not too long ago. Null for anything else. */
const readKept = (v: unknown, now: number): KeptDraft | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.text !== 'string' || !o.text.trim()) return null;
  if (typeof o.at !== 'number' || !Number.isFinite(o.at) || now - o.at > MAX_AGE_MS) return null;
  return { text: o.text.slice(0, LEARNING_MAX), day: isISODate(o.day) ? o.day : null, at: o.at, ...(o.sent === true ? { sent: true as const } : {}) };
};

export const createDraft = (opts: DraftOptions = {}): Draft => {
  const { keep, worth = (t: string) => t.trim() !== '', now = Date.now } = opts;
  let text = '';
  let touched = false;
  let day: string | null = null;
  let unsure = false;
  /** Words on the wire. */
  let held: KeptDraft | null = null;
  try {
    const k = keep ? readKept(keep.load(), now()) : null;
    if (k) {
      text = k.text;
      touched = true;
      day = k.day;
      unsure = k.sent === true;
    }
  } catch {
    /* the device would not say: start empty */
  }
  const subs = new Set<() => void>();
  const tell = () => {
    for (const f of subs) f();
  };
  const persist = () => {
    try {
      keep?.save(touched && worth(text) ? { text, day, at: now(), ...(unsure ? { sent: true as const } : {}) } : held);
    } catch {
      /* storage is full or refused: the words stay in memory */
    }
  };
  return {
    get: () => text,
    set: (next, d) => {
      if (next === text && touched) return;
      text = next;
      if (day === null) day = d ?? null;
      touched = true;
      unsure = false;
      persist();
      tell();
    },
    touched: () => touched,
    day: () => day,
    unsure: () => unsure,
    reset: () => {
      if (!touched && text === '') return;
      text = '';
      touched = false;
      day = null;
      unsure = false;
      persist();
      tell();
    },
    hold: (words, d) => {
      const mine: KeptDraft = { text: words, day: d, at: now(), sent: true };
      held = mine;
      persist();
      return () => {
        if (held !== mine) return;
        held = null;
        persist();
      };
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
};

/**
 * Save what is in the field. The field resets at once (the line is already on the page); if the save is rejected the
 * words go back in the field, ahead of anything typed since, and `onFail` runs (the toast). Until the save settles (the
 * server answered, or the write is queued on the device) the words stay on the device too. Returns false for an empty field.
 */
export const submitDraft = (draft: Draft, send: (text: string) => Promise<unknown>, onFail: () => void): boolean => {
  const words = draft.get().trim();
  if (!words) return false;
  const day = draft.day();
  draft.reset();
  const release = draft.hold(words, day);
  send(words).then(release, () => {
    const since = draft.get();
    draft.set(since.trim() ? `${words}\n${since}` : words, day);
    release();
    onFail();
  });
  return true;
};

/**
 * After a restart with a save that was on the wire: once the list shows that line (the server's own, never a provisional
 * copy; on the draft's day), the words are let go. True when it did. Words the person has changed since are never dropped.
 */
export const dropIfLanded = (draft: Draft, rows: ReadonlyArray<{ id: string; date: string; text: string }>): boolean => {
  if (!draft.unsure()) return false;
  const words = draft.get().trim();
  const day = draft.day();
  if (!rows.some((l) => !l.id.startsWith('tmp-') && l.text === words && (day === null || l.date === day))) return false;
  draft.reset();
  return true;
};

/**
 * The day the page stands on. It is the clock's day, except in the hours after midnight while a line begun the evening
 * before is still in the field: then it stays that evening (the lights, the date, and the day the line is saved under),
 * as Today holds its day for a journal draft (docs/feel.md §5.4). One day back at most, and never a day still to come.
 */
export const lineDay = (live: string, draftDay: string | null, own: boolean): string => (own && draftDay !== null && draftDay === shiftDays(live, -1) ? draftDay : live);

/** One `logbook.` key in localStorage (the account's wipe clears it, lib/account.ts). */
export const DRAFT_KEY = 'logbook.learned.draft.v1';
const localKeep: DraftKeep = {
  load: () => {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  },
  save: (v) => {
    if (typeof localStorage === 'undefined') return;
    if (v) localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
    else localStorage.removeItem(DRAFT_KEY);
  },
};

/** Today's field on the Learned tab. */
export const todayDraft = createDraft({ keep: localKeep, worth: (t) => !isStarterOnly(t) });
