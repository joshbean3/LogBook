import { ago, fmtDate, QUOTE_THEMES, type JournalEntry, type Quote } from '@logbook/shared';
import { ChevronRight, Shuffle, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useDaily, useJournalList, useJournalMutations, useQuotes } from '@/api/queries';
import { Button, ChipButton, EmptyState, Group, IconButton, PageHeader, Segmented } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { Composer, EntryItem, EntrySheet, SaveButton } from './JournalDaySection';
import './journal.css';

/** A caps eyebrow with a caps meta at the right: the section head of this screen. */
const Sec = ({ title, meta, first }: { title: string; meta?: string; first?: boolean }) => (
  <div className="j-sec" style={first ? { marginTop: 0 } : undefined}>
    <span className="caps">{title}</span>
    {meta ? <span className="caps meta">{meta}</span> : null}
  </div>
);

const Byline = ({ q, big }: { q: Quote; big?: boolean }) =>
  q.author ? (
    <span className={`by ${big ? 'big' : ''}`}>
      <span className="by-author">{q.author}</span>
      {q.work ? <cite className="serif">{q.work}</cite> : null}
    </span>
  ) : null;

/** Behind a tap on a quote: the whole of it in the serif, who said it, the theme, Star and, for one of your own, Delete. */
const QuoteSheet = ({ q }: { q: Quote }) => {
  const { quotePrefs, removeQuote } = useJournalMutations();
  const sheet = useSheet();
  const [fav, setFav] = useState(q.fav);
  return (
    <div className="qsheet">
      <blockquote className="quote-text display long">“{q.text}”</blockquote>
      <div className="quote-by">
        <Byline q={q} big />
      </div>
      {q.theme ? <span className="caps">{q.theme}</span> : null}
      <div className="sheet-foot">
        {q.mine ? (
          <Button
            variant="danger"
            onClick={() => {
              removeQuote.mutate(q.id);
              sheet.close();
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="foot-right">
          <Button
            variant={fav ? 'default' : 'primary'}
            aria-pressed={fav}
            onClick={() => {
              quotePrefs.mutate({ id: q.id, fav: !fav });
              setFav(!fav);
            }}
          >
            <Star size={16} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
            {fav ? 'Unstar' : 'Star'}
          </Button>
        </div>
      </div>
    </div>
  );
};
const useOpenQuote = () => {
  const sheet = useSheet();
  return (q: Quote) => sheet.open({ title: q.author || 'Quote', body: <QuoteSheet q={q} /> });
};

/** Shuffle swaps the quote or the memory with a 200ms cross-fade: the old one fades out as the new one fades in. */
const FADE = { duration: 0.2, ease: 'easeOut' as const };

/** Data still arriving: a quiet block the height the content will take. No spinner, no words; the page lays out once. */
const Wait = ({ kind }: { kind: 'memory' | 'quote' | 'list' }) => <div className={`jwait ${kind}`} aria-busy="true" />;

/** True once this card has shown a placeholder, so the content that replaces it fades in; later swaps already animate on key. */
const useWaited = (waiting: boolean) => {
  const waited = useRef(false);
  if (waiting) waited.current = true;
  return waited.current;
};

/** Serif body text clamped to ~6 lines, with a More that lets it out. The words are a button: a tap opens the entry. */
const ClampedText = ({ text, id, onOpen }: { text: string; id: string; onOpen: () => void }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    setOpen(false);
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [id]);
  return (
    <>
      <button type="button" className="jmem-open" onClick={onOpen}>
        <span ref={ref} className={`memory-text ${open ? '' : 'clamp'}`}>
          {text}
        </span>
      </button>
      {overflows ? (
        <button type="button" className="link sm quiet" style={{ justifySelf: 'start' }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </>
  );
};

/** The hero: today's quote on a black card, lit from below. */
const QuoteHero = () => {
  const daily = useDaily();
  const { another, quotePrefs } = useJournalMutations();
  const toast = useToast();
  const openQuote = useOpenQuote();
  const q = daily.data?.quote ?? null;
  const waiting = daily.isPending && !daily.data;
  const waited = useWaited(waiting);
  return (
    <section className="jq" aria-label="Today’s quote">
      <span className="jq-glow" aria-hidden="true" />
      <div className="jq-top">
        <span className="caps">Today’s quote</span>
        {q?.theme ? <span className="caps">{q.theme}</span> : null}
      </div>
      {waiting ? (
        <Wait kind="quote" />
      ) : !q ? (
        <div className="jq-body">
          <p className="quote-text display">Nothing left to show.</p>
          <p className="t-sub muted">Star a few in the library and they come back sooner.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout" initial={waited}>
          <motion.div key={q.id} className="jq-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
            <button type="button" className="jq-open" onClick={() => openQuote(q)}>
              <blockquote className={`quote-text display ${q.text.length > 120 ? 'long' : ''}`}>“{q.text}”</blockquote>
              <span className="quote-by">
                <Byline q={q} big />
              </span>
            </button>
          </motion.div>
        </AnimatePresence>
      )}
      <div className="jq-actions">
        <ChipButton onClick={() => another.mutate('quote')} disabled={another.isPending || !q}>
          <Shuffle size={14} /> Shuffle
        </ChipButton>
        {q && !q.mine ? (
          <ChipButton
            quiet
            onClick={() => {
              quotePrefs.mutate({ id: q.id, hidden: true });
              another.mutate('quote');
              toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
            }}
          >
            Hide
          </ChipButton>
        ) : null}
        <IconButton label={q?.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${q?.fav ? 'on' : ''}`} disabled={!q} onClick={() => q && quotePrefs.mutate({ id: q.id, fav: !q.fav })}>
          <Star size={18} fill={q?.fav ? 'currentColor' : 'none'} />
        </IconButton>
      </div>
    </section>
  );
};

const MemoryCard = ({ today }: { today: string }) => {
  const daily = useDaily();
  const { another, patch } = useJournalMutations();
  const nav = useNavigate();
  const sheet = useSheet();
  const e = daily.data?.memory ?? null;
  const waiting = daily.isPending && !daily.data;
  const waited = useWaited(waiting);
  return (
    <>
      <Sec title="From your journal" meta={e ? ago(e.date, today) : undefined} />
      <Group className="jmem-group">
        {waiting ? (
          <Wait kind="memory" />
        ) : !e ? (
          <EmptyState>{daily.data?.pastCount ? 'Every past entry has been shown this month. New ones come back after 30 days.' : 'Entries you write come back here on a random day, never more than once a month. Write your first one below.'}</EmptyState>
        ) : (
          <AnimatePresence mode="popLayout" initial={waited}>
            <motion.div key={e.id} className="jmem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
              <span className="jmem-date">
                <span className="caps">{fmtDate('long', e.date)}</span>
              </span>
              <ClampedText text={e.text} id={e.id} onOpen={() => sheet.open({ title: fmtDate('short', e.date), body: <EntrySheet e={e} /> })} />
              <div className="jmem-actions">
                <ChipButton onClick={() => another.mutate('memory')} disabled={another.isPending}>
                  <Shuffle size={14} /> Shuffle
                </ChipButton>
                <ChipButton quiet onClick={() => nav(`/today/${e.date}`)}>
                  Open <ChevronRight size={14} />
                </ChipButton>
                <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
                  <Star size={18} fill={e.fav ? 'currentColor' : 'none'} />
                </IconButton>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </Group>
    </>
  );
};

const EntriesList = ({ favOnly, today }: { favOnly: boolean; today: string }) => {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const list = useJournalList(q.trim(), favOnly);
  const entries = list.data?.entries ?? [];
  const groups = useMemo(() => {
    const out: Array<{ date: string; items: JournalEntry[] }> = [];
    for (const e of entries.slice(0, limit)) {
      const g = out[out.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [entries, limit]);
  const nav = useNavigate();
  return (
    <div className="jlist">
      {!favOnly || entries.length > 5 ? <input className="in" type="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(40))} aria-label="Search entries" /> : null}
      {list.isPending && !list.data ? (
        <Group>
          <Wait kind="list" />
        </Group>
      ) : !entries.length ? (
        <Group>
          <EmptyState>{q ? `No entries match “${q.trim()}”.` : favOnly ? 'No favorites yet. Tap the star on an entry to keep it here.' : 'No entries yet. Write one above or from any day.'}</EmptyState>
        </Group>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="day-group">
            <button type="button" className="day-head" onClick={() => nav(`/today/${g.date}`)} aria-label={`Open ${fmtDate('long', g.date)}`}>
              <span className="caps date">{fmtDate('long', g.date)}</span>
              <span className="caps">{ago(g.date, today)}</span>
              <ChevronRight size={14} className="muted" />
            </button>
            <Group>
              {g.items.map((e) => (
                <EntryItem key={e.id} e={e} />
              ))}
            </Group>
          </div>
        ))
      )}
      {entries.length > limit ? (
        <Button block onClick={() => setLimit((l) => l + 40)} aria-label={`Show ${entries.length - limit} older entries`}>
          More
        </Button>
      ) : null}
    </div>
  );
};

const QuoteList = ({ favOnly }: { favOnly: boolean }) => {
  const openQuote = useOpenQuote();
  const [theme, setTheme] = useState('All');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const { quotePrefs, addQuote, removeQuote } = useJournalMutations();
  const toast = useToast();
  const page = useQuotes({ theme: favOnly ? 'All' : theme, q: q.trim(), fav: favOnly, limit, offset: 0 });
  const [nt, setNt] = useState('');
  const [na, setNa] = useState('');
  const [adding, setAdding] = useState(false);
  const themes = ['All', ...QUOTE_THEMES, 'Yours'];
  const total = page.data?.total ?? 0;
  return (
    <div className="jlist">
      {!favOnly ? (
        <div className="theme-scroll" role="group" aria-label="Themes">
          {themes.map((t) => (
            <ChipButton key={t} on={theme === t} onClick={() => (setTheme(t), setLimit(30))}>
              {t}
            </ChipButton>
          ))}
        </div>
      ) : null}
      <input className="in" type="search" placeholder="Search quotes, authors or books" value={q} onChange={(e) => (setQ(e.target.value), setLimit(30))} aria-label="Search quotes" />
      {!favOnly ? (
        adding ? (
          <Group>
            <textarea className="jtext serif" rows={2} maxLength={400} placeholder="e.g. You have to spend energy to make energy." aria-label="Quote" value={nt} onChange={(e) => setNt(e.target.value)} autoFocus />
            <input className="jtext" maxLength={80} placeholder="Who said it (optional)" aria-label="Author" value={na} onChange={(e) => setNa(e.target.value)} />
            <div className="composer-foot">
              <Button variant="ghost" style={{ color: 'var(--ink-2)' }} onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <SaveButton
                ready={nt.trim().length >= 3}
                onClick={() => {
                  addQuote.mutate({ text: nt.trim(), author: na.trim() });
                  setNt('');
                  setNa('');
                  setAdding(false);
                  toast('Added to your quotes and favorites');
                }}
              >
                Add
              </SaveButton>
            </div>
          </Group>
        ) : (
          <ChipButton style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}>
            Add
          </ChipButton>
        )
      ) : null}
      {page.isPending && !page.data ? (
        <Group>
          <Wait kind="list" />
        </Group>
      ) : (
        <>
          {total ? (
            <p className="caps jcount">
              {total.toLocaleString()} {total === 1 ? 'quote' : 'quotes'}
            </p>
          ) : null}
          <Group>
            {!page.data?.quotes.length ? <EmptyState>{favOnly ? 'No favorites yet. Star a quote to keep it here; favorites come back every 14 days instead of 30.' : 'No quotes match.'}</EmptyState> : null}
            {/* the words open the quote; the star and Delete are their own 44px controls at the edge */}
            {page.data?.quotes.map((x) => (
              <div key={x.id} className={`qrow ${x.fav ? 'is-fav' : ''}`}>
                <button type="button" className="q-main q-open" onClick={() => openQuote(x)}>
                  <p>“{x.text}”</p>
                  <span className="q-by">
                    <Byline q={x} />
                    <span className="caps q-theme">{x.theme}</span>
                  </span>
                </button>
                <div className="q-tools">
                  <IconButton label={x.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${x.fav ? 'on' : ''}`} onClick={() => quotePrefs.mutate({ id: x.id, fav: !x.fav })}>
                    <Star size={16} fill={x.fav ? 'currentColor' : 'none'} />
                  </IconButton>
                  {x.mine ? (
                    <IconButton label="Delete quote" onClick={() => removeQuote.mutate(x.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            ))}
          </Group>
          {total > limit ? (
            <Button block onClick={() => setLimit((l) => l + 30)} aria-label="Show more quotes">
              More
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
};

type Tab = 'entries' | 'favorites' | 'quotes';
export default function JournalView() {
  const params = useParams();
  const nav = useNavigate();
  const tab: Tab = params.tab === 'favorites' || params.tab === 'quotes' ? params.tab : 'entries';
  const log = useLog([]);
  const t = log.today;
  const all = useJournalList('', false);
  const n = all.data?.entries.length ?? 0;
  return (
    <div className="page">
      <PageHeader title="Journal" sub="Write, look back, and a quote to start the day." />
      <QuoteHero />
      <MemoryCard today={t} />
      <Sec title="Write" meta={fmtDate('short', t)} />
      <Group>
        <Composer date={t} today={t} size="lg" />
      </Group>
      <div className="section">
        <Segmented className="j-tabs" label="Journal tabs" options={[['entries', `Entries${n ? ` (${n})` : ''}`], ['favorites', 'Favorites'], ['quotes', 'Quote library']]} value={tab} onChange={(k) => nav(k === 'entries' ? '/journal' : `/journal/${k}`)} />
      </div>
      <div className="jtab">
        {tab === 'entries' ? (
          <EntriesList favOnly={false} today={t} />
        ) : tab === 'favorites' ? (
          <>
            <Sec title="Entries" first />
            <EntriesList favOnly today={t} />
            <Sec title="Quotes" />
            <QuoteList favOnly />
          </>
        ) : (
          <QuoteList favOnly={false} />
        )}
      </div>
    </div>
  );
}
