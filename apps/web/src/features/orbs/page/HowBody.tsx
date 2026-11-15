import { ruleLine } from '@logbook/shared';
import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useToday } from '@/lib/useToday';
import { Footnote, PageSection } from '@/ui/layout';
import { gemFor, OrbGem } from '../gems';
import { getOrbs } from '../store';
import { diagnosticRows, diagnostics } from './diagnostics';
import { howSections, takeHowAt, type HowRow } from './how';
import './orbs.css';
import './legend.css';

/** A row's Orb: its rung's, 22 pt. The words beside it say the kind and, on the ladder, the rung. */
const RowGems = ({ keys }: { keys?: readonly string[] }): React.JSX.Element => (
  <span className="orl-gem" aria-hidden="true">
    {keys?.slice(0, 1).map((k) => <OrbGem key={k} gem={gemFor(k)} size={22} />)}
  </span>
);

/** Rows with what each pays at the row's end. Where any row of the group earns an Orb, every row keeps a leading place for one, so the titles line up. */
const Rows = ({ rows }: { rows: readonly HowRow[] }): React.JSX.Element => {
  const legend = rows.some((r) => r.gems?.length);
  return (
    <ul className="group orh-rows">
      {rows.map((r) => (
        <li key={r.key} className="orh-row">
          {legend ? <RowGems keys={r.gems} /> : null}
          <span className="orh-text">
            <span className="orh-title">{r.title}</span>
            {r.sub ? <span className="orh-sub">{r.sub}</span> : null}
            {r.more ? <span className="orh-sub">{r.more}</span> : null}
          </span>
          {r.note ? <span className="orh-note">{r.note}</span> : null}
          {r.value ? (
            <span className="orh-value" aria-label={`${r.value} ${r.value === '1' ? 'Orb' : 'Orbs'}`}>
              {r.value}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

/**
 * "For the curious": a few counts about how Orbs are going, behind a quiet disclosure at the foot. They are worked out
 * when it is opened, on this phone, from the store (`diagnostics`), and no request is made for them.
 */
const Curious = (): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const today = useToday();
  const s = open ? getOrbs() : null;
  return (
    <div className="orh-curious">
      <button type="button" className="orh-curious-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        For the curious
        <ChevronDown size={18} className={`orh-curious-chev${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={id} className="orh-curious-body">
          {s ? (
            <dl className="group orp-facts">
              {diagnosticRows(diagnostics(s, today)).map((r) => (
                <div key={r.label} className="orp-fact">
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Footnote>{s ? 'Worked out on this phone from your own record. These counts are not sent anywhere.' : 'Nothing to count yet.'}</Footnote>
        </div>
      ) : null}
    </div>
  );
};

/**
 * How Orbs work, in one column: the rule first, then each part of it as plain rows with what it pays at the row's end.
 * Every number is the engine's (`howSections` reads `RULES`). The same body is the pushed page and, from Settings, a sheet.
 */
export const HowBody = ({ fitness, target }: { fitness: boolean; target: 3 | 4 | 5 }): React.JSX.Element => {
  // opened from "Your Orbs": the page begins at the ladder (once: the next visit starts at the top)
  const at = useRef<HTMLElement>(null);
  const [want] = useState(takeHowAt);
  useEffect(() => {
    if (want) at.current?.scrollIntoView({ block: 'start' });
  }, [want]);
  return (
    <div className="orh">
      <div className="orh-lead">
        <p className="orh-rule">{ruleLine(target)}</p>
        <p className="orh-about">You earn Orbs for what you finish. What you finish decides the Orb. They mark the day. They are never the point.</p>
      </div>
      {howSections({ fitness, target }).map((sec) => (
        <PageSection key={sec.key} size="sm" title={sec.title} className={`orh-sec${sec.key === 'ladder' ? ' orh-ladder' : ''}`} ref={sec.key === want ? at : undefined}>
          {sec.lead ? <p className="orh-sec-lead">{sec.lead}</p> : null}
          <Rows rows={sec.rows} />
          {sec.foot ? <Footnote>{sec.foot}</Footnote> : null}
        </PageSection>
      ))}
      <Curious />
    </div>
  );
};
