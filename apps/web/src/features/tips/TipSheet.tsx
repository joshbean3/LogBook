import type * as React from 'react';
import { useId, useLayoutEffect, useRef } from 'react';
import { BrandIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives';
import { TIP_CAPTIONS, TIP_DONE, TIP_TOUR, type Tip, type TipRow } from './tips';
import './tips.css';

/** One section row (brand guide 6.11): a 32 px Haze tile with one glyph, a line in Inter 17 600, a second in Inter 15 Dusk. */
const Row = ({ row }: { row: TipRow }) => (
  <li className="tip-row">
    <span className="icon-tile" aria-hidden="true">
      <BrandIcon name={row.icon} size={18} />
    </span>
    <span className="tip-text">
      <span className="tip-title">{row.title}</span>
      {row.sub ? <span className="tip-sub">{row.sub}</span> : null}
    </span>
  </li>
);

/**
 * One group of rows. With a `caption` it is headed by it; the first group has none, because the sheet's own caps line
 * ("How it works", over the title) is its heading: VoiceOver still hears the group's name (`label`).
 */
const Group = ({ label, caption, rows }: { label: string; caption?: boolean; rows: readonly TipRow[] }) => {
  const id = useId();
  if (!rows.length) return null;
  return (
    <section className="tip-group" aria-labelledby={caption ? id : undefined} aria-label={caption ? undefined : label}>
      {caption ? (
        <h3 id={id} className="caps tip-cap">
          {label}
        </h3>
      ) : null}
      <ul className="tip-rows">
        {rows.map((r) => (
          <Row key={r.title} row={r} />
        ))}
      </ul>
    </section>
  );
};

/**
 * A first-visit tip's body (layout standard 2.11): one Paper card with two short groups, how it works (headed by the
 * sheet's own caps line) and "How it's tracked", then the sheet's one Sky button and the quiet link to the tour's page for this place. The sheet around it
 * (the eyebrow, the place's name as its title, Close, the scrim, Escape, Back, the flick down) is `useSheet`'s.
 *
 * Focus: the sheet gives its first control the focus when it has risen, unless something inside took it first. A tip is
 * read, not acted on, so its title takes it: VoiceOver starts at the place's name and reads down.
 */
export const TipSheet = ({ tip, onDone, onTour }: { tip: Tip; onDone: () => void; onTour: () => void }): React.JSX.Element => {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    root.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>('.sheet-title')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={root} className="tip" data-place={tip.place}>
      <div className="tip-card">
        <Group label={TIP_CAPTIONS.works} rows={tip.works} />
        <Group label={TIP_CAPTIONS.tracked} caption rows={tip.tracked} />
      </div>
      <div className="tip-foot">
        <Button variant="primary" block onClick={onDone}>
          {TIP_DONE}
        </Button>
        <Button variant="quiet" className="tip-tour" onClick={onTour}>
          {TIP_TOUR}
        </Button>
      </div>
    </div>
  );
};
