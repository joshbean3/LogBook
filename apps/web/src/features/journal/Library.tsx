import { fmtDate, type JournalEntry, type Quote, linkTitle } from '@logbook/shared';
import { ChevronRight, EyeOff, PenLine, Plus, Search, Share, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { seedOf, usePick, useJournalList, useJournalMutations, useQuotes, useQuoteThemes, useReads, useThemeQuotes, type QuoteTheme } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { rowPresence } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, ContextMenu, EmptyState, Group, IconButton, Pressable, Section, Skeleton, SkeletonGroup, SkeletonRows, SwipeRow, useSheet, useToast } from '@/ui';
import { GhostCards } from './Ghost';
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
export const useOpenQuote = (onWrite: (q: Quote) => void, push = false) => {
  const sheet = useSheet();
  return (q: Quote) => {
    const spec = { eyebrow: q.mine ? 'Yours' : q.theme || undefined, title: q.author || 'Quote', body: <QuoteSheet q={q} onWrite={onWrite} /> };
    if (push) sheet.push(spec);
    else sheet.open(spec);
  };
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
  const sub = [unread ? `${unread} unread` : null, p ? `Today: ${linkTitle(p.title, p.url)}` : null].filter(Boolean).join(' · ') || 'Save links to come back to';
  return (
    <Pressable className="reads-row" onPress={() => nav('/reads')} label={`Reads. ${unread ? `${unread} unread. ` : ''}${p ? `Today’s pick: ${linkTitle(p.title, p.url)}` : ''}`}>
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
          ghost={<GhostCards />}
          verb={{ label: 'Browse themes', onPress: () => document.getElementById('lib-themes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
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

/** The day's order for a theme: the same all day, different tomorrow (a seeded Fisher–Yates). */
const shuffled = <T,>(list: T[], seed: number) => {
  const out = [...list];
  let h = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};
const PAGE = 20;

/** Behind a theme card: the theme's quotes in the day's order, 20 at a time, edge to edge. */
const ThemeList = ({ theme, onWrite }: { theme: string; onWrite: (q: Quote) => void }) => {
  const today = useToday();
  const all = useThemeQuotes(theme);
  const open = useOpenQuote(onWrite, true);
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => shuffled(all.data ?? [], seedOf(`${today}:${theme}`)), [all.data, today, theme]);
  if (all.isPending && !all.data) return <SkeletonRows rows={6} label={`Loading ${theme}`} />;
  if (!list.length) return <EmptyState>Every quote in {theme} is hidden. Hidden quotes stay hidden.</EmptyState>;
  return (
    <div className="theme-list">
      <div className="list-edge lib-list">
        {list.slice(0, shown).map((x) => (
          <QuoteRow key={x.id} q={x} open={open} onWrite={onWrite} />
        ))}
      </div>
      {list.length > shown ? (
        <Button variant="quiet" block className="theme-more" onClick={() => (haptics.select(), setShown((n) => n + PAGE))}>
          More
        </Button>
      ) : null}
    </div>
  );
};

/** Search, in its own sheet: words, an author or a book, across every quote (yours too). */
const QuoteSearch = ({ onWrite }: { onWrite: (q: Quote) => void }) => {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const needle = q.trim();
  const page = useQuotes({ theme: 'All', q: needle, limit });
  const open = useOpenQuote(onWrite, true);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => field.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);
  const list = needle.length >= 2 ? (page.data?.quotes ?? []) : [];
  return (
    <div className="qsearch">
      <input ref={field} className="in" type="search" enterKeyHint="search" placeholder="Words, an author or a book" aria-label="Search quotes" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} />
      {needle.length < 2 ? null : page.isPending && !page.data ? (
        <SkeletonRows rows={3} label="Searching" />
      ) : !list.length ? (
        <EmptyState verb={{ label: 'Clear', onPress: () => (setQ(''), field.current?.focus()) }}>Nothing says “{needle}”.</EmptyState>
      ) : (
        <>
          <div className="list-edge lib-list">
            {list.map((x) => (
              <QuoteRow key={x.id} q={x} open={open} onWrite={onWrite} />
            ))}
          </div>
          {(page.data?.total ?? 0) > limit ? (
            <Button variant="quiet" block className="theme-more" onClick={() => setLimit((l) => l + PAGE)}>
              More
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
};
/** The magnifier that opens the search sheet (the Library's header accessory). */
export const useQuoteSearch = (onWrite: (q: Quote) => void) => {
  const sheet = useSheet();
  return () => sheet.open({ eyebrow: 'Library', title: 'Search quotes', detent: 'large', body: <QuoteSearch onWrite={onWrite} /> });
};
export const LibrarySearchButton = ({ onWrite }: { onWrite: (q: Quote) => void }) => {
  const search = useQuoteSearch(onWrite);
  return (
    <IconButton label="Search quotes" className="lib-search-btn" onClick={search}>
      <Search size={20} />
    </IconButton>
  );
};

/** One theme as a card: the serif name, how many quotes it holds, and one line from it (a different one each day). */
const ThemeCard = ({ t, onPress }: { t: QuoteTheme; onPress: () => void }) => (
  <Pressable className="theme-card" onPress={onPress} label={`${t.theme}, ${t.count} quotes`}>
    <span className="theme-card-top">
      <span className="theme-name">{t.theme}</span>
      <span className="theme-count tnum">{t.count.toLocaleString()}</span>
    </span>
    {t.sample ? <span className="theme-sample">“{t.sample.text}”</span> : null}
  </Pressable>
);

/** The quote library as themes: a 2-column grid of cards; each pushes its quotes, shuffled for the day. */
const Themes = ({ onWrite }: { onWrite: (q: Quote) => void }) => {
  const today = useToday();
  const themes = useQuoteThemes(today);
  const sheet = useSheet();
  const list = (themes.data ?? []).filter((t) => t.count > 0);
  return (
    <Section title="Themes" level="primary" className="lib-themes">
      <span id="lib-themes" className="anchor" />
      {themes.isPending && !themes.data ? (
        <SkeletonGroup label="Loading themes" className="theme-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} h={128} r="card" />
          ))}
        </SkeletonGroup>
      ) : (
        <div className={`theme-grid ${list.length % 2 ? 'odd' : ''}`}>
          {list.map((t) => (
            <ThemeCard key={t.theme} t={t} onPress={() => sheet.open({ eyebrow: `${t.count.toLocaleString()} quotes`, title: t.theme, detent: 'large', body: <ThemeList theme={t.theme} onWrite={onWrite} /> })} />
          ))}
        </div>
      )}
    </Section>
  );
};

/** The Library segment: the way to Reads, then favourites, your own quotes, and the themes. */
export const Library = ({ focus, onWrite }: { focus?: 'favorites' | 'quotes' | null; onWrite: (q: Quote) => void }) => {
  const open = useOpenQuote(onWrite);
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector(focus === 'favorites' ? '.lib-favs' : '#lib-themes');
    requestAnimationFrame(() => el?.scrollIntoView({ block: 'start' }));
  }, [focus]);
  return (
    <div className="library">
      <ReadsRow />
      <Favourites open={open} onWrite={onWrite} />
      <YourQuotes open={open} onWrite={onWrite} />
      <Themes onWrite={onWrite} />
    </div>
  );
};
