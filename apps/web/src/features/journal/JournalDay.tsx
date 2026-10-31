import { ago, fmtDate, monthOf, parseISO, type JournalEntry, type Quote } from '@logbook/shared';
import { ChevronRight, Shuffle } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useDaily, useGoals, useJournalList, useJournalMutations, useTodos } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Group, Pressable, Row, useSheet } from '@/ui';
import { useLog } from '../log/useLog';
import { useEnergy, setEnergy } from './energy';
import { dayFacts } from './facts';
import { Composer, EntryEditor, EntrySheet } from './JournalDaySection';
import { useDayPrompt } from './prompt';
import './journal.css';

const MD = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
/** "October 31" */
export const dayTitle = (d: string) => MD.format(parseISO(d));
/** The eyebrow over a day: TODAY, YESTERDAY, else the weekday. */
export const dayEyebrow = (d: string, today: string) => (d === today ? 'Today' : ago(d, today) === 'yesterday' ? 'Yesterday' : fmtDate('dowLong', d));

/** The five dots, 28 px each (44 px hits): one energy for the day. A second tap on the picked one clears it. */
export const EnergyDots = ({ date, value }: { date: string; value: number | null }) => (
  <div className="jenergy" role="radiogroup" aria-label="Energy, 1 to 5">
    <span className="caps">Energy</span>
    <span className="jenergy-dots">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} className={`jenergy-dot ${value != null && n <= value ? 'is-on' : ''}`} onClick={() => setEnergy(date, value === n ? null : n)}>
          <i aria-hidden="true" />
        </button>
      ))}
    </span>
  </div>
);

export interface JournalDayProps {
  date: string;
  today: string;
  /** What happened that day (facts.ts), already built. */
  facts: string[];
  entries: JournalEntry[];
  /** `row`: a preview in the month's list (tap opens the day). `quiet`: a day with facts but no entry, one 44 px line. `full`: the sheet. */
  variant: 'row' | 'quiet' | 'full';
  onOpen?: () => void;
  /** `full` only: the editor under the words. */
  children?: ReactNode;
}

/**
 * The day page (docs/system.md §2): the date as a 17/600 title under its weekday eyebrow, a facts line built from what
 * happened, then what you wrote in the serif. The same component is the row in the month's list and the whole of the day's
 * sheet; a day without an entry but with a run or a goal outcome is one quiet line, so the logbook is complete.
 */
