import { fmtDate, type JournalEntry } from '@logbook/shared';
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useJournalList, useJournalMutations, whenShown } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade } from '@/lib/motion';
import { Button, Pressable, useSheet, useToast } from '@/ui';
import { getDraft, setDraft, subscribeDrafts } from './drafts';
import './journal.css';

/*
 * The composer and the entry actions: shared by the Journal's day sheet and Today (`features/day/CloseDay.tsx` and
 * `TheDayCard.tsx` import `Composer` and `addToDraft` from here, so the file keeps its name).
 */

export const timeOf = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/** Share words: the system share sheet where there is one, else the clipboard. */
export const shareText = async (text: string, toast: (t: string) => void) => {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    toast('Couldn’t share that.');
  }
};

/** The one place an entry is deleted, favourited or shared, so every surface behaves the same. Delete carries Undo. */
export const useEntryActions = () => {
  const { patch, remove, restore } = useJournalMutations();
  const toast = useToast();
  return {
    del: (e: JournalEntry) => {
      haptics.delete();
      remove.mutate(e);
      toast('Deleted', { label: 'Undo', fn: () => restore.mutate(e) });
    },
    fav: (e: JournalEntry) => patch.mutate({ entry: e, fav: !e.fav }),
    share: (e: JournalEntry) => void shareText(`${e.text}\n\n${fmtDate('long', e.date)}`, toast),
  };
};

/** The entry as the cache knows it now (an edit made in the sheet), falling back to what opened the sheet. */
const useLiveEntry = (id: string, fallback: JournalEntry) => {
  const list = useJournalList('', false);
  return list.data?.entries.find((x) => x.id === id) ?? fallback;
};

/** The words of one entry, editable: the serif field, Save when they changed, Delete with Undo. */
export const EntryEditor = ({ e: opened, onDone }: { e: JournalEntry; onDone?: () => void }) => {
  const e = useLiveEntry(opened.id, opened);
  const { patch } = useJournalMutations();
  const act = useEntryActions();
  const [text, setText] = useState(e.text);
  const v = text.trim();
  const changed = !!v && v !== e.text;
  const save = () => {
    if (changed) patch.mutate({ entry: e, text: v });
    onDone?.();
  };
  return (
    <div className="jeditor">
      <textarea
        className="jtext serif"
        rows={4}
        maxLength={5000}
        value={text}
        aria-label="Entry"
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
            ev.preventDefault();
            save();
          }
        }}
      />
      <div className="jeditor-foot">
        <Button
          variant="quiet"
          className="jeditor-del"
          onClick={() => {
            onDone?.();
            act.del(e);
          }}
        >
          Delete
        </Button>
        <Button variant="primary" onClick={save} disabled={!changed}>
          Save
        </Button>
      </div>
    </div>
  );
};

/** One entry pushed inside a sheet (a day with several): its words to edit, with Delete. */
export const EntrySheet = ({ e }: { e: JournalEntry }) => {
  const sheet = useSheet();
  return <EntryEditor e={e} onDone={() => sheet.pop()} />;
};

/** Save on a composer: a 32 px pill, the one blue, at 40 % until there is something to save (44 px hit). */
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
  /** `lg`: the writing voice at 22/28. */
  size?: 'lg';
  /** Built from the day, e.g. `useDayPrompt(date)`: "Speed 5 done, 5.02 mi. How did it feel?". */
  placeholder?: string;
  /** Between the words and Save: an optional prompt line (the day's `QuoteLine`). `insert` puts text at the top of the entry. */
  prompt?: (insert: (text: string) => void, text: string) => ReactNode;
  /** After a save, once the words have left the field. `first`: it was today's first entry (the day's close). */
  onSaved?: (o: { first: boolean }) => void;
  /** `false`: the caller fires the first entry's `success` itself. Default: the Composer fires it in Save. */
  haptic?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** VoiceOver name. Default "Journal entry". */
  label?: string;
}

/** Put words on top of a day's unsaved draft (a quote to write from); every composer on that day picks them up (drafts.ts). */
export const addToDraft = (date: string, s: string) => {
  const cur = getDraft(date);
  setDraft(date, cur.trim() ? `${s}\n\n${cur}` : `${s}\n\n`);
};

/**
 * A bare textarea and Save. ⌘/Ctrl+Enter also saves. Saving: the words leave the field, Save turns into a check for a moment
 * and the entry settles into whatever list shows the day. The first entry of today is the day's close and fires `success`;
 * any later save is silent. No toast: the entry landing is the answer.
 */
export const Composer = ({ date, today, rows = 3, size, placeholder, prompt, onSaved, haptic = true, autoFocus, inputRef, label = 'Journal entry' }: ComposerProps) => {
  const { add } = useJournalMutations();
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
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
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
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      set('');
      setSaved(true);
    };
    add.mutate(whenShown({ date, text: v }, clear), { onError: () => (clear(), set(v), toast('Couldn’t save that. Your words are back in the field.')) });
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
    <div className={`composer ${size === 'lg' ? 'big' : ''}`}>
      <textarea
        ref={ref}
        className="jtext serif"
        rows={rows}
        maxLength={5000}
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
