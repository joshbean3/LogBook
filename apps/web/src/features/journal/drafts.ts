import { del, get, set } from 'idb-keyval';

/**
 * The unsaved journal drafts, one per day (contracts §F, docs/feel.md §5.4). A tiny module store: the `Composer` and the
 * Journal's day writer read and write it, `addToDraft` puts a quote on top of a day's draft, and Today's midnight rule asks
 * `hasDraft(shownDate)` (and re-asks on `subscribeDrafts`) so the page never rolls past words that are still being written.
 *
 * The drafts are kept on the device (idb-keyval, one `logbook.` key, written 400 ms after the last change and when the app
 * goes to the background), so a reload or a WebView that was killed in the background brings the words back. They belong
 * to one account: nothing is read into the store or written out until `claimDrafts(userId)` has said whose they are, and a
 * record left by someone else is deleted unread. A draft untouched for 30 days is dropped.
 *
 * Words that were sent (`holdSent`) stay in the record until the save is confirmed or queued offline. If the app dies with
 * a save on the wire, the next start asks `landed` whether the entry exists, and puts the words back in the draft if not.
 */
const drafts = new Map<string, string>();
/** The words of saves still on the wire, per day. */
const sent = new Map<string, string[]>();
/** When each day's draft last changed (ms). */
const touched = new Map<string, number>();
const listeners = new Set<() => void>();

export const DRAFTS_KEY = 'logbook.journal.drafts.v1';
const MAX_AGE_MS = 30 * 86_400_000;
const WRITE_MS = 400;

interface Stored {
  uid: string;
  days: Record<string, { t?: string; s?: string[]; at: number }>;
}

const tell = () => {
  for (const cb of [...listeners]) cb();
};

/** The day's unsaved words ('' when none). */
export const getDraft = (date: string): string => drafts.get(date) ?? '';

/** True when the day's draft has something in it after trimming. */
export const hasDraft = (date: string): boolean => getDraft(date).trim().length > 0;

// ---------- the copy on the device ----------
let owner: string | null = null;
let disk: Stored | null | undefined; // undefined: not read yet
let merged = false;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const snapshot = (): Stored => {
  const days: Stored['days'] = {};
  for (const [d, t] of drafts) if (t) days[d] = { t, at: touched.get(d) ?? Date.now() };
  for (const [d, s] of sent) if (s.length) days[d] = { ...(days[d] ?? { at: Date.now() }), s: [...s] };
  return { uid: owner!, days };
};

const flush = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  // nothing is written before the store knows whose words these are and has read what was there
  if (!dirty || !owner || !merged) return;
  dirty = false;
  const snap = snapshot();
  void (Object.keys(snap.days).length ? set(DRAFTS_KEY, snap) : del(DRAFTS_KEY)).catch(() => undefined);
};

const queueWrite = (now = false) => {
  dirty = true;
  if (now) return flush();
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, WRITE_MS);
};

/** Replaces the day's draft and tells every subscriber (an empty text removes it). */
export const setDraft = (date: string, text: string): void => {
  if (getDraft(date) === text) return;
  if (text) drafts.set(date, text);
  else drafts.delete(date);
  touched.set(date, Date.now());
  queueWrite();
  tell();
};

/**
 * Words a save the server refused go back on top of the day's draft, unless they are already in it. True when it put
 * them back.
 */
export const restoreDraft = (date: string, text: string): boolean => {
  const cur = getDraft(date);
  if (cur.includes(text)) return false;
  setDraft(date, cur.trim() ? `${text}\n\n${cur}` : text);
  return true;
};

/**
 * Save was pressed: the words stay on the device until the save is confirmed or queued offline. Call the returned
 * function once the save has settled either way (a refused save puts its words back with `restoreDraft` first).
 */
export const holdSent = (date: string, text: string): (() => void) => {
  sent.set(date, [...(sent.get(date) ?? []), text]);
  queueWrite(true);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const left = [...(sent.get(date) ?? [])];
    const i = left.indexOf(text);
    if (i >= 0) left.splice(i, 1);
    if (left.length) sent.set(date, left);
    else sent.delete(date);
    queueWrite(true);
  };
};

