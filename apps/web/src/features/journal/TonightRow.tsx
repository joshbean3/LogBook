import type { ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { JournalIcon } from '@/ui/icons';
import { SectionHeader } from '@/ui/layout';
import { Row } from '@/ui/primitives';
import { byTime } from '../learned/LearnedParts';
import { rowsOf, useLearnings } from '../learned/queries';
import { tonightRow, type TonightRowWords } from './days';
import { journalIntent } from './intent';
import './tonight.css';

/**
 * The row itself, apart from where it goes: the list row with the Journal tile, the words (`tonightRow`) and the chevron.
 * Today's row gives it the way into the Journal; first run draws the same row in the picture of the first day (no
 * `onClick`: it is not a button there).
 */
export const TonightFace = ({ w, onClick }: { w: TonightRowWords; onClick?: () => void }): React.JSX.Element => (
  <div className="group">
    <Row
      className={w.trailing ? 'jn-tonight is-kept' : 'jn-tonight'}
      left={
        <span className="icon-tile" aria-hidden="true">
          <JournalIcon size={18} />
        </span>
      }
      title={w.title}
      sub={w.sub}
      right={
        <>
          {w.trailing ? <span className="lrow-link jn-tonight-more">{w.trailing}</span> : null}
          <ChevronRight size={18} className="day-learned-chev" aria-hidden="true" />
        </>
      }
      onClick={onClick}
      label={w.label}
    />
  </div>
);

/**
 * The Journal row at the foot of Today (a Today section, lib/prefs.ts; its stored key stays `learned`): one row that is
 * the way into the Journal's composer. Before tonight's line: "Tonight's line", "One line is enough", and a tap opens the
 * Journal with the caret in the field. After: the line itself, with "Write more" at its end, and a tap opens the entry
 * writer. Today's entries stay in the day's timeline. Built from the list row every screen uses; the poster is not
 * copied here. The words are days.ts `tonightRow`.
 */
export const TonightRow = ({ today }: { today: ISODate }): React.JSX.Element => {
  const nav = useNav();
  // this month's lines: the list the Journal itself reads, with what is waiting to sync laid over it, so the row turns
  // the moment the line is kept, on any server
  const list = useLearnings({ month: today.slice(0, 7) });
  const line = useMemo(() => rowsOf(list.data).filter((l) => l.date === today).sort(byTime)[0]?.text ?? null, [list.data, today]);
  const w = tonightRow(line);
  const open = () => {
    nav.go('/journal');
    journalIntent.set({ kind: w.opens });
  };
  return (
    <section className="day-learned day-journal" aria-label="Journal">
      <SectionHeader title="Journal" />
      <TonightFace w={w} onClick={open} />
    </section>
  );
};
