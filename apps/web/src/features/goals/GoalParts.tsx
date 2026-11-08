import { awaitingReview, type Aim, type GoalLevel } from '@logbook/shared';
import { CircleAlert, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { useRef } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { LEVEL, periodCaps, scoreOf } from './model';
import { ReviewButtons } from './GoalSheets';
import { KPin } from './Kit';
import './goals.css';

/** `Last 4 weeks` from the model's `LAST 4 WEEKS`-style span names (they are sentence case already; this keeps it so). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * The one honest number for a level (docs/inspiration.md §6 Goals), as a card: the span as its label, `3 of 4` stamped big
 * with its words small, a status word with its icon (navy on track, orange behind, grey with nothing answered), and the
 * span before as the footnote.
 */
export const ScoreCard = ({ goals, level, today }: { goals: readonly Aim[]; level: GoalLevel; today: string }) => {
  const s = scoreOf(goals, level, today);
  const label = s.closed ? `${s.caps}: ${s.kept} of ${s.closed} ${s.words}. ${s.tone === 'behind' ? 'Behind' : 'On track'}. ${s.vs}.` : `${s.caps}: no ${LEVEL[level].label.toLowerCase()} goals answered yet.`;
  return (
    <section className={`k-card g-score ${s.tone ? `is-${s.tone}` : 'is-none'}`} aria-label={label}>
      <div className="k-label" aria-hidden="true">
        <Target size={16} />
        {sentence(s.caps)}
        {s.owed ? <span className="k-label-end g-score-owed">{s.owed} to review</span> : null}
      </div>
      <p className="k-num g-score-num" aria-hidden="true">
        {s.closed ? s.kept : '–'}
        <small>{s.closed ? `of ${s.closed} ${s.words}` : `No ${LEVEL[level].label.toLowerCase()} goals answered yet`}</small>
      </p>
      <div className="g-score-foot" aria-hidden="true">
        {s.tone === 'behind' ? (
          <span className="k-status is-hi">
            <TrendingDown size={15} /> Behind
          </span>
        ) : s.tone === 'on' ? (
          <span className="k-status">
            <TrendingUp size={15} /> On track
          </span>
        ) : (
          <span className="k-status is-none">
            <Minus size={15} /> No data yet
          </span>
        )}
        {s.closed || s.prev ? <span className="k-foot">{s.vs}</span> : null}
      </div>
    </section>
  );
};

/** `Send the draft to Ana (Fri, Nov 6)`: a stale goal named with its period. */
const named = (g: Aim, today: string) => `${g.text.replace(/[.\s]+$/, '')} (${periodCaps(g.level, g.period, today).split(' · ').pop()})`;

/**
 * The nudge for goals left open after their period ended, as a card: a label with its icon, the line, the goals named
 * (three at most, then "and N more") as rows, and one tap walks through them in the review sheet.
 */
export const StaleNudge = ({ goals, today }: { goals: readonly Aim[]; today: string }) => {
  const sheet = useSheet();
  const owed = awaitingReview(goals, today);
  if (!owed.length) return null;
  const shown = owed.slice(0, 3);
  const more = owed.length - shown.length;
  return (
    <section className="k-card g-nudge" aria-label="Goals to review">
      <div className="k-label g-nudge-label">
        <CircleAlert size={16} aria-hidden="true" />
        To review
      </div>
      <p className="g-nudge-title">
        {owed.length === 1 ? 'One goal is still open' : `${owed.length} goals are still open`} after {owed.length === 1 ? 'its' : 'their'} time ran out
      </p>
      <ul className="g-nudge-list">
        {shown.map((g) => (
          <li key={g.id}>{named(g, today)}</li>
        ))}
        {more ? <li className="g-nudge-more">and {more} more</li> : null}
      </ul>
      <Button variant="primary" size="sm" className="g-nudge-btn" onClick={() => sheet.open({ eyebrow: 'Review', title: owed.length === 1 ? 'Did you hit it?' : 'How did they go?', body: <ReviewSheet total={owed.length} /> })}>
        Review {owed.length === 1 ? 'it' : `all ${owed.length}`}
      </Button>
    </section>
  );
};

/** The owed goals one after another: each answer moves on to the next; at the end, a line and Done. */
const ReviewSheet = ({ total }: { total: number }) => {
  const today = useToday();
  const sheet = useSheet();
  const goals = useGoals();
  const owed = awaitingReview(goals.data, today);
  const first = useRef(total);
  const g = owed[0];
  if (!g)
    return (
      <div className="gsheet k-sheet">
        <section className="k-card gs-card">
          <p className="gs-sentence serif">All reviewed.</p>
          <p className="k-foot">{first.current === 1 ? 'It is in the history with its answer.' : `All ${first.current} are in the history with their answers.`}</p>
        </section>
        <KPin>
          <Button variant="primary" block onClick={() => sheet.close()}>
            Done
          </Button>
        </KPin>
      </div>
    );
  const n = g.steps.length;
  const k = g.steps.filter((x) => x.done).length;
  return (
    <div className="gsheet k-sheet">
      <section className="k-card gs-card">
        <span className="caps">
          {periodCaps(g.level, g.period, today)}
          {first.current > 1 ? ` · ${Math.min(first.current, first.current - owed.length + 1)} of ${first.current}` : ''}
        </span>
        <p className="gs-sentence serif">{g.text}</p>
        {n ? <p className="k-foot">{k === n ? 'Every step was checked.' : `${k} of ${n} steps were checked.`}</p> : null}
      </section>
      <h3 className="k-sheet-label">Did you hit it?</h3>
      <ReviewButtons goal={g} />
      <KPin>
        <Button block onClick={() => sheet.close()}>
          Later
        </Button>
      </KPin>
    </div>
  );
};
