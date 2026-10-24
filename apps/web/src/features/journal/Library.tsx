import { fmtDate, type JournalEntry, type Quote, linkTitle } from '@logbook/shared';
import { ChevronRight, EyeOff, PenLine, Plus, Search, Share, Star, Trash2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { seedOf, usePick, useJournalList, useJournalMutations, useQuotes, useQuoteThemes, useReads, useThemeQuotes, type QuoteTheme } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { Button, ContextMenu, EmptyState, Group, IconButton, Pressable, Row, Section, Skeleton, SkeletonGroup, SkeletonRows, SwipeRow, useSheet, useToast } from '@/ui';
import { FavStar } from './FavStar';
import { PressButton } from './PressButton';
import { measureBelow, useListFlip } from './feel';
import { SaveButton, useEntryActions, useOpenEntry } from './JournalDaySection';

const Byline = ({ q }: { q: Quote }) =>
  q.author || q.work ? (
    <span className="by">
      {q.author ? <span className="by-author">{q.author}</span> : null}
      {q.work ? <cite className="serif">{q.work}</cite> : null}
    </span>
  ) : null;

/** Favourite (the star that shows it fires `toggle` on its pop's apex), Hide or Delete (with Undo): the one place quote actions live. */
export const useQuoteActions = () => {
  const { quotePrefs, removeQuote, addQuote, another } = useJournalMutations();
  const toast = useToast();
  return {
    fav: (q: Quote) => quotePrefs.mutate({ id: q.id, fav: !q.fav }),
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
            <FavStar on={fav} size={16} always className="" />
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
      <PressButton className="qrow" onClick={() => open(q)}>
        <span className="qrow-text">“{q.text}”</span>
        <span className="qrow-by">
          <FavStar on={q.fav} label="Favourite" />
          <Byline q={q} />
        </span>
      </PressButton>
    </SwipeRow>
  );
};

/** The way to Reads: one touchable card that says what is waiting, and pushes /journal/reads over the mounted Journal. */
const ReadsRow = () => {
  const nav = useNav();
  const today = useToday();
  const reads = useReads();
  const pick = usePick(today, false);
  const unread = (reads.data ?? []).filter((x) => !x.readAt).length;
  const p = pick.data?.pick && pick.data.pick.verdict !== 'dismissed' ? pick.data.pick : null;
  const sub = [unread ? `${unread} unread` : null, p ? `Today: ${linkTitle(p.title, p.url)}` : null].filter(Boolean).join(' · ') || 'Save links to come back to';
  return (
    <Pressable className="reads-row" onPress={() => nav.push('/journal/reads')} label={`Reads. ${unread ? `${unread} unread. ` : ''}${p ? `Today’s pick: ${linkTitle(p.title, p.url)}` : ''}`}>
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
        // one quiet 60 row (§8, visual S8): no ghost, no verb
        <Group className="lib-fav-empty">
          <Row className="lib-fav-empty-row" title="No favourites yet" sub="Swipe a quote right, or hold an entry, and it stays here." />
        </Group>
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
  const [adding, setAddingRaw] = useState(false);
  const [nt, setNt] = useState('');
  const [na, setNa] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const flip = useRef<(() => void) | null>(null);
  const mine = page.data?.quotes ?? [];
  // the form opening or closing moves what is below by a FLIP on `settle` (§10.1), never a height animation
  const setAdding = (v: boolean) => {
    flip.current = measureBelow(head.current);
    setAddingRaw(v);
  };
  useLayoutEffect(() => {
    flip.current?.();
    flip.current = null;
    if (adding) requestAnimationFrame(() => field.current?.focus());
  }, [adding]);
  useListFlip(rows, mine.map((q) => q.id).join(','));
  const add = () => {
    // a quote kept is not a day's close: no `success` (two a day, §11.4)
    flip.current = measureBelow(head.current);
    addQuote.mutate({ text: nt.trim(), author: na.trim() }, { onError: () => toast('Couldn’t add that quote.') });
    setNt('');
    setNa('');
    setAdding(false);
  };
  const form = (
    <div className="fade-in">
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
    </div>
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
      <div ref={head} className="jtl-anchor" aria-hidden="true" />
      {adding ? form : null}
      {page.isPending && !page.data ? (
        <SkeletonRows rows={2} label="Loading your quotes" />
      ) : !mine.length ? (
        adding ? null : (
          <EmptyState verb={{ label: 'Add a quote', onPress: () => setAdding(true) }}>Lines you want to keep. They come back as a day’s quote.</EmptyState>
        )
      ) : (
        <div ref={rows} className="list-edge lib-list">
          {mine.map((q) => (
            <div key={q.id} data-key={q.id} className="lib-item">
              <QuoteRow q={q} open={open} onWrite={onWrite} />
            </div>
          ))}
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
        <Button variant="quiet" block className="theme-more" onClick={() => setShown((n) => n + PAGE)}>
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
  const list = needle.length >= 2 ? (page.data?.quotes ?? []) : [];
  return (
    <div className="qsearch">
      <input ref={field} autoFocus className="in" type="search" enterKeyHint="search" placeholder="Words, an author or a book" aria-label="Search quotes" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} />
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
/** The magnifier that opens the search sheet (the Themes section's action; the Journal bar's trailing slot stays empty, §2.4). */
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
    <Section title="Themes" level="primary" className="lib-themes" action={<LibrarySearchButton onWrite={onWrite} />}>
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
export const Library = ({ onWrite }: { onWrite: (q: Quote) => void }) => {
  const open = useOpenQuote(onWrite);
  return (
    <div className="library">
      <ReadsRow />
      <Favourites open={open} onWrite={onWrite} />
      <YourQuotes open={open} onWrite={onWrite} />
      <Themes onWrite={onWrite} />
    </div>
  );
};
