import { fmtDate, QUOTE_THEMES, type JournalEntry, type Quote } from '@logbook/shared';
import { ChevronRight, EyeOff, PenLine, Plus, Share, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePick, useJournalList, useJournalMutations, useQuotes, useReads } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { rowPresence } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, ChipButton, ContextMenu, EmptyState, Group, Pressable, Section, Skeleton, SkeletonRows, SwipeRow, useSheet, useToast } from '@/ui';
import { SaveButton, useEntryActions, useOpenEntry } from './JournalDaySection';

const Byline = ({ q }: { q: Quote }) =>
  q.author || q.work ? (
    <span className="by">
      {q.author ? <span className="by-author">{q.author}</span> : null}
      {q.work ? <cite className="serif">{q.work}</cite> : null}
    </span>
  ) : null;

/** Favourite (with a toggle haptic), Hide or Delete (with Undo): the one place quote actions live. */
export const useQuoteActions = () => {
  const { quotePrefs, removeQuote, addQuote, another } = useJournalMutations();
  const toast = useToast();
  return {
    fav: (q: Quote) => {
      haptics.toggle();
      quotePrefs.mutate({ id: q.id, fav: !q.fav });
    },
    hide: (q: Quote, isDaily?: boolean) => {
      haptics.delete();
      quotePrefs.mutate({ id: q.id, hidden: true });
      if (isDaily) another.mutate('quote');
      toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
    },
    remove: (q: Quote) => {
      haptics.delete();
      removeQuote.mutate(q.id);
      // there is no restore for your own quotes on the server: Undo writes it again
      toast('Deleted', { label: 'Undo', fn: () => addQuote.mutate({ text: q.text, author: q.author }) });
    },
  };
};

/**
 * Behind a tap on a quote: the whole of it in the serif, the work, Favourite as the sheet's verb, Write about it, and for one
 * of your own, Delete (with Undo). The author is the title, so it is not said twice.
 */