/** What every writer says when a save is refused. */
export const SAVE_FAILED = 'Couldn’t save that. Your words are back.';

// ---------- an edit the server refused ----------
/** The words of an edit that did not save, by entry id, so the editor opens on them again. Memory only. */
const edits = new Map<string, string>();
export const getEdit = (id: string): string | null => edits.get(id) ?? null;
export const setEdit = (id: string, text: string | null): void => {
  if (text === null) edits.delete(id);
  else edits.set(id, text);
};

/** Is there an entry on `date` with exactly these words? Null when it cannot be known now (offline). */
type Landed = (date: string, text: string) => Promise<boolean | null>;

const merge = (landed: Landed) => {
  if (merged || disk === undefined || !owner) return;
  merged = true;
  const mine = disk && disk.uid === owner ? disk : null;
  if (disk && !mine) {
    // someone else's words: gone, unread
    dirty = true;
  }
  disk = null;
  if (!mine) return flush();
  const now = Date.now();
  let changed = false;
  for (const [date, rec] of Object.entries(mine.days ?? {})) {
    if (!rec || typeof rec.at !== 'number' || now - rec.at > MAX_AGE_MS) {
      dirty = true;
      continue;
    }
    // what was typed since the app opened stays on top of what was kept
    if (typeof rec.t === 'string' && rec.t && !drafts.has(date)) {
      drafts.set(date, rec.t);
      touched.set(date, rec.at);
      changed = true;
    }
    for (const words of Array.isArray(rec.s) ? rec.s : []) {
      if (typeof words !== 'string' || !words) continue;
      // a save that was on the wire when the app went away: held until it is known whether the entry is there, then
      // back in the draft unless it is
      const release = holdSent(date, words);
      void landed(date, words)
        .catch(() => null)
        .then((there) => {
          if (there !== true) restoreDraft(date, words);
          release();
        });
    }
  }
  if (changed) tell();
  flush();
};

let reading: Promise<void> | null = null;
const read = (landed: Landed) => {
  reading ??= get<Stored>(DRAFTS_KEY)
    .then((v) => {
      disk = v && typeof v === 'object' && typeof v.uid === 'string' ? v : null;
    })
    .catch(() => {
      disk = null;
    });
  void reading.then(() => merge(landed));
};

/**
 * Says whose drafts these are (the signed-in account) and brings back what the device kept for them. Called by every
 * surface that writes (the Composer, the Journal); calls after the first with the same account do nothing.
 */
export const claimDrafts = (userId: string, landed: Landed): void => {
  if (owner === userId) return;
  if (owner) {
    // another account in the same page (the shell reloads on a change of account; this is the belt to that)
    drafts.clear();
    sent.clear();
    touched.clear();
    edits.clear();
    merged = false;
    reading = null;
    disk = undefined;
    tell();
  }
  owner = userId;
  read(landed);
};

if (typeof document !== 'undefined') {
  // the app going to the background is when a WebView gets killed: write now, not in 400 ms
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Called after any draft changes; returns the unsubscribe. */
export const subscribeDrafts = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Tests: an empty store that has not been claimed or read. */
export const resetDraftsForTest = () => {
  drafts.clear();
  sent.clear();
  touched.clear();
  edits.clear();
  listeners.clear();
  owner = null;
  disk = undefined;
  merged = false;
  dirty = false;
  reading = null;
  if (timer) clearTimeout(timer);
  timer = null;
};

// test builds only (VITE_FAKE_CLOCK, DEV): the store's own functions on window, so the acceptance scripts can read the one
// store the Journal composer and the Close card share (build plan §7.4 #10c). Statically false in a normal build.
if ((import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK) && typeof window !== 'undefined') {
  (window as unknown as { __drafts: unknown }).__drafts = { hasDraft, getDraft, setDraft, subscribeDrafts };
}
