import { ruleLine } from '@logbook/shared';
import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { useId, useState } from 'react';
import { useToday } from '@/lib/useToday';
import { Footnote, PageSection } from '@/ui/layout';
import { getOrbs } from '../store';
import { diagnosticRows, diagnostics } from './diagnostics';
import { howSections, type HowRow } from './how';
import './orbs.css';

const Rows = ({ rows }: { rows: readonly HowRow[] }): React.JSX.Element => (
  <ul className="group orh-rows">
    {rows.map((r) => (
      <li key={r.key} className="orh-row">
        <span className="orh-text">
          <span className="orh-title">{r.title}</span>
          {r.sub ? <span className="orh-sub">{r.sub}</span> : null}
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
export const HowBody = ({ fitness, target }: { fitness: boolean; target: 3 | 4 | 5 }): React.JSX.Element => (
  <div className="orh">
    <div className="orh-lead">
      <p className="orh-rule">{ruleLine(target)}</p>
      <p className="orh-about">Orbs are small lights you earn for what you finish. They mark the day. They are never the point.</p>
    </div>
    {howSections({ fitness, target }).map((sec) => (
      <PageSection key={sec.key} size="sm" title={sec.title} className="orh-sec">
        {sec.lead ? <p className="orh-sec-lead">{sec.lead}</p> : null}
        <Rows rows={sec.rows} />
        {sec.foot ? <Footnote>{sec.foot}</Footnote> : null}
      </PageSection>
    ))}
    <Curious />
  </div>
);