const QuoteSheet = ({ q: opened, onWrite }: { q: Quote; onWrite: (q: Quote) => void }) => {
  const sheet = useSheet();
  const act = useQuoteActions();
  const [fav, setFav] = useState(opened.fav);
  const q = { ...opened, fav };
  return (
    <div className="qsheet">
      <blockquote className="quote-text display long">“{q.text}”</blockquote>
      {q.work ? <cite className="qsheet-work serif">{q.work}</cite> : null}
      <div className="sheet-foot">
        {q.mine ? (
          <Button
            variant="quiet"
            className="danger-quiet"
            onClick={() => {
              sheet.close();
              act.remove(q);
            }}
          >
            <Trash2 size={16} aria-hidden="true" /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="foot-right">
          <Button
            onClick={() => {
              sheet.close();
              onWrite(q);
            }}
          >
            <PenLine size={16} aria-hidden="true" /> Write
          </Button>
          <Button
            variant={fav ? 'default' : 'primary'}
            aria-pressed={fav}
            onClick={() => {
              act.fav(q);
              setFav(!fav);
            }}
          >
            <Star size={16} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
            {fav ? 'Favourited' : 'Favourite'}
          </Button>
        </div>
      </div>
    </div>
  );
};
export const useOpenQuote = (onWrite: (q: Quote) => void) => {
  const sheet = useSheet();
  return (q: Quote) => sheet.open({ eyebrow: q.mine ? 'Yours' : q.theme || undefined, title: q.author || 'Quote', body: <QuoteSheet q={q} onWrite={onWrite} /> });
};

/** One quote as an edge-to-edge row. Tap: the sheet. Swipe right: Favourite. Swipe left: Hide (or Delete, your own). Hold: all of it. */
const QuoteRow = ({ q, open, onWrite }: { q: Quote; open: (q: Quote) => void; onWrite: (q: Quote) => void }) => {
  const act = useQuoteActions();
  return (
    <SwipeRow
      label={q.author ? `Quote by ${q.author}` : 'Quote'}
      right={{ label: q.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={20} />, tone: 'warn', onCommit: () => act.fav(q) }}
      left={q.mine ? { label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.remove(q) } : { label: 'Hide', icon: <EyeOff size={20} />, tone: 'neutral', destructive: false, onCommit: () => act.hide(q) }}
      menuItems={[{ label: 'Write about it', icon: <PenLine size={18} />, onSelect: () => onWrite(q) }]}
    >
      <button type="button" className="qrow" onClick={() => open(q)}>
        <span className="qrow-text">“{q.text}”</span>
        <span className="qrow-by">
          {q.fav ? <Star size={11} fill="currentColor" className="jfav" aria-label="Favourite" /> : null}
          <Byline q={q} />
        </span>
      </button>
    </SwipeRow>
  );
};

/** The way to Reads: one touchable card that says what is waiting, and pushes /reads. */
const ReadsRow = () => {
  const nav = useNavigate();
  const today = useToday();
  const reads = useReads();
  const pick = usePick(today, false);
  const unread = (reads.data ?? []).filter((x) => !x.readAt).length;
  const p = pick.data?.pick && pick.data.pick.verdict !== 'dismissed' ? pick.data.pick : null;
  const sub = [unread ? `${unread} unread` : null, p ? `Today: ${p.title}` : null].filter(Boolean).join(' · ') || 'Save links to come back to';
  return (
    <Pressable className="reads-row" onPress={() => nav('/reads')} label={`Reads. ${unread ? `${unread} unread. ` : ''}${p ? `Today’s pick: ${p.title}` : ''}`}>
      <span className="reads-row-main">
        <span className="reads-row-title">Reads</span>
        <span className="reads-row-sub">{sub}</span>
      </span>
      <ChevronRight size={20} className="muted" aria-hidden="true" />
    </Pressable>
  );
};

/** Favourite quotes and entries, side by side in a carousel: the fuel you kept. */
const Favourites = ({ open, onWrite }: { open: (q: Quote) => void; onWrite: (q: Quote) => void }) => {
  const quotes = useQuotes({ fav: true, limit: 60 });
  const entries = useJournalList('', true);
  const openEntry = useOpenEntry();
  const act = useQuoteActions();
  const entryAct = useEntryActions();
  const items: Array<{ kind: 'q'; q: Quote } | { kind: 'e'; e: JournalEntry }> = [...(entries.data?.entries ?? []).map((e) => ({ kind: 'e' as const, e })), ...(quotes.data?.quotes ?? []).map((q) => ({ kind: 'q' as const, q }))];
  const loading = (quotes.isPending && !quotes.data) || (entries.isPending && !entries.data);
  return (
    <Section title="Favourites" meta={items.length || undefined} level="primary" className="lib-favs">
      {loading ? (
        <div className="carousel fav-carousel" aria-hidden="true">
          <Skeleton h={156} r="card" />
          <Skeleton h={156} r="card" />
        </div>
      ) : !items.length ? (
        <EmptyState
          ghost={
            <div className="carousel fav-carousel">
              <div className="fav-card">
                <span className="fav-text">“The obstacle is the way.”</span>
                <span className="fav-by">Marcus Aurelius</span>
              </div>
              <div className="fav-card">
                <span className="fav-text">Legs were heavy, then they weren’t.</span>
              </div>
            </div>
          }
          verb={{ label: 'Browse quotes', onPress: () => document.getElementById('lib-quotes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
        >
          Swipe a quote right, or hold an entry, and it stays here.
        </EmptyState>
      ) : (
        <div className="carousel fav-carousel" role="list">
          {items.map((it) =>
            it.kind === 'q' ? (
              <ContextMenu
                key={it.q.id}
                label={`Quote by ${it.q.author || 'you'}`}
                items={[
                  { label: 'Write about it', icon: <PenLine size={18} />, onSelect: () => onWrite(it.q) },
                  { label: 'Unfavourite', icon: <Star size={18} />, onSelect: () => act.fav(it.q) },
                ]}
              >
                <Pressable role="listitem" className="fav-card" onPress={() => open(it.q)} label={`${it.q.text}. ${it.q.author}`}>
                  <span className="fav-text">“{it.q.text}”</span>
                  <span className="fav-by">{it.q.author || 'Yours'}</span>
                </Pressable>
              </ContextMenu>
            ) : (
              <ContextMenu
                key={it.e.id}
                label={`Entry from ${fmtDate('short', it.e.date)}`}
                items={[
                  { label: 'Unfavourite', icon: <Star size={18} />, onSelect: () => entryAct.fav(it.e) },
                  { label: 'Share', icon: <Share size={18} />, onSelect: () => entryAct.share(it.e) },
                ]}
              >
                <Pressable role="listitem" className="fav-card is-entry" onPress={(ev) => openEntry(it.e, { from: (ev.currentTarget as HTMLElement).querySelector('.fav-date') })} label={`Your entry, ${fmtDate('long', it.e.date)}. ${it.e.text}`}>
                  <span className="fav-text">{it.e.text}</span>
                  <span className="fav-by">
                    <span className="caps fav-date">{fmtDate('short', it.e.date)}</span>
                  </span>
                </Pressable>
              </ContextMenu>
            ),
          )}
        </div>
      )}
    </Section>
  );
};

/** Your own lines: add one inline, and they come back as a day's quote. */
const YourQuotes = ({ open, onWrite }: { open: (q: Quote) => void; onWrite: (q: Quote) => void }) => {
  const page = useQuotes({ theme: 'Yours', limit: 100 });
  const { addQuote } = useJournalMutations();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [nt, setNt] = useState('');
  const [na, setNa] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const mine = page.data?.quotes ?? [];
  useEffect(() => {
    if (adding) requestAnimationFrame(() => field.current?.focus());
  }, [adding]);
  const add = () => {
    haptics.success();
    addQuote.mutate({ text: nt.trim(), author: na.trim() }, { onError: () => toast('Couldn’t add that quote.') });
    setNt('');
    setNa('');
    setAdding(false);
  };
  const form = (
    <motion.div key="form" {...rowPresence}>
      <Group className="qadd">
        <textarea ref={field} className="jtext serif" rows={2} maxLength={400} placeholder="A line worth keeping" aria-label="Quote" value={nt} onChange={(e) => setNt(e.target.value)} />
        <input className="jtext qadd-by" maxLength={80} placeholder="Who said it (optional)" aria-label="Author" value={na} onChange={(e) => setNa(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nt.trim().length >= 3 && add()} />
        <div className="composer-foot">
          <Button variant="quiet" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <SaveButton ready={nt.trim().length >= 3} onClick={add}>
            Add
          </SaveButton>
        </div>
      </Group>
    </motion.div>
  );
  return (
    <Section
      title="Your quotes"
      meta={mine.length || undefined}
      level="primary"
      action={
        mine.length && !adding ? (
          <Button variant="ghost" className="sec-verb" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" /> Add
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence initial={false}>{adding ? form : null}</AnimatePresence>
      {page.isPending && !page.data ? (
        <SkeletonRows rows={2} label="Loading your quotes" />
      ) : !mine.length ? (
        adding ? null : (
          <EmptyState verb={{ label: 'Add a quote', onPress: () => setAdding(true) }}>Lines you want to keep. They come back as a day’s quote.</EmptyState>
        )
      ) : (
        <div className="list-edge lib-list">
          <AnimatePresence initial={false}>
            {mine.map((q) => (
              <motion.div key={q.id} className="lib-item" {...rowPresence}>
                <QuoteRow q={q} open={open} onWrite={onWrite} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Section>
  );
};

const THEMES = ['All', ...QUOTE_THEMES] as const;
/** The library: themes as chips, a search, the quotes edge to edge. */
const QuoteLibrary = ({ open, onWrite }: { open: (q: Quote) => void; onWrite: (q: Quote) => void }) => {
  const [theme, setTheme] = useState<string>('All');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const page = useQuotes({ theme, q: q.trim(), limit });
  // your own quotes ride along at the head of "All" on the server; they have their own section here
  const total = Math.max(0, (page.data?.total ?? 0) - (page.data?.quotes ?? []).filter((x) => x.mine).length);
  const list = (page.data?.quotes ?? []).filter((x) => !x.mine);
  return (
    <Section title="Quotes" meta={total ? total.toLocaleString() : undefined} level="primary" className="lib-quotes">
      <span id="lib-quotes" className="anchor" />
      <div className="theme-scroll" role="radiogroup" aria-label="Themes">
        {THEMES.map((t) => (
          <ChipButton
            key={t}
            role="radio"
            aria-checked={theme === t}
            on={theme === t}
            onClick={() => {
              if (theme === t) return;
              haptics.select();
              setTheme(t);
              setLimit(30);
            }}
          >
            {t}
          </ChipButton>
        ))}
      </div>
      <input className="in lib-search" type="search" placeholder="Search quotes, authors or books" value={q} onChange={(e) => (setQ(e.target.value), setLimit(30))} aria-label="Search quotes" />
      {page.isPending && !page.data ? (
        <SkeletonRows rows={4} label="Loading quotes" />
      ) : !list.length ? (
        <EmptyState verb={{ label: 'Show every quote', onPress: () => (setQ(''), setTheme('All')) }}>Nothing matches “{q.trim() || theme}”.</EmptyState>
      ) : (
        <div className="list-edge lib-list">
          {list.map((x) => (
            <QuoteRow key={x.id} q={x} open={open} onWrite={onWrite} />
          ))}
        </div>
      )}
      {total > limit ? (
        <Button variant="quiet" block className="tl-more" onClick={() => setLimit((l) => l + 30)}>
          Show more
        </Button>
      ) : null}
    </Section>
  );
};

/** The Library segment: the way to Reads, then favourites, your quotes, and the quote library. */
export const Library = ({ focus, onWrite }: { focus?: 'favorites' | 'quotes' | null; onWrite: (q: Quote) => void }) => {
  const open = useOpenQuote(onWrite);
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector(focus === 'favorites' ? '.lib-favs' : '#lib-quotes');
    requestAnimationFrame(() => el?.scrollIntoView({ block: 'start' }));
  }, [focus]);
  return (
    <div className="library">
      <ReadsRow />
      <Favourites open={open} onWrite={onWrite} />
      <YourQuotes open={open} onWrite={onWrite} />
      <QuoteLibrary open={open} onWrite={onWrite} />
    </div>
  );
};
