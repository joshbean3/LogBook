import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { signedPercent, type TrendRow } from './scale';
import { Spark } from './Spark';
import './charts.css';

const dayWords = (n: number) => `${n} days`;

/**
 * Rows for 3, 7, 14, 30 and 90 days: the change against the same stretch before it, an arrow, a sparkline of the stretch,
 * and the method in a footnote. A row with nothing to compare says "Not enough yet" instead of a made-up 0%. The arrow is
 * a direction, never a grade: it stays navy whichever way it points.
 */
export const TrendTable = ({ rows, footnote, invert, change = (r) => signedPercent(r.change!), label = 'Trends' }: { rows: TrendRow[]; footnote: string; invert?: boolean; change?: (r: TrendRow) => string; label?: string }) => (
  <div className="ck-ttable">
    <div className="ck-ttable-rows" role="table" aria-label={label}>
      {rows.map((r) => {
        // inverted (pace): a smaller number is up, so the arrow points the way the chart does
        const dir = invert && r.dir !== 'flat' && r.dir != null ? (r.dir === 'up' ? 'down' : 'up') : r.dir;
        const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : ArrowRight;
        const has = r.dir != null && (r.change != null || r.dir === 'flat');
        const words = has ? (r.change != null ? change(r) : 'Level') : 'Not enough yet';
        return (
          <div key={r.days} className="ck-trow" role="row">
            <span className="ck-trow-days" role="rowheader">
              {dayWords(r.days)}
            </span>
            <span className={`ck-trow-change stamp ${has ? '' : 'is-none'}`} role="cell">
              {words}
            </span>
            <span className="ck-trow-arrow" role="cell" aria-label={has ? (dir === 'flat' ? 'level' : dir === 'up' ? 'up' : 'down') : undefined}>
              {has ? <Icon size={16} aria-hidden="true" /> : <span aria-hidden="true">–</span>}
            </span>
            <span className="ck-trow-spark" role="cell" aria-hidden="true">
              <Spark values={r.spark} w={72} h={22} invert={invert} glow={false} />
            </span>
          </div>
        );
      })}
    </div>
    <p className="ck-foot">{footnote}</p>
  </div>
);
