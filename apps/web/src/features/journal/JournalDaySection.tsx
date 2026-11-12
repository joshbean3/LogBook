import { ago, fmtDate, type JournalEntry } from '@logbook/shared';
import { Check, Pencil, Share, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useJournalList, whenShown } from '@/api/queries';
import { fitHeight } from '@/lib/fitHeight';
import { haptics } from '@/lib/haptics';
import { crossfade } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, Pressable, useSheet, useToast } from '@/ui';
import { getDraft, getEdit, holdSent, restoreDraft, SAVE_FAILED, setDraft, setEdit, subscribeDrafts } from './drafts';
import { FavStar } from './FavStar';
import { useDraftOwner, useJournalWrites, useLiveEntry } from './queries';
import { shareWords } from '../share/shareOut';
import { ENTRY_MAX } from './days';
import './journal.css';

/** The count of characters shows from here on (the limit is `ENTRY_MAX`). */
const COUNT_FROM = 4500;

/** A time of day on the device's own clock (12 or 24 hour, as the phone is set). */
export const timeOf = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const pad2 = (n: number) => String(n).padStart(2, '0');
/** The device's own date of an instant, `YYYY-MM-DD`. */
export const localDate = (at: string): string | null => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
/**
 * When an entry was written, as its rows say it: the time, or, for an entry written on another day than the one it is
 * for (a missed evening caught up later), the day it was added: `added Nov 10`.
 */
export const entryWhen = (e: Pick<JournalEntry, 'date' | 'createdAt'>): string => {
  const day = localDate(e.createdAt);
  if (!day) return '';
  return day === e.date ? timeOf(e.createdAt) : `added ${fmtDate('md', day)}`;
};
/** The first letter up: a meta line that opens with "added Nov 9" reads "Added Nov 9". */
export const upperFirst = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w);
/** An entry's day as a sheet names it: `Fri, Nov 6`, with the year when it is not this one. */
export const entryDay = (date: string, today: string) => `${fmtDate('short', date)}${date.slice(0, 4) === today.slice(0, 4) ? '' : `, ${date.slice(0, 4)}`}`;

/** Share words: the system share sheet (native in the app, the browser's elsewhere), else the clipboard, which says so. */
export const shareText = async (text: string, toast: (t: string) => void) => {
  try {
    if ((await shareWords(text)) === 'copied') toast('Copied');
  } catch {
    toast('Couldn’t share that.');
  }
};

/** The one place an entry is deleted, made a favorite or shared, so every surface (row, sheet, menu) behaves the same. */
export const useEntryActions = () => {
  const w = useJournalWrites();
  const toast = useToast();
  return {
    del: (e0: JournalEntry) => {
      // Undo puts back the same entry (its time, its favorite), under the server's id if its save has landed
      const e = w.current(e0);
      haptics.delete();
      void w.remove(e);
      toast('Deleted', { label: 'Undo', fn: () => void w.restore(e) });
    },
    /** The star that shows the change pops and fires `toggle` on its apex (`FavStar`); taking a favorite back is silent. */
    fav: (e: JournalEntry) => void w.patch({ entry: e, fav: !e.fav }),
    share: (e: JournalEntry) => void shareText(`${e.text}\n\n${fmtDate('long', e.date)}`, toast),
  };
};

/**
 * Edit, pushed inside the entry's sheet: the words, and Save as the sheet's one blue. The sheet stays until the edit is
 * saved or queued offline; a refused edit keeps the words in the field (and for the next time Edit is opened, should the
 * sheet have been closed meanwhile) and says so.
 */
export const EntryEditor = ({ e }: { e: JournalEntry }) => {
  const w = useJournalWrites();
  const sheet = useSheet();
  const toast = useToast();
  const [text, setText] = useState(() => getEdit(e.id) ?? e.text);
  const [busy, setBusy] = useState(false);
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);
  const v = text.trim();
  const save = () => {
    if (busy || !v) return;
    if (v === e.text) {
      setEdit(e.id, null);
      return sheet.pop();
    }
    setBusy(true);
    // an edit is not a day's close: no `success` (two a day, §11.4)
    void w.patch({ entry: e, text: v }).then((ok) => {
      setEdit(e.id, ok ? null : v);
      // still open: the words never left; closed meanwhile: they are back the next time Edit opens
      if (!ok) toast(here.current ? 'Couldn’t save that. Your words are still here.' : SAVE_FAILED);
      if (!here.current) return;
      if (ok) sheet.pop();
      else setBusy(false);
    });
  };
  return (
    <>
      <textarea
        className="jtext serif jsheet-text"
        rows={6}
        maxLength={5000}
        value={text}
        aria-label="Entry"
        autoFocus
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
            ev.preventDefault();
            save();
          }
        }}
      />
      <div className="sheet-foot">
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!v || v === e.text || busy} aria-busy={busy || undefined}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

