import type * as React from 'react';
import type { JournalEntry, Learning } from '@logbook/shared';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { Pressable } from '@/ui/Pressable';
import { KSection } from '../goals/Kit';
import { Line, monthName } from '../learned/LearnedParts';
import { daysWritten, snippet, writtenWords, type MonthRow } from './days';
import { FavStar } from './FavStar';
import { entryWhen, timeOf, upperFirst } from './JournalDaySection';
import { Marked } from './Marked';

/* The pieces the Journal tab, a month's page and the search share: an entry as a quiet row, today's rows, the months. */

/** Where a month's page lives: '/journal/2026-11'. */
export const monthPath = (month: string): string => `/journal/${month.slice(0, 7)}`;

/**
 * One entry as a quiet row: its opening in the journal's voice (three lines at most), then one Dusk line with when it was
 * written and a heart for a Favorite. A tap opens the entry's sheet (Edit, Favorite, Share, Delete with Undo). `q`: what
 * was searched for; the row then shows the part that holds it, marked.
 */
export const EntryRow = ({ e, onOpen, q, className = '' }: { e: JournalEntry; onOpen: (e: JournalEntry) => void; q?: string | null; className?: string }): React.JSX.Element => {
  const when = entryWhen(e);
  return (
    <Pressable as="button" className={`jn-erow ${className}`.trim()} press="surface" onPress={() => onOpen(e)} label={`Entry${when ? `, ${when}` : ''}${e.fav ? ', a Favorite' : ''}. ${e.text}`}>
      <span className="jn-erow-text" aria-hidden="true">
        <Marked text={q ? snippet(e.text, q) : e.text} q={q} />
      </span>
      <span className="jn-erow-meta" aria-hidden="true">
        <span>{upperFirst(when) || 'Entry'}</span>
        <FavStar on={e.fav} size={15} className="jtl-fav" />
      </span>
    </Pressable>
  );
};

/**
 * Today, under the poster: what was written today besides the headline, newest first, as rows of one inset group. An
 * entry is an `EntryRow`; a second line of the day is its words with "Line" and its time. Nothing written: no group at
 * all (the poster is the empty state).
 */
export const TodayRows = ({ entries, lines, onOpenEntry, onOpenLine }: { /** Today's entries, newest first. */ entries: JournalEntry[]; /** Today's lines after the first, in the order they were written. */ lines: Learning[]; onOpenEntry: (e: JournalEntry) => void; onOpenLine: (l: Learning) => void }): React.JSX.Element | null => {
  const rows = useMemo(() => [...entries.map((e) => ({ at: e.createdAt, e, l: null as Learning | null })), ...lines.map((l) => ({ at: l.createdAt, e: null as JournalEntry | null, l }))].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)), [entries, lines]);
  if (!rows.length) return null;
  const said = writtenWords(lines.length, entries.length);
  return (
    <KSection title="Today" meta={said} className="jn-today">
      <div className="k-rows jn-rows">
        {rows.map((r) =>
          r.e ? (
            <EntryRow key={`e:${r.e.id}`} e={r.e} onOpen={onOpenEntry} />
          ) : r.l ? (
            <div key={`l:${r.l.id}`} className="jn-lrow">
              <Line item={r.l} onOpen={onOpenLine} clamp />
              <span className="jn-erow-meta" aria-hidden="true">
                Line{timeOf(r.l.createdAt) ? ` · ${timeOf(r.l.createdAt)}` : ''}
              </span>
            </div>
          ) : null,
        )}
      </div>
    </KSection>
  );
};

/**
 * The archive: the months that hold something written, newest first, each one row (the book tile, the month, how many
 * days were written) and a tap from its own page. This year's months are one inset group with no heading; an earlier
 * year is a section under its own name and count. A month with nothing written has no row.
 */
export const Archive = ({ months, today }: { months: MonthRow[]; today: string }): React.JSX.Element => {
  const nav = useNav();
  const years = useMemo(() => {
    const out: Array<{ year: string; days: number; exact: boolean; months: MonthRow[] }> = [];
    for (const m of months) {
      const y = m.month.slice(0, 4);
      let cur = out[out.length - 1];
      if (!cur || cur.year !== y) out.push((cur = { year: y, days: 0, exact: true, months: [] }));
      cur.days += m.days;
      if (m.exact === false) cur.exact = false;
      cur.months.push(m);
    }
    return out;
  }, [months]);
  const thisYear = today.slice(0, 4);
  const rows = (y: (typeof years)[number]) => (
    <div className="k-rows has-icons ln-months">
      {y.months.map((m) => (
        <Pressable key={m.month} as="button" className="k-row ln-mrow" press="surface" onPress={() => nav.push(monthPath(m.month))} label={`${monthName(m.month)} ${y.year}, ${m.exact === false ? '' : `${daysWritten(m.days)}: `}${writtenWords(m.lines, m.entries)}. Open`}>
          <span className="icon-tile" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <span className="k-row-main" aria-hidden="true">
            <span className="k-row-title">{monthName(m.month)}</span>
          </span>
          <span className="k-row-end ln-mrow-meta" aria-hidden="true">
            {/* the days, when they are known for sure; else what is: how many lines and entries */}
            {m.exact === false ? writtenWords(m.lines, m.entries) : daysWritten(m.days)}
          </span>
          <ChevronRight size={18} aria-hidden="true" className="k-chev" />
        </Pressable>
      ))}
    </div>
  );
  return (
    <>
      {years.map((y) =>
        y.year === thisYear ? (
          <section key={y.year} className="ln-year is-now" aria-label={y.exact ? `${y.year}, ${daysWritten(y.days)}` : y.year}>
            {rows(y)}
          </section>
        ) : (
          <KSection key={y.year} title={y.year} meta={y.exact ? daysWritten(y.days) : undefined} className="ln-year">
            {rows(y)}
          </KSection>
        ),
      )}
    </>
  );
};
