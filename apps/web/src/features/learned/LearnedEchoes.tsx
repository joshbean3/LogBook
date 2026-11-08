import { addMonths, fmtDate, shiftDays, type Learning } from '@logbook/shared';
import { Pressable } from '@/ui/Pressable';
import { KSection } from '../goals/Kit';
import { useLearningEchoes } from './queries';

/** `Nov 10, 2025`: the year only when it is not this one. */
const dateWords = (d: string, today: string) => (d.slice(0, 4) === today.slice(0, 4) ? fmtDate('md', d) : `${fmtDate('md', d)}, ${d.slice(0, 4)}`);

/** The day a month back, as the server reads it (clamped to that month's end). */
const monthBack = (today: string) => {
  const first = addMonths(today, -1);
  const last = shiftDays(addMonths(first, 1), -1);
  const want = `${first.slice(0, 8)}${today.slice(8, 10)}`;
  return want > last ? last : want;
};

/**
 * "From your archive" (under the stats on the Learned tab): a small carousel of three cards, a year ago, a month ago and
 * one at random, each a tap from its sheet. A slot with nothing keeps its card, with a dash and the day it looked for.
 */
export const Echoes = ({ today, onOpen }: { today: string; onOpen: (l: Learning) => void }) => {
  const q = useLearningEchoes();
  const e = q.data;
  const slots: Array<{ key: string; caps: string; item: Learning | null | undefined; empty: string }> = [
    { key: 'year', caps: 'A year ago', item: e?.yearAgo, empty: `Nothing kept around ${dateWords(shiftDays(today, -365), today)}.` },
    { key: 'month', caps: 'A month ago', item: e?.monthAgo, empty: `Nothing kept around ${dateWords(monthBack(today), today)}.` },
    { key: 'random', caps: 'From any day', item: e?.random, empty: 'Learnings older than a week show up here.' },
  ];
  return (
    <KSection title="From your archive" className="ln-echoes">
      <div className="ln-echo-strip">
        {slots.map((s) =>
          s.item ? (
            <Pressable key={s.key} as="button" className="ln-echo" press="surface" onPress={() => onOpen(s.item!)} label={`${s.caps}, ${dateWords(s.item.date, today)}: ${s.item.text}. Edit`}>
              <span className="caps ln-echo-caps">
                {s.caps} <span aria-hidden="true">·</span> {dateWords(s.item.date, today)}
              </span>
              <span className="ln-echo-text">{s.item.text}</span>
            </Pressable>
          ) : (
            <div key={s.key} className={`ln-echo is-empty ${q.isPending ? 'is-loading' : ''}`} aria-label={`${s.caps}: ${q.isPending ? 'loading' : s.empty}`}>
              <span className="caps ln-echo-caps">{s.caps}</span>
              <span className="ln-echo-dash" aria-hidden="true">
                –
              </span>
              <span className="ln-echo-empty">{q.isPending ? ' ' : s.empty}</span>
            </div>
          ),
        )}
      </div>
    </KSection>
  );
};
