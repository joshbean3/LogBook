import { Flag } from 'lucide-react';
import type * as React from 'react';
import { useToday } from '@/lib/useToday';
import { Pressable } from '@/ui/Pressable';
import { BrandIcon, GoalsIcon, JournalIcon, TodayIcon } from '@/ui/icons';
import { Footnote } from '@/ui/layout';
import { OrbLight } from '@/ui/OrbLight';
import { useSheet } from '@/ui/Sheet';
import { markSeen } from '../store';
import { longDate, shortDate, type KeepsakeGlyph, type KeepsakeView, type NextKeepsake } from './model';

const Glyph = ({ glyph, size }: { glyph: KeepsakeGlyph; size: number }): React.JSX.Element =>
  glyph === 'first' ? (
    <TodayIcon size={size} />
  ) : glyph === 'goal' ? (
    <GoalsIcon size={size} />
  ) : glyph === 'chapter' ? (
    <JournalIcon size={size} />
  ) : glyph === 'full' ? (
    <BrandIcon name="check" size={size} />
  ) : (
    <Flag size={size} strokeWidth={1.75} aria-hidden="true" />
  );

/** A keepsake's disc: 48 pt, Haze with a Deep Sky ring, a Night Ink numeral or glyph. A chapter is the open book over its number. */
export const KeepsakeDisc = ({ numeral, glyph, next }: { numeral?: string; glyph?: KeepsakeGlyph; next?: boolean }): React.JSX.Element => (
  <span className={`orp-disc${next ? ' is-next' : ''}${glyph && numeral ? ' is-both' : ''}${numeral && numeral.length > 3 ? ' is-long' : ''}`} aria-hidden="true">
    {glyph ? <Glyph glyph={glyph} size={numeral ? 15 : 22} /> : null}
    {numeral ? <span className="orp-disc-n">{numeral}</span> : null}
  </span>
);

/** What a keepsake's sheet holds: its one line, its own words (a goal's, or the line a chapter kept), then its facts. */
export const KeepsakeBody = ({ k }: { k: KeepsakeView }): React.JSX.Element => (
  <div className="orp-ksheet">
    <div className="orp-ksheet-top">
      <KeepsakeDisc numeral={k.numeral} glyph={k.glyph} />
      <p className="orp-ksheet-line">{k.line}</p>
    </div>
    {k.words ? (
      <figure className="orp-quote">
        <figcaption className="caps">{k.wordsCaption}</figcaption>
        <blockquote>{k.words}</blockquote>
      </figure>
    ) : null}
    {k.facts.length ? (
      <dl className="group orp-facts">
        {k.facts.map((f) => (
          <div key={f.label} className="orp-fact">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    ) : null}
  </div>
);

/** Opens a keepsake's small sheet, and marks it seen: it stops being "New". */
export const useOpenKeepsake = (): ((k: KeepsakeView) => void) => {
  const sheet = useSheet();
  const today = useToday();
  return (k) => {
    markSeen(k.key);
    sheet.open({ eyebrow: longDate(k.on, today), title: k.title, body: <KeepsakeBody k={k} /> });
  };
};

/**
 * The keepsakes: one Paper card, a grid of 48 pt discs four across (two at a very large text size), the date under each.
 * Only earned ones, newest first, after one dashed ring for what comes next. Only the newest glows: an Apricot light
 * behind its disc. One that has not been opened says "New" where its date would be. A tap opens its words and facts.
 */
export const Keepsakes = ({ items, next, fresh }: { items: readonly KeepsakeView[]; next: NextKeepsake | null; fresh: ReadonlySet<string> }): React.JSX.Element => {
  const open = useOpenKeepsake();
  const today = useToday();
  return (
    <>
      <div className="card orp-keeps-card">
        <ul className="orp-keeps">
          {next ? (
            <li className="orp-keep is-next" role="img" aria-label={`${next.words}.`}>
              <KeepsakeDisc numeral={next.numeral} glyph={next.glyph} next />
              <span className="orp-keep-date" aria-hidden="true">
                Next
              </span>
            </li>
          ) : null}
          {items.map((k, i) => {
            const isNew = fresh.has(k.key);
            return (
              <li key={k.key} className="orp-keep-cell">
                <Pressable className={`orp-keep${i === 0 ? ' is-newest' : ''}`} press="scale" label={`${k.title}. ${longDate(k.on, today)}.${isNew ? ' New.' : ''}`} onPress={() => open(k)}>
                  <span className="orp-keep-top">
                    {i === 0 ? (
                      <span className="orp-keep-glow">
                        <OrbLight size={48} glow />
                      </span>
                    ) : null}
                    <KeepsakeDisc numeral={k.numeral} glyph={k.glyph} />
                  </span>
                  {isNew ? <span className="orp-keep-new">New</span> : <span className="orp-keep-date">{shortDate(k.on, today)}</span>}
                </Pressable>
              </li>
            );
          })}
        </ul>
      </div>
      {next ? <Footnote className="orp-next-line">{next.words}</Footnote> : null}
    </>
  );
};
