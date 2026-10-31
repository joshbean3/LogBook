import { addMonths, eachDay, fmtDate, monthOf, shiftDays, type Aim, type JournalEntry } from '@logbook/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav, useRootRequest, useRouteParams, useTabScroller } from '@/app/NavController';
import { useGoals, useJournalList, useTodos } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Button, Card, ChipButton, EmptyState, Group, NavBar, Section } from '@/ui';
import { AskBar } from '../assistant/AskBar';
import { useLog } from '../log/useLog';
import { getEnergy, useEnergy } from './energy';
import { dayFacts, milesOn } from './facts';
import { JournalDay, useOpenJournalDay } from './JournalDay';
import { useRunDays } from './queries';
import './journal.css';

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const monthWords = (ym: string) => MONTH_LONG.format(new Date(`${ym}-01T12:00:00`));
const chipWords = (ym: string, today: string) => (ym.slice(0, 4) === today.slice(0, 4) ? MONTH.format(new Date(`${ym}-01T12:00:00`)) : `${MONTH.format(new Date(`${ym}-01T12:00:00`))} ’${ym.slice(2, 4)}`);
const lastDayOf = (ym: string) => shiftDays(addMonths(`${ym}-01`, 1), -1);
const isYM = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
/** How many months the list may reach back from the shown one before it stops offering more. */
const MAX_MONTHS = 36;

/**
 * The year as 52 columns × 7 rows of 6 px dots (the last 52 weeks, Monday at the top): an entry fills a dot in the accent, a
 * run day in `--ink-4`, nothing else. Tap a dot for its day. Entries come from the cached list, runs from one read of the
 * year's activities.
 */
