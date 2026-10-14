import { ago, eachDay, fmtDate, parseISO, shiftDays, type JournalEntry, type Quote } from '@logbook/shared';
import { BookOpen, CalendarDays, EyeOff, PenLine, Search, Share, Shuffle, Star, Trash2, X } from 'lucide-react';
import { animate, AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDaily, useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { fadeIn, rowPresence, springs, useReduced } from '@/lib/motion';
import { Button, ContextMenu, EmptyState, IconButton, Section, Skeleton, SkeletonGroup, SwipeRow, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { Composer, EntryEditor, monthsOf, timeOf, useEntryActions, useOpenDay, useOpenEntry } from './JournalDaySection';
import { bumpHint, readHint, useCardSwipe, useSlideSwap } from './gestures';
import { GhostLines } from './Ghost';
import { runStamp, useDayPrompt } from './prompt';

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/** The quote, whole, as the context menu lifts it. */
const QuotePreview = ({ q }: { q: Quote }) => (
  <div className="qpreview">
    <p className="qpreview-text">“{q.text}”</p>
    {q.author ? (
      <p className="qpreview-by">
        {q.author}
        {q.work ? <cite> · {q.work}</cite> : null}
      </p>
    ) : null}
  </div>
);

/**
 * The quote of the day as an optional prompt line inside the composer (serif 17, ink-3). Tap: it goes into the entry as a
 * prompt. Swipe sideways: another quote; the line keeps going the way it was swiped and the next one slides in from the
 * other side once it has gone (a pager, never a cross-dissolve). Hold: Favourite, Hide, Open in library (and the tap and
 * swipe again, as fallbacks). Taught once: the line nudges left and back and says so under itself, for the first visits.
 */
const QuoteLine = ({ insert, text, onOpenInLibrary }: { insert: (s: string) => void; text: string; onOpenInLibrary: (q: Quote) => void }) => {
  const daily = useDaily();
  const { another, quotePrefs } = useJournalMutations();
  const toast = useToast();
  const reduce = useReduced();
  const live = daily.data?.quote ?? null;
  const latest = useRef(live);
  latest.current = live;
  // what the line shows: the day's quote, except while one is leaving and the next is on its way
  const [q, setQ] = useState(live);
  const sliding = useRef(false);
  useEffect(() => {
    if (!sliding.current) setQ(live);
  }, [live]);
  const [hint] = useState(() => readHint('quote-line'));
  const btn = useRef<HTMLButtonElement>(null);
  const shuffleRef = useRef<(d: -1 | 1) => void>(() => undefined);
  const swipe = useCardSwipe((d) => shuffleRef.current(d), !!q);
  const slide = useSlideSwap(swipe.x, btn);
  const shuffle = async (d: -1 | 1) => {
    if (sliding.current) return;
    sliding.current = true;
    bumpHint('quote-line', 9);
    const gone = slide.out(d);
    try {
      await another.mutateAsync('quote');
      await gone;
      setQ(latest.current);
      slide.in(d);
    } catch {
      await gone;
      slide.back();
      toast('Couldn’t find another quote.');
    } finally {
      sliding.current = false;
    }
  };
  shuffleRef.current = (d) => void shuffle(d);
  // the one-time nudge: 24px left and home, so the line reads as something that moves
  useEffect(() => {
    if (!hint || reduce || !q) return;
    bumpHint('quote-line');
    const t = setTimeout(() => void animate(swipe.x, -24, springs.settle).then(() => animate(swipe.x, 0, springs.settle)), 900);
    return () => clearTimeout(t);
  }, [!!q]); // eslint-disable-line react-hooks/exhaustive-deps
  if (daily.isPending && !daily.data)
    return (
      <div className="qline-wrap">
        <Skeleton h={16} w="72%" className="qline-skel" />
      </div>
    );
  if (!q) return null;
  const used = text.includes(q.text.slice(0, 60));
  const hide = () => {
    haptics.delete();
    quotePrefs.mutate({ id: q.id, hidden: true });
    void shuffle(1);
    toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
  };
  return (
    <AnimatePresence initial={false}>
      {used ? null : (
        <motion.div key="qline" className="qline-wrap" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: { height: springs.settle, opacity: fadeIn } }} exit={{ height: 0, opacity: 0, transition: { height: springs.settle, opacity: { duration: 0.1 } } }}>
          <ContextMenu
            label="Today’s quote"
            preview={<QuotePreview q={q} />}
            items={[
              { label: 'Use as a prompt', icon: <PenLine size={18} />, onSelect: () => insert(asPrompt(q)) },
              { label: 'Another quote', icon: <Shuffle size={18} />, onSelect: () => (haptics.select(), void shuffle(1)) },
              { label: q.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => (haptics.toggle(), quotePrefs.mutate({ id: q.id, fav: !q.fav })) },
              { label: 'Open in library', icon: <BookOpen size={18} />, onSelect: () => onOpenInLibrary(q) },
              ...(q.mine ? [] : [{ label: 'Hide', icon: <EyeOff size={18} />, onSelect: hide }]),
            ]}
          >
            <motion.button ref={btn} type="button" className={`qline ${another.isPending ? 'busy' : ''}`} aria-label={`Today’s quote: ${q.text}${q.author ? `, ${q.author}` : ''}. Use as a prompt`} onClick={() => insert(asPrompt(q))} onClickCapture={swipe.onClickCapture} {...swipe.props}>
              <motion.span key={q.id} className="qline-in" initial={reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <span className="qline-text">“{q.text}”</span>
                <span className="qline-by">
                  {q.fav ? <Star size={11} fill="currentColor" className="jfav" aria-hidden="true" /> : null}
                  {q.author || 'Unknown'}
                </span>
              </motion.span>
            </motion.button>
          </ContextMenu>
          {hint ? <p className="qline-hint">Tap to write from it. Swipe for another.</p> : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * The last 14 days as a ribbon of dots: filled where something was written, today ringed. Tap a dot for that day (its entry,
 * or a composer for it). Press and slide along the ribbon to scrub: each day steps with `haptics.select()` and the line
 * under it previews the day; let go to open it. Arrow keys move between days.
 */
const Ribbon = ({ today, byDate, onToday }: { today: string; byDate: Map<string, JournalEntry[]>; onToday: () => void }) => {
  const days = useMemo(() => eachDay(shiftDays(today, -13), today), [today]);
  const openDay = useOpenDay();
  const log = useLog(monthsOf(days));
  const ref = useRef<HTMLDivElement>(null);
  const dots = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState<number | null>(null);
  const scrub = useRef({ id: -1, x0: 0, y0: 0, on: false, i: -1 });
  const written = days.filter((d) => byDate.has(d)).length;
  const open = (i: number) => {
    const d = days[i]!;
    if (d === today && !byDate.has(d)) return onToday();
    const stamp = log.loaded(d) ? runStamp(log.snap, d) : null;
    openDay(d, byDate.get(d) ?? [], { from: dots.current[i]?.querySelector('.rdot'), stamp });
  };
  const indexAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(13, Math.floor(((clientX - r.left) / r.width) * 14)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    scrub.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, i: -1 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = scrub.current;
    if (e.pointerId !== s.id) return;
    if (!s.on) {
      const dx = Math.abs(e.clientX - s.x0);
      const dy = Math.abs(e.clientY - s.y0);
      if (dy > 10 && dy > dx) return void (s.id = -1);
      if (dx < 8) return;
      s.on = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* gone */
      }
    }
    const i = indexAt(e.clientX);
    if (i !== s.i) {
      s.i = i;
      haptics.select();
      setActive(i);
    }
  };
  const onPointerUp = () => {
    const s = scrub.current;
    s.id = -1;
    if (s.on && s.i >= 0) open(s.i);
    setActive(null);
  };
  const reduce = useReduced();
  const shown = active != null ? days[active]! : null;
  const preview = shown ? byDate.get(shown)?.[0] : null;
  return (
    <section className="ribbon-wrap" aria-label="The last 14 days">
      <div
        ref={ref}
        className={`ribbon ${active != null ? 'scrubbing' : ''}`}
        role="group"
        aria-label={`${written} of the last 14 days written`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => ((scrub.current.id = -1), setActive(null))}
        onClickCapture={(e) => {
          if (scrub.current.on) {
            scrub.current.on = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {days.map((d, i) => {
          const has = byDate.has(d);
          const isToday = d === today;
          return (
            <button
              key={d}
              ref={(el) => void (dots.current[i] = el)}
              type="button"
              className={`rday ${has ? 'has' : ''} ${isToday ? 'today' : ''} ${active === i ? 'on' : ''}`}
              aria-label={`${fmtDate('long', d)}${isToday ? ', today' : ''}. ${has ? `${byDate.get(d)!.length === 1 ? 'Written' : `${byDate.get(d)!.length} entries`}` : 'Nothing written'}`}
              tabIndex={isToday ? 0 : -1}
              onClick={() => open(i)}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const j = Math.max(0, Math.min(13, i + step));
                dots.current[j]?.focus();
              }}
              onFocus={(e) => {
                // a roving tab stop: the focused day is the one Tab returns to
                dots.current.forEach((b) => b && (b.tabIndex = b === e.currentTarget ? 0 : -1));
              }}
            >
              {/* a day that just got written pops its dot once (springs.complete); nothing moves on load */}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={has ? 'has' : 'not'} className="rdot" initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={reduce ? { duration: 0 } : springs.complete} />
              </AnimatePresence>
              <span className="rletter" aria-hidden="true">
                {fmtDate('dow', d).slice(0, 1)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="ribbon-cap" aria-hidden={shown ? 'true' : undefined}>
        {shown ? (
          <>
            <span className="ribbon-cap-date">{fmtDate('short', shown)}</span>
            <span className="ribbon-cap-text">{preview ? preview.text : shown === today ? 'Today. Write above.' : 'Nothing written. Let go to add it.'}</span>
          </>
        ) : written ? (
          <span>
            {written} of the last 14 days{byDate.has(today) ? ', today included.' : '.'}
          </span>
        ) : (
          <span>Each day you write lights a dot.</span>
        )}
      </p>
    </section>
  );
};

const yearsAgo = (d: string, today: string) => {
  const n = parseISO(today).getFullYear() - parseISO(d).getFullYear();
  return n === 1 ? 'A year ago' : `${n} years ago`;
};

/**
 * A memory must be at least this old, and not one of the newest entries the timeline already shows (critic B11: "not
 * among the first 5"). Five is not enough when entries are one line each: at 390×844 the sixth row then sits on the same
 * screen as the card, so the card skips the newest eight (about a screen of one-line rows below it).
 */
export const MEMORY_MIN_DAYS = 14;
export const MEMORY_SKIP_NEWEST = 8;
/** A small stable number for a string: the day's pick among the entries that qualify. */
const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
/**
 * The entries the memory card may show: written at least two weeks ago and not among the first five of the timeline,
 * so the card never repeats a row that sits under it. Oldest first.
 */
export const memoryPool = (all: JournalEntry[], today: string) => {
  const newest = new Set(all.slice(0, MEMORY_SKIP_NEWEST).map((e) => e.id));
  const cutoff = shiftDays(today, -MEMORY_MIN_DAYS);
  return all.filter((e) => e.date <= cutoff && !newest.has(e.id)).reverse();
};

/**
 * "On this day" (an entry from this date in an earlier year) or "From your journal" (the daily memory), as one card, only
 * when there is an entry old enough to be a memory (see `memoryPool`); otherwise nothing at all. The server's daily memory
 * is used when it qualifies; else the day's pick among the entries that do. Swipe sideways (or "Another memory"): the card
 * leaves the way it was swiped and the next comes in from the other side.
 */
const MemoryCard = ({ today, all }: { today: string; all: JournalEntry[] }) => {
  const daily = useDaily();
  const act = useEntryActions();
  const openEntry = useOpenEntry();
  const nav = useNavigate();
  const reduce = useReduced();
  const pool = useMemo(() => memoryPool(all, today), [all, today]);
  const ok = useMemo(() => new Set(pool.map((e) => e.id)), [pool]);
  const onThisDay = useMemo(() => pool.find((e) => e.date < today && e.date.slice(5) === today.slice(5)) ?? null, [pool, today]);
  const server = daily.data?.memory && ok.has(daily.data.memory.id) ? daily.data.memory : null;
  // how many times it has been shuffled today: 0 shows the server's (or the day's) pick, then the pool in turn
  const [turn, setTurn] = useState(0);
  const pick = (n: number) => {
    if (!pool.length) return null;
    if (n === 0 && server) return server;
    const start = server ? pool.findIndex((e) => e.id === server.id) : seedOf(today) % pool.length;
    return pool[(start + n + pool.length) % pool.length]!;
  };
  const e = onThisDay ?? pick(turn);
  const log = useLog(e ? monthsOf([e.date]) : []);
  const card = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const shuffleRef = useRef<(d: -1 | 1) => void>(() => undefined);
  const swipe = useCardSwipe((d) => shuffleRef.current(d), !onThisDay && pool.length > 1);
  const slide = useSlideSwap(swipe.x, card);
  shuffleRef.current = (d) => {
    if (busy.current) return;
    busy.current = true;
    void slide.out(d).then(() => {
      setTurn((t) => t + d);
      slide.in(d);
      busy.current = false;
    });
  };
  if (!e) return null;
  const stamp = log.loaded(e.date) ? runStamp(log.snap, e.date) : null;
  const kicker = onThisDay ? `On this day · ${parseISO(e.date).getFullYear()}` : 'From your journal';
  return (
    <ContextMenu
      label="Memory"
      items={[
        ...(onThisDay || pool.length < 2 ? [] : [{ label: 'Another memory', icon: <Shuffle size={18} />, onSelect: () => (haptics.select(), shuffleRef.current(1)) }]),
        { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
        { label: 'Open the day', icon: <CalendarDays size={18} />, onSelect: () => nav(`/today/${e.date}`) },
        { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
      ]}
    >
      <div className="jmem-clip">
        <motion.section ref={card} className="jmem-card" aria-label={kicker} onClickCapture={swipe.onClickCapture} {...swipe.props}>
          <div className="jmem-top">
            <span className="caps">{kicker}</span>
            <span className="caps jmem-ago">{onThisDay ? yearsAgo(e.date, today) : ago(e.date, today)}</span>
          </div>
          <motion.button
            key={e.id}
            type="button"
            className="jmem-open"
            initial={reduce ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={(ev) => openEntry(e, { from: ev.currentTarget.querySelector('.jmem-date'), stamp })}
          >
            <span className="memory-text clamp">{e.text}</span>
            <span className="jmem-foot">
              <span className="caps jmem-date">{fmtDate('long', e.date)}</span>
              {stamp ? <span className="jstamp">{stamp}</span> : null}
              {e.fav ? <Star size={12} fill="currentColor" className="jfav" aria-label="Favourite" /> : null}
            </span>
          </motion.button>
        </motion.section>
      </div>
    </ContextMenu>
  );
};

/** A provisional id that the server replaces keeps its row (and its key), so the row doesn't leave and come back. */
const useStableKeys = (entries: JournalEntry[]) => {
  const keys = useRef(new Map<string, string>());
  const prev = useRef<JournalEntry[]>([]);
  const gone = prev.current.filter((p) => p.id.startsWith('tmp-') && !entries.some((e) => e.id === p.id));
  for (const e of entries) {
    if (keys.current.has(e.id)) continue;
    const was = gone.find((g) => g.text === e.text && g.date === e.date);
    keys.current.set(e.id, was ? (keys.current.get(was.id) ?? was.id) : e.id);
  }
  prev.current = entries;
  return (id: string) => keys.current.get(id) ?? id;
};

const PAGE = 30;
/**
 * Every entry, newest first, edge to edge. The date stands at the left of a day's first entry; a day with a run wears the
 * run's name as a stamp. Tap: the entry. Swipe left: Delete (with Undo). Hold: Edit, Favourite, Share, Delete.
 */
const Timeline = ({ today, all, loading, onWrite }: { today: string; all: JournalEntry[]; loading: boolean; onWrite: () => void }) => {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const found = useJournalList(q.trim(), false);
  const list = q.trim() ? (found.data?.entries ?? []) : all;
  const shown = list.slice(0, limit);
  const log = useLog(monthsOf(shown.map((e) => e.date)));
  const keyOf = useStableKeys(shown);
  const act = useEntryActions();
  const openEntry = useOpenEntry();
  const sheet = useSheet();
  const search = useRef<HTMLInputElement>(null);
  const stampOf = (d: string) => (log.loaded(d) ? runStamp(log.snap, d) : null);
  return (
    <Section
      title="Entries"
      meta={all.length || undefined}
      level="primary"
      className="jtl-sec"
      action={
        all.length > 3 ? (
          <IconButton
            label={searching ? 'Close search' : 'Search entries'}
            onClick={() => {
              if (searching) setQ('');
              setSearching((s) => !s);
              if (!searching) requestAnimationFrame(() => search.current?.focus());
            }}
          >
            {searching ? <X size={20} /> : <Search size={20} />}
          </IconButton>
        ) : undefined
      }
    >
      <AnimatePresence initial={false}>
        {searching ? (
          <motion.div key="search" className="jtl-search" {...rowPresence}>
            <input ref={search} className="in" type="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="Search entries" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {loading ? (
        <SkeletonGroup label="Loading your entries" className="jtl-skel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="jtl-skel-row">
              <Skeleton w={28} h={22} />
              <div style={{ display: 'grid', gap: 8, flex: 1 }}>
                <Skeleton w={`${88 - i * 14}%`} h={16} />
                <Skeleton w={`${60 - i * 8}%`} h={16} />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : !all.length ? (
        <EmptyState
          ghost={<GhostLines rows={3} lead />}
          verb={{ label: 'Write today’s', onPress: onWrite }}
        >
          Two sentences a day. Every one lands here, newest first.
        </EmptyState>
      ) : q.trim() && !list.length && !found.isPending ? (
        <EmptyState verb={{ label: 'Clear the search', onPress: () => setQ('') }}>Nothing you wrote says “{q.trim()}”.</EmptyState>
      ) : (
        <div className="jtl" role="list">
          <AnimatePresence initial={false}>
            {shown.map((e, i) => {
              const first = i === 0 || shown[i - 1]!.date !== e.date;
              const stamp = first ? stampOf(e.date) : null;
              return (
                <motion.div key={keyOf(e.id)} role="listitem" className={`jtl-item ${first ? 'first' : ''}`} {...rowPresence}>
                  <SwipeRow
                    label={`Entry from ${fmtDate('short', e.date)}`}
                    left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
                    menuItems={[
                      { label: 'Edit', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: fmtDate('short', e.date), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
                      { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
                      { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
                    ]}
                  >
                    <button
                      type="button"
                      className="jtl-row"
                      aria-label={`${fmtDate('long', e.date)}, ${timeOf(e.createdAt)}${stamp ? `, ${stamp}` : ''}${e.fav ? ', favourite' : ''}. ${e.text}`}
                      onClick={(ev) => openEntry(e, { from: ev.currentTarget.querySelector('.jtl-date-shared'), stamp: stampOf(e.date) })}
                    >
                      <span className="jtl-date" aria-hidden="true">
                        {first ? (
                          <span className="jtl-date-shared">
                            <span className="jtl-day">{parseISO(e.date).getDate()}</span>
                            <span className="caps">{e.date === today ? 'Today' : fmtDate('dow', e.date)}</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="jtl-body" aria-hidden="true">
                        <span className="jtl-text">{e.text}</span>
                        <span className="jtl-meta">
                          {first && e.date.slice(0, 7) !== today.slice(0, 7) ? <span className="caps">{e.date.slice(0, 4) !== today.slice(0, 4) ? fmtDate('month', e.date) : fmtDate('monthShort', e.date)}</span> : null}
                          <span className="caps">{timeOf(e.createdAt)}</span>
                          {stamp ? <span className="jstamp">{stamp}</span> : null}
                          {e.fav ? <Star size={11} fill="currentColor" className="jfav" /> : null}
                        </span>
                      </span>
                    </button>
                  </SwipeRow>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      {list.length > limit ? (
        <Button variant="quiet" block className="jtl-more" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, list.length - limit)} older
        </Button>
      ) : null}
    </Section>
  );
};

/**
 * The Journal segment: write first (the composer, open, its placeholder built from the day, the quote of the day inside it
 * as a prompt line), then memory (the 14-day ribbon, on this day / from your journal), then every entry.
 */
export const JournalHome = ({ today, onOpenQuote, focusOnMount }: { today: string; onOpenQuote: (q: Quote) => void; focusOnMount?: boolean }) => {
  const placeholder = useDayPrompt(today);
  const list = useJournalList('', false);
  const all = useMemo(() => list.data?.entries ?? [], [list.data]);
  const byDate = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of all) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [all]);
  const input = useRef<HTMLTextAreaElement>(null);
  const card = useRef<HTMLElement>(null);
  const write = () => {
    card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!focusOnMount) return;
    // after the segment has slid in and any closing sheet has let go of the page (it is inert until then)
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const el = input.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollIntoView({ block: 'center' });
      } else if (tries++ < 10) t = setTimeout(attempt, 150);
    };
    t = setTimeout(attempt, 380);
    return () => clearTimeout(t);
  }, [focusOnMount]);
  return (
    <div className="jhome">
      <section ref={card} className="jcompose" aria-label="Write today’s entry">
        <Composer date={today} today={today} size="lg" rows={3} toast={false} placeholder={placeholder} inputRef={input} label={`Today’s entry. ${placeholder}`} prompt={(insert, text) => <QuoteLine insert={insert} text={text} onOpenInLibrary={onOpenQuote} />} />
      </section>
      <Ribbon today={today} byDate={byDate} onToday={write} />
      <MemoryCard today={today} all={all} />
      <Timeline today={today} all={all} loading={list.isPending && !list.data} onWrite={write} />
    </div>
  );
};

