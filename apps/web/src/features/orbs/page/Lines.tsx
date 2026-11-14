import type * as React from 'react';
import { gemFor, OrbGem } from '../gems';
import { num, orbs, type Line } from './model';
import './orbs.css';
import './legend.css';

/**
 * Lines of Orbs in a sheet: what earned them, each with its own form before its name (a to-do's disc, a habit's lit
 * disc, the goal's target), and the number at the row's end. The form is decoration beside the words: the label says
 * the kind.
 */
export const Lines = ({ lines }: { lines: readonly Line[] }): React.JSX.Element => {
  const legend = lines.some((l) => l.gem);
  return (
    <dl className="group orp-facts">
      {lines.map((l) => (
        <div key={l.key} className="orp-fact">
          <dt className={legend ? 'orl-line' : undefined}>
            {legend ? (
              <span className="orl-gem" aria-hidden="true">
                {l.gem ? <OrbGem gem={gemFor(l.gem)} size={22} /> : null}
              </span>
            ) : null}
            {l.label}
          </dt>
          <dd aria-label={orbs(l.n)}>{num(l.n)}</dd>
        </div>
      ))}
    </dl>
  );
};
