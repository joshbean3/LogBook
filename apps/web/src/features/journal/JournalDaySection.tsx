import { ago, fmtDate, monthOf, type JournalEntry } from '@logbook/shared';
import { Check, Pencil, Share, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useJournalList, useJournalMutations, whenShown } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, Group, Pressable, Section, SwipeRow, useSheet, useToast } from '@/ui';
import type { Log } from '../log/useLog';
import { getDraft, setDraft, subscribeDrafts } from './drafts';
import { FavStar } from './FavStar';
import { PressButton } from './PressButton';
import { below, carry, carryScaleY } from './feel';
import { runStamp, useDayPrompt } from './prompt';
import './journal.css';

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
    // the clipboard is the answer itself (no plain toast, §8): only a failure speaks
    await navigator.clipboard.writeText(text);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    toast('Couldn’t share that.');
  }
};

/** The one place an entry is deleted, favourited or shared, so every surface (row, sheet, menu) behaves the same. */
export const useEntryActions = () => {
  const { patch, remove, restore } = useJournalMutations();
  const toast = useToast();
  return {
    del: (e: JournalEntry) => {
      haptics.delete();
      remove.mutate(e);
      toast('Deleted', { label: 'Undo', fn: () => restore.mutate(e) });
    },
    /** The star that shows the change pops and fires `toggle` on its apex (`FavStar`); un-favouriting is silent. */
    fav: (e: JournalEntry) => patch.mutate({ entry: e, fav: !e.fav }),
    share: (e: JournalEntry) => void shareText(`${e.text}\n\n${fmtDate('long', e.date)}`, toast),
  };
};

/** The entry as the cache knows it now (a favourite, an edit made in the sheet), falling back to what opened the sheet. */
const useLiveEntry = (id: string, fallback: JournalEntry) => {
  const list = useJournalList('', false);
  return list.data?.entries.find((x) => x.id === id) ?? fallback;
};

