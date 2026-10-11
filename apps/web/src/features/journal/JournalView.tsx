import { ago, fmtDate, QUOTE_THEMES, type JournalEntry, type Quote } from '@logbook/shared';
import { ChevronRight, Shuffle, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useDaily, useJournalList, useJournalMutations, useQuotes } from '@/api/queries';
import { Button, Chip, ChipButton, EmptyState, Group, IconButton, Loading, PageHeader, SectionHead, Segmented } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { Composer, EntryItem } from './JournalDaySection';
import './journal.css';

const Byline = ({ q, big }: { q: Quote; big?: boolean }) =>
  q.author ? (
    <span className={`by ${big ? 'big' : ''}`}>
      <span className="by-author">{q.author}</span>
      {q.work ? <cite className="serif">{q.work}</cite> : null}
    </span>
  ) : null;

/** Serif body text clamped to ~8 lines, with a Read more that lets it out. */
const ClampedText = ({ text, id }: { text: string; id: string }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    setOpen(false);
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [id]);
  return (
    <>
      <p ref={ref} className={`memory-text serif t-body ${open ? '' : 'clamp'}`}>
        {text}
      </p>
      {overflows ? (
        <button type="button" className="link sm" style={{ justifySelf: 'start' }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </>
  );
};

const MemoryCard = ({ today }: { today: string }) => {
  const daily = useDaily();
  const { another, patch } = useJournalMutations();
  const nav = useNavigate();
  const e = daily.data?.memory ?? null;
  return (
    <>
      <SectionHead first title="From your journal" />
      <Group className="jhero">
        {daily.isPending && !daily.data ? (
          <Loading text="Loading your entries…" />
        ) : !e ? (
          <EmptyState>{daily.data?.pastCount ? 'Every past entry has been shown this month. New ones come back after 30 days.' : 'Entries you write come back here on a random day, never more than once a month. Write your first one below.'}</EmptyState>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={e.id} className="jhero-body" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <span className="t-cap muted">
                {fmtDate('long', e.date)} · {ago(e.date, today)}
              </span>
              <ClampedText text={e.text} id={e.id} />
              <div className="jhero-actions">
                <ChipButton onClick={() => another.mutate('memory')} disabled={another.isPending}>
                  <Shuffle size={14} /> Another
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

const QuoteCard = () => {
  const daily = useDaily();
  const { another, quotePrefs } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  return (
    <>
      <SectionHead title="Today’s quote" />
      <Group className="jhero">
        {daily.isPending && !daily.data ? (
          <Loading text="Loading quotes…" />
        ) : !q ? (
          <EmptyState>No quotes left to show. Star a few in the library and they come back sooner.</EmptyState>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={q.id} className="jhero-body" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <blockquote className={`quote-text serif ${q.text.length > 160 ? 'long' : ''}`}>“{q.text}”</blockquote>
              <div className="quote-by">
                <Byline q={q} big />
                <Chip>{q.theme}</Chip>
              </div>
              <div className="jhero-actions">
                <ChipButton onClick={() => another.mutate('quote')} disabled={another.isPending}>
                  <Shuffle size={14} /> Another
                </ChipButton>
                {!q.mine ? (
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
                <IconButton label={q.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${q.fav ? 'on' : ''}`} onClick={() => quotePrefs.mutate({ id: q.id, fav: !q.fav })}>
                  <Star size={18} fill={q.fav ? 'currentColor' : 'none'} />
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
          <Loading />
        </Group>
      ) : !entries.length ? (
        <Group>
          <EmptyState>{q ? `No entries match “${q.trim()}”.` : favOnly ? 'Tap the star on an entry to keep it here.' : 'No entries yet. Write one above or from any day.'}</EmptyState>
        </Group>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="day-group">
            <button type="button" className="day-head" onClick={() => nav(`/today/${g.date}`)} aria-label={`Open ${fmtDate('long', g.date)}`}>
              <span className="t-label">{fmtDate('long', g.date)}</span>
              <span className="t-cap muted">{ago(g.date, today)}</span>
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
        <Button variant="ghost" block onClick={() => setLimit((l) => l + 40)} aria-label={`Show ${entries.length - limit} older entries`}>
          More
        </Button>
      ) : null}
    </div>
  );
};

const QuoteList = ({ favOnly }: { favOnly: boolean }) => {
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
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={nt.trim().length < 3}
                onClick={() => {
                  addQuote.mutate({ text: nt.trim(), author: na.trim() });
                  setNt('');
                  setNa('');
                  setAdding(false);
                  toast('Added to your quotes and favorites');
                }}
              >
                Add
              </Button>
            </div>
          </Group>
        ) : (
          <Button variant="ghost" style={{ justifySelf: 'start', marginLeft: -16 }} onClick={() => setAdding(true)}>
            Add
          </Button>
        )
      ) : null}
      {page.isPending && !page.data ? (
        <Group>
          <Loading text="Loading quotes…" />
        </Group>
      ) : (
        <>
          {total ? (
            <p className="t-cap muted jcount">
              {total.toLocaleString()} {total === 1 ? 'quote' : 'quotes'}
            </p>
          ) : null}
          <Group>
            {!page.data?.quotes.length ? <EmptyState>{favOnly ? 'Star a quote to keep it here. Favorites come back every 14 days instead of 30.' : 'No quotes match.'}</EmptyState> : null}
            {page.data?.quotes.map((x) => (
              <div key={x.id} className="qrow">
                <div className="q-main">
                  <p className="serif">“{x.text}”</p>
                  <span className="t-cap muted q-by">
                    <Byline q={x} />
                    <span className="q-theme">{x.theme}</span>
                  </span>
                </div>
                <div className="q-tools">
                  <IconButton label={x.fav ? 'Remove from favorites' : 'Favorite'} size="sm" className={`star ${x.fav ? 'on' : ''}`} onClick={() => quotePrefs.mutate({ id: x.id, fav: !x.fav })}>
                    <Star size={15} fill={x.fav ? 'currentColor' : 'none'} />
                  </IconButton>
                  {x.mine ? (
                    <IconButton label="Delete quote" size="sm" onClick={() => removeQuote.mutate(x.id)}>
                      <Trash2 size={15} />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            ))}
          </Group>
          {total > limit ? (
            <Button variant="ghost" block onClick={() => setLimit((l) => l + 30)} aria-label="Show more quotes">
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
      <div className="section" style={{ marginTop: 16 }}>
        <MemoryCard today={t} />
      </div>
      <QuoteCard />
      <SectionHead title="Write" meta={`Saved to ${fmtDate('short', t)}`} />
      <Group>
        <Composer date={t} today={t} hint="⌘/Ctrl + Enter saves" />
      </Group>
      <div className="section">
        <Segmented className="j-tabs" label="Journal tabs" options={[['entries', `Entries${n ? ` (${n})` : ''}`], ['favorites', 'Favorites'], ['quotes', 'Quote library']]} value={tab} onChange={(k) => nav(k === 'entries' ? '/journal' : `/journal/${k}`)} />
      </div>
      <div className="jtab">
        {tab === 'entries' ? (
          <EntriesList favOnly={false} today={t} />
        ) : tab === 'favorites' ? (
          <>
            <SectionHead first title="Entries" />
            <EntriesList favOnly today={t} />
            <SectionHead title="Quotes" />
            <QuoteList favOnly />
          </>
        ) : (
          <QuoteList favOnly={false} />
        )}
      </div>
    </div>
  );
}