export const JournalDay = memo(function JournalDay({ date, today, facts, entries, variant, onOpen, children }: JournalDayProps) {
  const factsLine = facts.length ? (
    <span className="jday-facts">
      {facts.map((f, i) => (
        <span key={i} className="jday-fact">
          {f}
        </span>
      ))}
    </span>
  ) : null;
  if (variant === 'quiet')
    return (
      <Pressable as="div" className="jday is-quiet" press="surface" onPress={onOpen} label={`${fmtDate('long', date)}. ${facts.join(', ')}. Open`}>
        <span className="caps jday-quiet-date">{date === today ? 'Today' : fmtDate('dow', date)} {parseISO(date).getDate()}</span>
        {factsLine}
      </Pressable>
    );
  if (variant === 'row') {
    const text = entries.map((e) => e.text).join('\n\n');
    return (
      <Pressable as="div" className={`jday is-row ${entries.length ? '' : 'is-empty'}`} press="surface" onPress={onOpen} label={`${fmtDate('long', date)}${facts.length ? `. ${facts.join(', ')}` : ''}. ${text || 'Write today’s entry'}`}>
        <span className="jday-head">
          <span className="caps jday-eyebrow">{dayEyebrow(date, today)}</span>
          <span className="jday-title">{dayTitle(date)}</span>
        </span>
        {factsLine}
        {entries.length ? <span className="jday-text serif clamp">{text}</span> : <span className="jday-write">Write today’s entry</span>}
        <ChevronRight size={16} className="jday-chev" aria-hidden="true" />
      </Pressable>
    );
  }
  return (
    <div className="jday is-full">
      {factsLine ?? <span className="jday-facts is-none">Nothing logged for this day.</span>}
      {entries.length ? (
        <div className="jday-entries">
          {entries.map((e) => (
            <p key={e.id} className="jday-text serif">
              {e.text}
            </p>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
});

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/**
 * The quote of the day: one tappable serif line inside the editor's placeholder area, from the daily endpoint. A tap
 * shuffles it; hold for "Use as a prompt" (the words go on top of the entry) when `onInsert` is given. On Today's Close card
 * (`features/day/CloseDay.tsx`, which passes `onInsert`) the tap still inserts, as it did.
 */
export const QuoteLine = ({ date, onInsert, tapInserts }: { date: string; onInsert?: (text: string) => void; tapInserts?: boolean }): React.JSX.Element | null => {
  const daily = useDaily();
  const { another } = useJournalMutations();
  const q = daily.data?.quote ?? null;
  if (!q) return null;
  const inserts = onInsert && (tapInserts ?? true);
  const shuffle = () => another.mutate('quote');
  return (
    <Pressable
      className="qline"
      press="dim"
      data-date={date}
      onPress={() => (inserts ? onInsert!(asPrompt(q)) : shuffle())}
      holdMenu={[{ label: 'Another quote', icon: <Shuffle size={18} />, onSelect: shuffle }, ...(onInsert && !inserts ? [{ label: 'Use as a prompt', onSelect: () => onInsert(asPrompt(q)) }] : [])]}
      menuLabel="Quote of the day"
      label={`Quote of the day: ${q.text}${q.author ? `, ${q.author}` : ''}. ${inserts ? 'Use as a prompt' : 'Another quote'}`}
    >
      <span className="qline-text serif">“{q.text}”</span>
      {q.author ? <span className="qline-by">{q.author}</span> : null}
    </Pressable>
  );
};

/** The same date in an earlier year with an entry, from the cached list of entries (the newest 200). Null when none. */
const useOnThisDay = (date: string) => {
  const list = useJournalList('', false);
  const md = date.slice(5);
  const y = date.slice(0, 4);
  return (list.data?.entries ?? []).filter((e) => e.date.slice(5) === md && e.date.slice(0, 4) < y).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
};

/**
 * The day's sheet: the day page in full, the energy pick, and the editor under it: the composer for a day with nothing
 * written (the quote of the day as its prompt line), the entry's own editor for a day with one, a row per entry for more.
 * A year ago sits under it when that date in an earlier year has an entry.
 */
export const JournalDaySheet = ({ date }: { date: string }) => {
  const today = useToday();
  const sheet = useSheet();
  const log = useLog([monthOf(date)]);
  const goals = useGoals();
  const todos = useTodos();
  const energy = useEnergy(date);
  const placeholder = useDayPrompt(date);
  const memory = useOnThisDay(date);
  const open = useOpenJournalDay();
  const entries = log.snap.journalOn(date);
  const facts = log.loaded(date) ? dayFacts({ snap: log.snap, date, habits: log.habits, goals: goals.data, todos: todos.data }) : [];
  const years = memory ? parseISO(date).getFullYear() - parseISO(memory.date).getFullYear() : 0;
  return (
    <div className="jsheet">
      <JournalDay date={date} today={today} facts={facts} entries={entries} variant="full">
        <EnergyDots date={date} value={energy} />
      </JournalDay>
      {entries.length === 0 ? (
        <Group className="jsheet-compose">
          <Composer date={date} today={today} rows={4} placeholder={placeholder} autoFocus={date === today} prompt={(insert) => <QuoteLine date={date} onInsert={insert} tapInserts={false} />} />
        </Group>
      ) : entries.length === 1 ? (
        <EntryEditor e={entries[0]!} onDone={() => sheet.close()} />
      ) : (
        <Group>
          {entries.map((e) => (
            <Row key={e.id} title={<span className="serif jsheet-rowtext">{e.text}</span>} right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => sheet.push({ eyebrow: dayEyebrow(date, today), title: 'Edit', body: <EntrySheet e={e} />, detent: 'large' })} label={`Edit: ${e.text}`} />
          ))}
          <Composer date={date} today={today} rows={2} placeholder="Add to this day" />
        </Group>
      )}
      {memory ? (
        <Group className="jsheet-memory">
          <Row title={years === 1 ? 'A year ago' : `${years} years ago`} sub={memory.text} right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => open(memory.date, 'push')} />
        </Group>
      ) : null}
    </div>
  );
};

/** Open a day's sheet (large), or push it inside an open one. */
export const useOpenJournalDay = () => {
  const sheet = useSheet();
  const today = useToday();
  return (date: string, how: 'open' | 'push' = 'open') => {
    const spec = { eyebrow: `${dayEyebrow(date, today)}${date !== today ? ` · ${ago(date, today)}` : ''}`, title: dayTitle(date), body: <JournalDaySheet date={date} />, detent: 'large' as const, detents: ['large' as const], sticky: true };
    if (how === 'push') sheet.push(spec);
    else sheet.open(spec);
  };
};