/** Edit, pushed inside the entry's sheet: the words, and Save as the sheet's one blue. */
export const EntryEditor = ({ e }: { e: JournalEntry }) => {
  const { patch } = useJournalMutations();
  const sheet = useSheet();
  const [text, setText] = useState(e.text);
  const v = text.trim();
  const save = () => {
    // an edit is not a day's close: no `success` (two a day, §11.4)
    if (v && v !== e.text) patch.mutate({ entry: e, text: v });
    sheet.pop();
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
          <Button variant="primary" onClick={save} disabled={!v || v === e.text}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

/**
 * Behind a tap on an entry: the words to read (not a keyboard), with what the day held. Edit pushes the editor in the same
 * sheet; Favourite and Share act in place; Delete closes it with an Undo.
 */
export const EntrySheet = ({ e: opened, stamp }: { e: JournalEntry; stamp?: string | null }) => {
  const e = useLiveEntry(opened.id, opened);
  const sheet = useSheet();
  const act = useEntryActions();
  return (
    <div className="esheet">
      <p className="esheet-text">{e.text}</p>
      <p className="esheet-meta">
        <span className="caps">
          {timeOf(e.createdAt)}
          {e.editedAt ? ' · edited' : ''}
        </span>
        {stamp ? <span className="jstamp">{stamp}</span> : null}
      </p>
      <div className="esheet-actions">
        <Button onClick={() => sheet.push({ title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' })}>
          <Pencil size={16} aria-hidden="true" /> Edit
        </Button>
        <Button aria-pressed={e.fav} className={e.fav ? 'is-fav' : ''} onClick={() => act.fav(e)}>
          <FavStar on={e.fav} size={16} always className="" /> {e.fav ? 'Favourited' : 'Favourite'}
        </Button>
        <Button onClick={() => act.share(e)}>
          <Share size={16} aria-hidden="true" /> Share
        </Button>
        <Button
          variant="quiet"
          className="danger-quiet"
          onClick={() => {
            sheet.close();
            act.del(e);
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Delete
        </Button>
      </div>
    </div>
  );
};

/** A day with several entries: each one as serif words; a tap pushes it. */
const DayList = ({ date, stamp }: { date: string; stamp?: string | null }) => {
  const list = useJournalList('', false);
  const sheet = useSheet();
  const entries = (list.data?.entries ?? []).filter((x) => x.date === date);
  return (
    <div className="dsheet">
      {stamp ? <span className="jstamp">{stamp}</span> : null}
      <div className="list-edge dsheet-list">
        {entries.map((e) => (
          <PressButton key={e.id} className="dsheet-row" onClick={() => sheet.push({ title: timeOf(e.createdAt), body: <EntrySheet e={e} stamp={stamp} /> })}>
            <span className="caps">{timeOf(e.createdAt)}</span>
            <span className="dsheet-text">{e.text}</span>
          </PressButton>
        ))}
      </div>
      <Group className="dsheet-add">
        <Composer date={date} today={useToday()} rows={2} toast={false} placeholder="Add to this day" />
      </Group>
    </div>
  );
};

/** A day nothing was written on: the composer for it, so a missed evening can be caught up from the ribbon. */
const DayComposer = ({ date }: { date: string }) => {
  const sheet = useSheet();
  const placeholder = useDayPrompt(date);
  return (
    <Group className="dsheet-add">
      <Composer date={date} today={useToday()} rows={4} toast={false} placeholder={placeholder} autoFocus onSaved={() => setTimeout(() => sheet.close(), 450)} />
    </Group>
  );
};

/** Open one entry's sheet; its title is the day (`from` is kept for callers; the title flyer is gone, contracts §C.1). */
export const useOpenEntry = () => {
  const sheet = useSheet();
  const today = useToday();
  return (e: JournalEntry, opts: { from?: Element | null; stamp?: string | null } = {}) =>
    sheet.open({
      eyebrow: ago(e.date, today),
      title: fmtDate('short', e.date),
      body: <EntrySheet e={e} stamp={opts.stamp} />,
    });
};

/** Open a day from the ribbon: its one entry, its list of entries, or a composer for it. */
export const useOpenDay = () => {
  const sheet = useSheet();
  const openEntry = useOpenEntry();
  const today = useToday();
  return (date: string, entries: JournalEntry[], opts: { from?: Element | null; stamp?: string | null } = {}) => {
    if (entries.length === 1) return openEntry(entries[0]!, opts);
    sheet.open({
      eyebrow: ago(date, today),
      title: fmtDate('short', date),
      body: entries.length ? <DayList date={date} stamp={opts.stamp} /> : <DayComposer date={date} />,
    });
  };
};

/**
 * One entry as a row inside a group (Today's journal section): the time, the words in serif; tap to open, swipe left to
 * delete (with Undo), hold for Edit, Favourite, Share and Delete.
 */
export const EntryItem = ({ e, stamp }: { e: JournalEntry; stamp?: string | null }) => {
  const act = useEntryActions();
  const open = useOpenEntry();
  const sheet = useSheet();
  return (
    <SwipeRow
      label={`Entry from ${timeOf(e.createdAt)}`}
      left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
      menuItems={[
        { label: 'Edit', icon: <Pencil size={18} />, onSelect: () => sheet.open({ eyebrow: fmtDate('short', e.date), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
        { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
        { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
      ]}
    >
      <PressButton className="jentry-body" onClick={(ev) => open(e, { from: ev.currentTarget.querySelector('.jentry-meta'), stamp })}>
        <span className="caps jentry-meta">
          <span>{timeOf(e.createdAt)}</span>
          <FavStar on={e.fav} label="Favourite" />
        </span>
        <span className="jentry-text">{e.text}</span>
      </PressButton>
    </SwipeRow>
  );
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
  /** `lg`: the Journal page's writing voice at 22/28. */
  size?: 'lg';
  /** Built from the day, e.g. `useDayPrompt(date)`: "Speed 5 done, 5.02 mi. How did it feel?". */
  placeholder?: string;
  /** Between the words and Save: an optional prompt line (the day's `QuoteLine`). `insert` puts text at the top of the entry. */
  prompt?: (insert: (text: string) => void, text: string) => ReactNode;
  /** After a save, once the words have left the field. */
  onSaved?: () => void;
  /** @deprecated kept for callers: a plain save raises no toast (§8, toasts are for Undo and errors only). */
  toast?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** VoiceOver name. Default "Journal entry". */
  label?: string;
  /**
   * `flip`: the field's growth (a new line, or the words leaving on Save) is a FLIP on `settle` (§10.1): the card's chrome
   * (`.jcompose-bg` in the nearest `.jcompose`) scales from its old height and everything below rides back from where it
   * was. Default: the field just grows (a card that must not resize keeps its own rule).
   */
  grow?: 'flip';
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
export const Composer = ({ date, today, rows = 3, size, placeholder, prompt, onSaved, autoFocus, inputRef, label = 'Journal entry', grow }: ComposerProps) => {
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
  // the field grows with the words, never scrolls inside itself; with grow="flip" the change is carried on `settle`
  const lastH = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const was = el.offsetHeight;
    el.style.height = 'auto';
    const h = el.scrollHeight;
    el.style.height = `${h}px`;
    const d = h - (lastH.current ?? h);
    lastH.current = h;
    if (grow !== 'flip' || Math.abs(d) < 1 || !was) return;
    const card = el.closest('.jcompose');
    const bg = card?.querySelector<HTMLElement>('.jcompose-bg');
    if (bg && card) carryScaleY(bg, (card.getBoundingClientRect().height - d) / card.getBoundingClientRect().height);
    for (const n of below(el)) if (n !== bg) carry(n, -d);
  }, [text, ref, grow]);
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
    if (first) haptics.success();
    // the field empties in the commit that shows the entry in the list (one move of the page, not two)
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      set('');
      setSaved(true);
    };
    add.mutate(whenShown({ date, text: v }, clear), { onError: () => (clear(), set(v), toast('Couldn’t save that. Your words are back in the field.')) });
    // the field's words are in the draft store and the outbox now; a list that is not mounted still clears the field
    setTimeout(clear, 250);
    onSaved?.();
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
      {grow === 'flip' ? <span className="jcompose-bg" aria-hidden="true" /> : null}
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

/** The journal section Today embeds: the day's entries and a composer whose placeholder comes from the day. */
export const JournalDaySection = ({ date, log }: { date: string; log: Log }) => {
  const list = log.snap.journalOn(date);
  const placeholder = useDayPrompt(date);
  const stamp = log.loaded(date) ? runStamp(log.snap, date) : null;
  return (
    <Section title="Journal" meta={list.length || undefined} level="secondary">
      <Group>
        {list.map((e) => (
          <EntryItem key={e.id} e={e} stamp={stamp} />
        ))}
        <Composer date={date} today={log.today} rows={2} placeholder={placeholder} />
      </Group>
    </Section>
  );
};

/** Months a set of dates spans, for `useLog`. */
export const monthsOf = (dates: string[]) => [...new Set(dates.map(monthOf))].sort();
