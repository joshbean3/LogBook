import type * as React from 'react';
import { ago, eachDay, fmtDate, parseISO, shiftDays, type JournalEntry, type Quote } from '@logbook/shared';
import { CalendarDays, EyeOff, PenLine, Search, Share, Shuffle, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useDaily, useJournalList, useJournalMutations } from '@/api/queries';
import { HOLD_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { crossfade, springs, useReduced } from '@/lib/motion';
import { Button, EmptyState, IconButton, Pressable, Section, Skeleton, SkeletonGroup, SwipeRow, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { FavStar } from './FavStar';
import { PressButton } from './PressButton';
import { measureBelow, popFav, useListFlip } from './feel';
import { Composer, EntryEditor, monthsOf, timeOf, useEntryActions, useOpenDay, useOpenEntry } from './JournalDaySection';
import { runStamp, useDayPrompt } from './prompt';

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/**
 * The quote line (contracts §F, docs/feel.md §8): the day's quote as one quiet serif line, 44 tall (15/20 `--ink-3`). Tap:
 * the quote goes to `onInsert` as a prompt (`“…” (Author)`). Hold 450 ms: `Favourite · Hide`; Hide has Undo. No swipe. It
 * sits inside Journal's composer and the Close card's. `date` is the day the line sits on (the quote is the day's, `/daily`).
 * Favouriting has no star on the line, so the `toggle` lands when a star's pop would peak (`popFav`).
 */
export const QuoteLine = ({ date, onInsert }: { date: string; onInsert: (text: string) => void }): React.JSX.Element | null => {
  const daily = useDaily();
  const { quotePrefs, another } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  if (!q) return null;
  const items = [
    {
      label: q.fav ? 'Unfavourite' : 'Favourite',
      icon: <Star size={18} />,
      onSelect: () => {
        if (!q.fav) popFav();
        quotePrefs.mutate({ id: q.id, fav: !q.fav });
      },
    },
    ...(q.mine
      ? []
      : [
          {
            label: 'Hide',
            icon: <EyeOff size={18} />,
            destructive: true,
            onSelect: () => {
              haptics.delete();
              quotePrefs.mutate({ id: q.id, hidden: true });
              another.mutate('quote');
              toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
            },
          },
        ]),
  ];
  return (
    <Pressable className="qline quote-line" press="dim" data-date={date} onPress={() => onInsert(asPrompt(q))} holdMenu={items} menuLabel="Today’s quote" label={`Today’s quote: ${q.text}${q.author ? `, ${q.author}` : ''}. Use as a prompt`}>
      <span className="qline-in">
        <span className="qline-text">“{q.text}”</span>
      </span>
    </Pressable>
  );
};

/**
 * The last 14 days as a ribbon of dots: filled where something was written, today ringed. Each day is a 44px column, so the
 * ribbon scrolls sideways (snapping to days) and opens with today at its right edge. Tap a dot for that day (its entry, or a
 * composer for it). Hold a day and slide to scrub: each day steps with `haptics.select()`, the ribbon follows the finger to
 * its edges, and the line under it previews the day; let go to open it. A plain swipe just scrolls. With a mouse, press and
 * drag scrubs at once. Arrow keys move between days. The hold is the app's one clock (HOLD_MS, §11.2).
 */
const Ribbon = ({ today, byDate, onToday }: { today: string; byDate: Map<string, JournalEntry[]>; onToday: () => void }) => {
  const days = useMemo(() => eachDay(shiftDays(today, -13), today), [today]);
  const openDay = useOpenDay();
  const log = useLog(monthsOf(days));
  const ref = useRef<HTMLDivElement>(null);
  const dots = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState<number | null>(null);
  const scrub = useRef({ id: -1, x0: 0, y0: 0, on: false, i: -1, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const written = days.filter((d) => byDate.has(d)).length;
  // today sits at the right edge when the ribbon first shows (and when the day turns over)
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setMore(el.scrollLeft > 2);
  }, [today]);
  const open = (i: number) => {
    const d = days[i]!;
    if (d === today && !byDate.has(d)) return onToday();
    const stamp = log.loaded(d) ? runStamp(log.snap, d) : null;
    openDay(d, byDate.get(d) ?? [], { from: dots.current[i]?.querySelector('.rdot'), stamp });
  };
  /** The day under the finger, by the columns' own boxes (the ribbon may be scrolled); past either end, that end. */
  const indexAt = (clientX: number) => {
    let best = 0;
    for (let i = 0; i < days.length; i++) {
      const r = dots.current[i]?.getBoundingClientRect();
      if (!r) continue;
      if (clientX >= r.left) best = i;
    }
    return best;
  };
  const step = (clientX: number) => {
    const s = scrub.current;
    const i = indexAt(clientX);
    if (i === s.i) return;
    s.i = i;
    haptics.select();
    setActive(i);
    // the ribbon follows the finger: a day half under the edge slides into view
    dots.current[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const arm = (clientX: number) => {
    const s = scrub.current;
    s.on = true;
    s.i = -1;
    step(clientX);
  };
  const stopTimer = () => {
    const s = scrub.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = 0;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    stopTimer();
    scrub.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, i: -1, timer: 0 };
    // a finger scrubs after a short hold (a swipe scrolls the ribbon); a mouse scrubs as soon as it drags
    if (e.pointerType !== 'mouse') {
      const x = e.clientX;
      scrub.current.timer = setTimeout(() => {
        scrub.current.timer = 0;
        if (scrub.current.id === e.pointerId) arm(x);
      }, HOLD_MS);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = scrub.current;
    if (e.pointerId !== s.id) return;
    if (!s.on) {
      const dx = Math.abs(e.clientX - s.x0);
      const dy = Math.abs(e.clientY - s.y0);
      if (e.pointerType !== 'mouse') {
        // moved before the hold: it is a scroll, not a scrub
        if (dx > 8 || dy > 8) {
          stopTimer();
          s.id = -1;
        }
        return;
      }
      if (dy > 10 && dy > dx) return void (s.id = -1);
      if (dx < 8) return;
      s.on = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* gone */
      }
    }
    step(e.clientX);
  };
  const onPointerUp = () => {
    const s = scrub.current;
    stopTimer();
    s.id = -1;
    const i = s.i;
    // once: a touch scrub can end through both pointerup and touchend
    s.i = -1;
    if (s.on && i >= 0) open(i);
    setActive(null);
  };
  // while a finger scrubs, the ribbon must not scroll under it: a non-passive touchmove, attached inside this gesture's
  // touchstart and removed when it ends (nothing listens at rest, spec test 7)
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const move = (ev: TouchEvent) => {
      const s = scrub.current;
      if (!s.on) return;
      if (ev.touches[0]) step(ev.touches[0].clientX);
      if (ev.cancelable) ev.preventDefault();
    };
    const end = () => {
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  };
  const reduce = useReduced();
  const shown = active != null ? days[active]! : null;
  const preview = shown ? byDate.get(shown)?.[0] : null;
  return (
    <section className="ribbon-wrap" aria-label="The last 14 days">
      <div
        ref={ref}
        className={`ribbon ${active != null ? 'scrubbing' : ''} ${more ? 'has-more' : ''}`}
        onScroll={(e) => setMore(e.currentTarget.scrollLeft > 2)}
        role="group"
        aria-label={`${written} of the last 14 days written`}
        onTouchStart={onTouchStart}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          // the browser took the touch for a scroll: unless a scrub is under way, let it
          if (scrub.current.on) return;
          stopTimer();
          scrub.current.id = -1;
          setActive(null);
        }}
        onTouchEnd={() => {
          // a scrub that kept the touch (pointer events were cancelled by the scroll check) ends with the finger
          if (scrub.current.on) onPointerUp();
        }}
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
                const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!by) return;
                e.preventDefault();
                const j = Math.max(0, Math.min(13, i + by));
                dots.current[j]?.focus();
                dots.current[j]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
 * when there is an entry old enough to be a memory (see `memoryPool`); otherwise nothing at all. Tap: the entry. Hold:
 * Another memory · Favourite · Open the day · Share. A new memory crossfades in the same card (150 ms); no swipe.
 */
const MemoryCard = ({ today, all }: { today: string; all: JournalEntry[] }) => {
  const daily = useDaily();
  const act = useEntryActions();
  const openEntry = useOpenEntry();
  const nav = useNav();
  const reduce = useReduced();
  const pool = useMemo(() => memoryPool(all, today), [all, today]);
  const ok = useMemo(() => new Set(pool.map((e) => e.id)), [pool]);
  const onThisDay = useMemo(() => pool.find((e) => e.date < today && e.date.slice(5) === today.slice(5)) ?? null, [pool, today]);
  const server = daily.data?.memory && ok.has(daily.data.memory.id) ? daily.data.memory : null;
  // how many times it has been shuffled today: 0 shows the server's (or the day's) pick, then the pool in turn
  const [turn, setTurn] = useState(0);
  const card = useRef<HTMLElement>(null);
  const flip = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    flip.current?.();
    flip.current = null;
  }, [turn]);
  const pick = (n: number) => {
    if (!pool.length) return null;
    if (n === 0 && server) return server;
    const start = server ? pool.findIndex((e) => e.id === server.id) : seedOf(today) % pool.length;
    return pool[(start + n + pool.length) % pool.length]!;
  };
  // the card keeps what it shows until "Another memory" (a save above it must not re-pick it: nothing changes on its own)
  const shownId = useRef<{ turn: number; id: string } | null>(null);
  const kept = shownId.current && shownId.current.turn === turn ? (all.find((x) => x.id === shownId.current!.id) ?? null) : null;
  const e = onThisDay ?? kept ?? pick(turn);
  if (e && !onThisDay) shownId.current = { turn, id: e.id };
  const log = useLog(e ? monthsOf([e.date]) : []);
  if (!e) return null;
  const stamp = log.loaded(e.date) ? runStamp(log.snap, e.date) : null;
  const kicker = onThisDay ? `On this day · ${parseISO(e.date).getFullYear()}` : 'From your journal';
  const another = () => {
    // the card may change height: what is below rides the change on `settle` (§10.1)
    flip.current = measureBelow(card.current);
    setTurn((t) => t + 1);
  };
  return (
    <Pressable
      ref={card}
      as="div"
      className="jmem-card"
      press="scale"
      label={`${kicker}. ${e.text}`}
      onPress={(ev) => openEntry(e, { from: (ev.currentTarget as HTMLElement).querySelector('.jmem-date'), stamp })}
      menuLabel="Memory"
      holdMenu={[
        ...(onThisDay || pool.length < 2 ? [] : [{ label: 'Another memory', icon: <Shuffle size={18} />, onSelect: another }]),
        { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
        { label: 'Open the day', icon: <CalendarDays size={18} />, onSelect: () => nav.go(`/today/${e.date}`) },
        { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
      ]}
    >
      <span className="jmem-top">
        <span className="caps">{kicker}</span>
        <span className="caps jmem-ago">{onThisDay ? yearsAgo(e.date, today) : ago(e.date, today)}</span>
      </span>
      <motion.span key={e.id} className="jmem-open" initial={turn && !reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={crossfade}>
        <span className="memory-text clamp">{e.text}</span>
        <span className="jmem-foot">
          <span className="caps jmem-date">{fmtDate('long', e.date)}</span>
          {stamp ? <span className="jstamp">{stamp}</span> : null}
          <FavStar on={e.fav} size={12} label="Favourite" />
        </span>
      </motion.span>
    </Pressable>
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
 * run's name as a stamp. Tap: the entry. Swipe left: Delete (with Undo). Hold: Edit, Favourite, Share, Delete. The rows come
 * from the cache; the skeleton shows only with nothing cached and no network (newuser 3.5). A row that arrives fades in and
 * the rows it displaces ride a FLIP on `settle`; nothing animates height.
 */
const Timeline = ({ today, all, pending, onWrite }: { today: string; all: JournalEntry[]; pending: boolean; onWrite: () => void }) => {
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
  const rowsRef = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const flip = useRef<(() => void) | null>(null);
  // the field's carry first, then the list's FLIP (review 2 code N6): layout effects run in the order they are declared, so
  // when Close removes the field and the list changes in one commit, the rows measure where they are with the container
  // already carried, and each is carried only by its own move (not by the field's height twice)
  useLayoutEffect(() => {
    flip.current?.();
    flip.current = null;
  }, [searching]);
  useListFlip(rowsRef, shown.map((e) => keyOf(e.id)).join(','));
  const stampOf = (d: string) => (log.loaded(d) ? runStamp(log.snap, d) : null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
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
              flip.current = measureBelow(head.current);
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
      <div ref={head} className="jtl-anchor" aria-hidden="true" />
      {searching ? (
        <div className="jtl-search fade-in">
          <input ref={search} className="in" type="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="Search entries" />
        </div>
      ) : null}
      {pending ? (
        offline ? (
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
        ) : null
      ) : !all.length ? (
        // the sentence and its verb, no ghost rows: they read as the loading skeleton (review feel F10)
        <EmptyState verb={{ label: 'Write today’s', onPress: onWrite }}>
          Two sentences a day. Every one lands here, newest first.
        </EmptyState>
      ) : q.trim() && !list.length && !found.isPending ? (
        <EmptyState verb={{ label: 'Clear the search', onPress: () => setQ('') }}>Nothing you wrote says “{q.trim()}”.</EmptyState>
      ) : (
        <div ref={rowsRef} className="jtl" role="list">
          {shown.map((e, i) => {
            const first = i === 0 || shown[i - 1]!.date !== e.date;
            const stamp = first ? stampOf(e.date) : null;
            return (
              <div key={keyOf(e.id)} data-key={keyOf(e.id)} role="listitem" className={`jtl-item ${first ? 'first' : ''}`}>
                <SwipeRow
                  label={`Entry from ${fmtDate('short', e.date)}`}
                  left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
                  menuItems={[
                    { label: 'Edit', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: fmtDate('short', e.date), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
                    { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
                    { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
                  ]}
                >
                  <PressButton
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
                        <FavStar on={e.fav} />
                      </span>
                    </span>
                  </PressButton>
                </SwipeRow>
              </div>
            );
          })}
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
 * The Journal segment: write first (the composer, open, its placeholder built from the day, the day's quote line inside it
 * as a prompt), then memory (the 14-day ribbon, on this day / from your journal), then every entry. `focusKey` changing
 * (a quote sent here from the Library) focuses the composer once the segment's crossfade and any closing sheet are done.
 */
export const JournalHome = ({ today, focusKey = 0 }: { today: string; focusKey?: number }) => {
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
    if (!focusKey) return;
    // the page is inert until a closing sheet has let go of it: try again until the field takes the focus
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const el = input.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollIntoView({ block: 'center' });
      } else if (tries++ < 12) t = setTimeout(attempt, 100);
    };
    t = setTimeout(attempt, 160);
    return () => clearTimeout(t);
  }, [focusKey]);
  return (
    <div className="jhome">
      <section ref={card} className="jcompose" aria-label="Write today’s entry">
        <Composer date={today} today={today} size="lg" rows={3} placeholder={placeholder} inputRef={input} label={`Today’s entry. ${placeholder}`} grow="flip" prompt={(insert) => <QuoteLine date={today} onInsert={insert} />} />
      </section>
      <Ribbon today={today} byDate={byDate} onToday={write} />
      <MemoryCard today={today} all={all} />
      <Timeline today={today} all={all} pending={!list.data} onWrite={write} />
    </div>
  );
};
