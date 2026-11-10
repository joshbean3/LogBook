import { fmtDate, type Learning } from '@logbook/shared';
import { Pressable } from '@/ui/Pressable';
import { KSection } from '../goals/Kit';
import { useLearningEchoes } from './queries';

/** `Nov 10, 2025`: the year only when it is not this one. */
const dateWords = (d: string, today: string) => (d.slice(0, 4) === today.slice(0, 4) ? fmtDate('md', d) : `${fmtDate('md', d)}, ${d.slice(0, 4)}`);

/**
 * "From your archive" (under the stats on the Learned tab): up to three cards, a year ago, a month ago and one at random,
 * each a tap from its sheet. Only the slots with a learning show, and the section only once one has (a lone card takes the
 * full width).
 */
export const Echoes = ({ today, onOpen }: { today: string; onOpen: (l: Learning) => void }) => {
  const q = useLearningEchoes();
  const e = q.data;
  const slots = [
    { key: 'year', caps: 'A year ago', item: e?.yearAgo },
    { key: 'month', caps: 'A month ago', item: e?.monthAgo },
    { key: 'random', caps: 'From any day', item: e?.random },
  ].filter((x): x is { key: string; caps: string; item: Learning } => !!x.item);
  if (!slots.length) return null;
  return (
    <KSection title="From your archive" className="ln-echoes">
      <div className={`ln-echo-strip ${slots.length === 1 ? 'is-one' : ''}`}>
        {slots.map((s) => (
          <Pressable key={s.key} as="button" className="ln-echo" press="surface" onPress={() => onOpen(s.item)} label={`${s.caps}, ${dateWords(s.item.date, today)}: ${s.item.text}. Edit`}>
            <span className="caps ln-echo-caps">
              {s.caps} <span aria-hidden="true">·</span> {dateWords(s.item.date, today)}
            </span>
            <span className="ln-echo-text">{s.item.text}</span>
          </Pressable>
        ))}
      </div>
    </KSection>
  );
};