const YearGrid = ({ today, entryDays, onOpen }: { today: string; entryDays: Set<string>; onOpen: (d: string) => void }) => {
  const end = shiftDays(today, 6 - ((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const start = shiftDays(end, -52 * 7 + 1);
  const runs = useRunDays(start, today);
  const runDays = useMemo(() => new Set(runs.data ?? []), [runs.data]);
  const days = useMemo(() => eachDay(start, end), [start, end]);
  const n = entryDays.size;
  return (
    <Card className="jyear" aria-label={`The last year: ${n} ${n === 1 ? 'entry' : 'entries'}`}>
      <div className="jyear-head">
        <span className="caps">Last 52 weeks</span>
        <span className="jyear-meta">
          {n} {n === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div className="jyear-grid" role="group" aria-label="Days">
        {days.map((d) => {
          const future = d > today;
          const has = entryDays.has(d);
          const ran = runDays.has(d);
          return <button key={d} type="button" className={`jyear-dot ${has ? 'is-entry' : ran ? 'is-run' : ''} ${future ? 'is-future' : ''}`} aria-label={`${fmtDate('long', d)}${has ? ', written' : ran ? ', ran' : ''}`} tabIndex={-1} disabled={future} onClick={() => onOpen(d)} />;
        })}
      </div>
    </Card>
  );
};

/** The days a month lists, newest first: any day with an entry, a run or a closed day goal; today always. */
const daysOf = (ym: string, today: string, snap: ReturnType<typeof useLog>['snap'], goals: readonly Aim[] | undefined) => {
  const last = lastDayOf(ym);
  const to = last > today ? today : last;
  if (to < `${ym}-01`) return [] as string[];
  return eachDay(`${ym}-01`, to)
    .reverse()
    .filter((d) => d === today || snap.journalOn(d).length > 0 || snap.runsOn(d).length > 0 || goals?.some((g) => g.level === 'day' && g.period === d && g.status !== 'open'));
};

const Month = ({ ym, today, log, goals, todos, query }: { ym: string; today: string; log: ReturnType<typeof useLog>; goals: readonly Aim[] | undefined; todos: ReturnType<typeof useTodos>['data']; query: string }) => {
  const open = useOpenJournalDay();
  // re-render on an energy change anywhere (the facts carry it)
  useEnergy(today);
  const loaded = log.loaded(ym);
  const days = useMemo(() => (loaded ? daysOf(ym, today, log.snap, goals) : []), [loaded, ym, today, log.snap, goals]);
  const q = query.trim().toLowerCase();
  const shown = q ? days.filter((d) => log.snap.journalOn(d).some((e) => e.text.toLowerCase().includes(q))) : days;
  const entries = days.reduce((a, d) => a + log.snap.journalOn(d).length, 0);
  const mi = Math.round(milesOn(log.snap, days));
  if (!loaded) return <Section title={monthWords(ym)} level="primary" />;
  if (q && !shown.length) return null;
  return (
    <Section title={monthWords(ym)} meta={[`${entries} ${entries === 1 ? 'entry' : 'entries'}`, mi ? `${mi} mi` : null].filter(Boolean).join(' · ')} level="primary">
      {shown.length ? (
        <Group className="jmonth">
          {shown.map((d) => {
            const list: JournalEntry[] = log.snap.journalOn(d);
            const facts = dayFacts({ snap: log.snap, date: d, habits: log.habits, goals, todos, energy: getEnergy(d) });
            return <JournalDay key={d} date={d} today={today} facts={facts} entries={list} variant={list.length || d === today ? 'row' : 'quiet'} onOpen={() => open(d)} />;
          })}
        </Group>
      ) : (
        <EmptyState>Nothing logged this month.</EmptyState>
      )}
    </Section>
  );
};

/**
 * Journal (docs/system.md §2): the logbook, a page per day built from what happened plus what you wrote, newest first under
 * month heads. A strip of the last twelve months jumps to one (`/journal/:ym` mirrors it); the list loads a month at a time
 * and reaches further back as you scroll. A search field filters the loaded entries. The year grid sits above the list.
 */
export default function JournalView() {
  const params = useRouteParams();
  const nav = useNav();
  const today = useToday();
  const scroller = useTabScroller();
  const open = useOpenJournalDay();
  const thisMonth = monthOf(today);
  const [anchor, setAnchor] = useState(() => (isYM(params.ym) ? params.ym : thisMonth));
  const [count, setCount] = useState(2);
  const [query, setQuery] = useState('');
  const months = useMemo(() => Array.from({ length: count }, (_, i) => monthOf(addMonths(`${anchor}-01`, -i))), [anchor, count]);
  const log = useLog(months);
  const goals = useGoals();
  const todos = useTodos();
  const chips = useMemo(() => Array.from({ length: 12 }, (_, i) => monthOf(addMonths(`${thisMonth}-01`, -i))), [thisMonth]);
  const jump = (ym: string, how: 'tap' | 'route' = 'tap') => {
    if (ym === anchor) return;
    setAnchor(ym);
    setCount(ym === thisMonth ? 2 : 1);
    if (how === 'tap') nav.replace(ym === thisMonth ? '/journal' : `/journal/${ym}`);
    const sc = scroller.current;
    if (sc) sc.scrollTop = 0;
  };
  const live = useRef(anchor);
  live.current = anchor;
  useRootRequest((p) => {
    const want = isYM(p.ym) ? p.ym : thisMonth;
    if (want !== live.current) jump(want, 'route');
  });

  // older months arrive as the end of the list comes into view
  const sentinel = useRef<HTMLDivElement>(null);
  const canMore = count < MAX_MONTHS;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canMore || !log.ready) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setCount((c) => Math.min(MAX_MONTHS, c + 1)), { root: scroller.current, rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [canMore, log.ready, scroller, count]);

  // the year grid's entry days: the loaded months (live, so a save lights its dot) plus the cached list for the rest
  const entryDays = useMemo(() => {
    const s = new Set<string>();
    for (const ym of months) for (const d of eachDay(`${ym}-01`, lastDayOf(ym) > today ? today : lastDayOf(ym))) if (log.snap.journalOn(d).length) s.add(d);
    return s;
  }, [months, log.snap, today]);

  return (
    <div className="page journal-page">
      <NavBar caps={{ cur: monthWords(anchor) }} title={{ cur: 'Journal' }} gap={24} />
      <AskBar date={today} context={{ tab: 'journal', date: today }} />
      <div className="jmonths" role="group" aria-label="Jump to a month">
        {chips.map((m) => (
          <ChipButton key={m} className={m === anchor ? 'is-on' : ''} aria-pressed={m === anchor} onClick={() => jump(m)}>
            {chipWords(m, today)}
          </ChipButton>
        ))}
      </div>
      <input className="in jsearch" type="search" placeholder="Search what you wrote" aria-label="Search entries" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!query.trim() ? <YearGridAll today={today} loadedDays={entryDays} onOpen={open} /> : null}
      {months.map((ym) => (
        <Month key={ym} ym={ym} today={today} log={log} goals={goals.data} todos={todos.data} query={query} />
      ))}
      <div ref={sentinel} className="jsentinel" aria-hidden="true" />
      {canMore ? (
        <Button variant="quiet" block className="jmore" onClick={() => setCount((c) => c + 1)}>
          Earlier
        </Button>
      ) : null}
    </div>
  );
}

/** The year grid's entry days: the loaded months, plus every date the cached entry list knows. */
const YearGridAll = ({ today, loadedDays, onOpen }: { today: string; loadedDays: Set<string>; onOpen: (d: string) => void }) => {
  const list = useJournalDates();
  const days = useMemo(() => new Set([...loadedDays, ...list]), [loadedDays, list]);
  return <YearGrid today={today} entryDays={days} onOpen={onOpen} />;
};

const useJournalDates = () => {
  const list = useJournalList('', false);
  return useMemo(() => (list.data?.entries ?? []).map((e) => e.date), [list.data]);
};