/**
 * Behind a tap on an entry: the words to read (not a keyboard), with what the day held. Edit pushes the editor in the same
 * sheet; Favorite and Share act in place, 12 apart; Delete, alone at the end in Signal, closes it with an Undo.
 */
export const EntrySheet = ({ e: opened, stamp }: { e: JournalEntry; stamp?: string | null }) => {
  const e = useLiveEntry(opened.id, opened);
  const sheet = useSheet();
  const act = useEntryActions();
  return (
    <div className="esheet">
      <p className="esheet-text">{e.text}</p>
      <p className="esheet-meta">{[upperFirst(entryWhen(e)), stamp, e.editedAt ? 'edited' : null].filter(Boolean).join(' · ')}</p>
      <div className="esheet-actions">
        <Button onClick={() => sheet.push({ title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' })}>
          <Pencil size={16} aria-hidden="true" /> Edit
        </Button>
        <Button aria-pressed={e.fav} className={`esheet-fav ${e.fav ? 'is-fav' : ''}`} onClick={() => act.fav(e)}>
          <FavStar on={e.fav} size={16} always className="" /> Favorite
        </Button>
        <Button onClick={() => act.share(e)}>
          <Share size={16} aria-hidden="true" /> Share
        </Button>
      </div>
      <Button
        variant="danger"
        className="esheet-del"
        onClick={() => {
          sheet.close();
          act.del(e);
        }}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete
      </Button>
    </div>
  );
};

/** Open one entry's sheet; its title is the day (`from` is kept for callers; the title flyer is gone, contracts §C.1). */
export const useOpenEntry = () => {
  const sheet = useSheet();
  const today = useToday();
  return (e: JournalEntry, opts: { from?: Element | null; stamp?: string | null } = {}) =>
    sheet.open({
      eyebrow: ago(e.date, today),
      title: entryDay(e.date, today),
      body: <EntrySheet e={e} stamp={opts.stamp} />,
    });
};

/**
 * Save on a composer (docs/feel.md §8): a 32 px pill, the one blue, at 40 % until there is something to save (44 px hit).
 * It is the same element before and after, so the composer's foot never reflows.
 */
export const SaveButton = ({ ready, onClick, children = 'Save' }: { ready: boolean; onClick: () => void; children?: string }) => (
  <Pressable as="button" className={`save-pill ${ready ? 'is-ready' : ''}`} disabled={!ready} onPress={onClick} label={children}>
    {children}
  </Pressable>
);

export interface ComposerProps {
  /** The day the entry is written to. */
  date: string;
  today: string;
  /** Starting height in lines; the field grows with the words. */
  rows?: number;
  /** Built from the day, e.g. `useDayPrompt(date)`: "Speed 5 done, 5.02 mi. How did it feel?". */
  placeholder?: string;
  /** Between the words and Save: an optional prompt line (the day's `QuoteLine`). `insert` puts text at the top of the entry. */
  prompt?: (insert: (text: string) => void, text: string) => ReactNode;
  /** After a save, once the words have left the field. `first`: it was today's first entry (the day's close). */
  onSaved?: (o: { first: boolean }) => void;
  /**
   * `false`: the caller fires the first entry's `success` itself, on the frame its entry shows (the Close card, which draws
   * the entry in its own box; WP2 request 30). Default: the Composer fires it in Save.
   */
  haptic?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** VoiceOver name. Default "Journal entry". */
  label?: string;
  /** A quiet Cancel beside Save (a writer opened in place, which can be put away): the words stay in the day's draft. */
  onCancel?: () => void;
}

/** Put words on top of a day's unsaved draft (a quote to write from); every composer on that day picks them up (drafts.ts). */
export const addToDraft = (date: string, s: string) => {
  const cur = getDraft(date);
  setDraft(date, cur.trim() ? `${s}\n\n${cur}` : `${s}\n\n`);
};
/**
 * A bare textarea and Save: meant to sit in a card (or as the last row of a Group). Save is the one affordance; ⌘/Ctrl+Enter
 * also saves, unannounced. Saving: the words leave the field, Save turns into a check for a moment (a 150 ms crossfade in the
 * same box) and the entry settles into whatever list shows the day. The first entry of today is the day's close and fires
 * `success` (one of the two a day, §11.4); any later save is silent. No toast: the entry landing is the answer.
 */
export const Composer = ({ date, today, rows = 3, placeholder, prompt, onSaved, haptic = true, autoFocus, inputRef, label = 'Journal entry', onCancel }: ComposerProps) => {
  const w = useJournalWrites();
  useDraftOwner();
  const list = useJournalList('', false);
  const toast = useToast();
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? own;
  const [text, setText] = useState(() => getDraft(date));
  const [saved, setSaved] = useState(false);
  // one store (drafts.ts): the day's draft, also when another composer on the same day (Journal, the Close card) changes it
  useEffect(() => {
    setText(getDraft(date));
    return subscribeDrafts(() => {
      const v = getDraft(date);
      setText((cur) => (cur === v ? cur : v));
    });
  }, [date]);
  // the field grows with the words, never scrolls inside itself
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) fitHeight(el);
  }, [text, ref]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1400);
    return () => clearTimeout(t);
  }, [saved]);
  const set = (v: string) => {
    setText(v);
    setDraft(date, v);
  };
  const save = () => {
    const v = text.trim();
    if (!v) return;
    const first = date === today && !(list.data?.entries ?? []).some((e) => e.date === date);
    if (first && haptic) haptics.success();
    // the field empties in the commit that shows the entry in the list (one move of the page, not two)
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      set('');
      setSaved(true);
    };
    // the words stay on the device until the server or the outbox has them (drafts.ts)
    const release = holdSent(date, v);
    void w.add(whenShown({ date, text: v }, clear)).then((ok) => {
      if (ok) return release();
      // refused. The field must not empty over the words now; they go back on top of whatever has been typed since, once
      // the mutation cache's own listeners have run (Today's cards watch the save with journalGuard and may have put them
      // back already), and the toast says so
      const wasCleared = cleared;
      cleared = true;
      setTimeout(() => {
        if (restoreDraft(date, v) || !wasCleared) toast(SAVE_FAILED);
        release();
      }, 0);
    });
    // a list that is not mounted still clears the field
    setTimeout(clear, 250);
    onSaved?.({ first });
  };
  const insert = (s: string) => {
    const next = text.trim() ? `${s}\n\n${text}` : `${s}\n\n`;
    set(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const at = text.trim() ? s.length + 2 : next.length;
      el.setSelectionRange(at, at);
    });
  };
  const fallback = date === today ? 'Two sentences on the day.' : `Add an entry for ${fmtDate('short', date)}`;
  return (
    <div className="composer">
      <textarea
        ref={ref}
        className="jtext serif"
        rows={rows}
        maxLength={ENTRY_MAX}
        placeholder={placeholder ?? fallback}
        aria-label={label}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      {prompt ? prompt(insert, text) : null}
      <div className="composer-foot">
        {/* near the limit: how much of it is used */}
        {text.length >= COUNT_FROM ? (
          <span className="composer-count tnum" role="status">
            {text.length.toLocaleString('en-US')} of {ENTRY_MAX.toLocaleString('en-US')}
          </span>
        ) : null}
        {onCancel ? (
          <Button variant="quiet" size="sm" className="composer-cancel" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <AnimatePresence mode="popLayout" initial={false}>
          {saved && !text.trim() ? (
            <motion.span key="saved" className="composer-saved" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: crossfade }} exit={{ opacity: 0, transition: crossfade }}>
              <Check size={16} strokeWidth={2.6} aria-hidden="true" /> Saved
            </motion.span>
          ) : (
            <motion.span key="save" className="composer-save" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: crossfade }} exit={{ opacity: 0, transition: crossfade }}>
              <SaveButton ready={!!text.trim()} onClick={save} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
