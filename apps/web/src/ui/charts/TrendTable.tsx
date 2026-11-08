import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { signedPercent, type TrendRow } from './scale';
import { Spark } from './Spark';
import './charts.css';

const dayWords = (n: number) => `${n} days`;

/**
 * Rows for 3, 7, 14, 30 and 90 days under a quiet header (Period, Change, Trend): the change against the same stretch before
 * it with its arrow in a small round badge, and a sparkline of the stretch with a soft fill. A row with nothing to compare says
 * "Not enough yet" instead of a made-up 0%. The arrow is a direction, never a grade: it stays navy whichever way it points.
 * The method footnote is drawn under the rows when given; a caller that sets it outside its card leaves it out.
 */
export const TrendTable = ({ rows, footnote, invert, change = (r) => signedPercent(r.change!), label = 'Trends' }: { rows: TrendRow[]; footnote?: string; invert?: boolean; change?: (r: TrendRow) => string; label?: string }) => (
  <div className="ck-ttable">
    <div className="ck-ttable-rows" role="table" aria-label={label}>
      <div className="ck-trow ck-trow-head" role="row">
        <span role="columnheader">Period</span>
        <span role="columnheader">Change</span>
        <span role="columnheader">Trend</span>
      </div>
      {rows.map((r) => {
        // inverted (pace): a smaller number is up, so the arrow points the way the chart does
        const dir = invert && r.dir !== 'flat' && r.dir != null ? (r.dir === 'up' ? 'down' : 'up') : r.dir;
        const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : ArrowRight;
        const has = r.dir != null && (r.change != null || r.dir === 'flat');
        const words = has ? (r.change != null ? change(r) : 'Level') : 'Not enough yet';
        return (
          <div key={r.days} className="ck-trow" role="row">
            <span className="ck-trow-days" role="rowheader">
              {dayWords(r.days)}
            </span>
            <span className={`ck-trow-change ${has ? '' : 'is-none'}`} role="cell">
              {has ? (
                <span className="ck-trow-arrow" role="img" aria-label={dir === 'flat' ? 'level' : dir === 'up' ? 'up' : 'down'}>
                  <Icon size={11} strokeWidth={3} aria-hidden="true" />
                </span>
              ) : null}
              <span className="ck-trow-words">{words}</span>
            </span>
            <span className="ck-trow-spark" role="cell" aria-hidden="true">
              <Spark values={r.spark} w={76} h={24} invert={invert} glow={false} area />
            </span>
          </div>
        );
      })}
    </div>
    {footnote ? <p className="ck-foot">{footnote}</p> : null}
  </div>
);
