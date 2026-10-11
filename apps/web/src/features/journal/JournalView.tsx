import { ago, fmtDate, QUOTE_THEMES, type JournalEntry, type Quote } from '@logbook/shared';
import { Shuffle, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useDaily, useJournalList, useJournalMutations, useQuotes } from '@/api/queries';
import { Button, Card, CardHead, ChipButton, Empty, IconButton, Loading, PageHeader, Segmented } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { Composer, EntryItem } from './JournalDaySection';
import './journal.css';

const Byline = ({ q }: { q: Quote }) =>
  q.author ? (
    <span className="by">
      <span className="by-author">{q.author}</span>
      {q.work ? <cite>{q.work}</cite> : null}
    </span>
  ) : null;

const MemoryCard = ({ today }: { today: string }) => {
  const daily = useDaily();
  const { another, patch } = useJournalMutations();
  const nav = useNavigate();
  const e = daily.data?.memory ?? null;
  return (
    <Card>
      <CardHead title="From your journal" />
      {daily.isPending && !daily.data ? (
        <Loading text="Loading your entries…" />
      ) : !e ? (
        <Empty>{daily.data?.pastCount ? 'Every past entry has been shown this month. New ones come back after 30 days.' : 'Entries you write will come back here on a random day, never more than once a month. Write your first one below.'}</Empty>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={e.id} className="stack" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="pick-when">
              {fmtDate('long', e.date)} · {ago(e.date, today)}
            </div>
            <blockquote className="pick-text">{e.text}</blockquote>
            <div className="pick-actions">
              <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
                <Star size={17} fill={e.fav ? 'currentColor' : 'none'} />
              </IconButton>
              <ChipButton onClick={() => another.mutate('memory')} disabled={another.isPending}>
                <Shuffle size={14} /> Another
              </ChipButton>
              <button type="button" className="link sm" onClick={() => nav(`/today/${e.date}`)}>
                Open that day
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Card>
  );
};

const QuoteCard = () => {
  const daily = useDaily();
  const { another, quotePrefs } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  return (
    <Card>
      <CardHead title="Today’s quote" />
      {daily.isPending && !daily.data ? (
        <Loading text="Loading quotes…" />
      ) : !q ? (
        <Empty>No quotes left to show.</Empty>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={q.id} className="stack" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <blockquote className={`quote-text ${q.text.length > 220 ? 'long' : ''}`}>“{q.text}”</blockquote>
            <div className="quote-by">
              <Byline q={q} />
              <span className="chip">{q.theme}</span>
            </div>
            <div className="pick-actions">
              <IconButton label={q.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${q.fav ? 'on' : ''}`} onClick={() => quotePrefs.mutate({ id: q.id, fav: !q.fav })}>
                <Star size={17} fill={q.fav ? 'currentColor' : 'none'} />
              </IconButton>
              <ChipButton onClick={() => another.mutate('quote')} disabled={another.isPending}>
                <Shuffle size={14} /> Another
              </ChipButton>
              {!q.mine ? (
                <button
                  type="button"
                  className="link sm quiet"
                  onClick={() => {
                    quotePrefs.mutate({ id: q.id, hidden: true });
                    another.mutate('quote');
                    toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
                  }}
                >
                  Don’t show again
                </button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Card>
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
    <div className="stack" style={{ gap: 12 }}>
      {!favOnly || entries.length > 5 ? <input className="in" type="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(40))} aria-label="Search entries" style={{ maxWidth: 420 }} /> : null}
      {list.isPending && !list.data ? (
        <Loading />
      ) : !entries.length ? (
        <Empty>{q ? `No entries match “${q.trim()}”.` : favOnly ? 'Tap the star on an entry to keep it here.' : 'No entries yet. Write one above or from any day.'}</Empty>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="day-group">
            <button type="button" className="day-label" onClick={() => nav(`/today/${g.date}`)}>
              {fmtDate('long', g.date)}
              <span>{ago(g.date, today)}</span>
            </button>
            <ul className="entries">
              {g.items.map((e) => (
                <EntryItem key={e.id} e={e} />
              ))}
            </ul>
          </div>
        ))
      )}
      {entries.length > limit ? (
        <Button variant="ghost" block onClick={() => setLimit((l) => l + 40)}>
          Show more ({entries.length - limit} older)
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
  return (
    <div className="stack" style={{ gap: 12 }}>
      {!favOnly ? (
        <div className="theme-chips">
          {themes.map((t) => (
            <ChipButton key={t} on={theme === t} onClick={() => (setTheme(t), setLimit(30))}>
              {t}
            </ChipButton>
          ))}
        </div>
      ) : null}
      <input className="in" type="search" placeholder="Search quotes, authors or books" value={q} onChange={(e) => (setQ(e.target.value), setLimit(30))} aria-label="Search quotes" style={{ maxWidth: 420 }} />
      {!favOnly ? (
        adding ? (
          <div className="stack" style={{ gap: 8, maxWidth: 560 }}>
            <textarea className="in" rows={2} maxLength={400} placeholder="e.g. You have to spend energy to make energy." aria-label="Quote" value={nt} onChange={(e) => setNt(e.target.value)} />
            <input className="in" maxLength={80} placeholder="Who said it (optional)" aria-label="Author" value={na} onChange={(e) => setNa(e.target.value)} />
            <div className="row">
              <Button
                size="sm"
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
                Add quote
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}>
            Add your own quote
          </button>
        )
      ) : null}
      {page.isPending && !page.data ? (
        <Loading text="Loading quotes…" />
      ) : (
        <>
          <div className="fine">
            {(page.data?.total ?? 0).toLocaleString()} {page.data?.total === 1 ? 'quote' : 'quotes'}
          </div>
          {!page.data?.quotes.length ? <Empty>{favOnly ? 'Star a quote to keep it here. Favorites come back every 14 days instead of 30.' : 'No quotes match.'}</Empty> : null}
          <ul className="quotes">
            {page.data?.quotes.map((x) => (
              <li key={x.id} className="qrow">
                <div className="q-main">
                  <p>“{x.text}”</p>
                  <span className="q-by">
                    <Byline q={x} />
                    <span className="q-theme">{x.theme}</span>
                  </span>
                </div>
                <div className="q-tools">
                  <IconButton label={x.fav ? 'Remove from favorites' : 'Favorite'} size="sm" className={`star ${x.fav ? 'on' : ''}`} onClick={() => quotePrefs.mutate({ id: x.id, fav: !x.fav })}>
                    <Star size={15} fill={x.fav ? 'currentColor' : 'none'} />
                  </IconButton>
                  {x.mine ? (
                    <button type="button" className="link sm quiet" onClick={() => removeQuote.mutate(x.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {(page.data?.total ?? 0) > limit ? (
            <Button variant="ghost" block onClick={() => setLimit((l) => l + 30)}>
              Show more
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
      <PageHeader eyebrow="Look back" title="Journal" sub="Write, look back, and a quote to start the day." />
      <div className="picks">
        <MemoryCard today={t} />
        <QuoteCard />
      </div>
      <Card>
        <CardHead title="Write" meta={`Saved to ${fmtDate('short', t)}`} />
        <Composer date={t} today={t} hint="⌘/Ctrl + Enter saves" />
      </Card>
      <Card>
        <Segmented className="j-tabs" label="Journal tabs" options={[['entries', `Entries${n ? ` (${n})` : ''}`], ['favorites', 'Favorites'], ['quotes', 'Quote library']]} value={tab} onChange={(k) => nav(k === 'entries' ? '/journal' : `/journal/${k}`)} />
        {tab === 'entries' ? (
          <EntriesList favOnly={false} today={t} />
        ) : tab === 'favorites' ? (
          <div className="stack" style={{ gap: 14 }}>
            <h3 className="sub-title">Entries</h3>
            <EntriesList favOnly today={t} />
            <h3 className="sub-title">Quotes</h3>
            <QuoteList favOnly />
          </div>
        ) : (
          <QuoteList favOnly={false} />
        )}
      </Card>
    </div>
  );
}
