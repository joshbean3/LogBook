import { awaitingReview, type Aim, type GoalLevel } from '@logbook/shared';
import { useRef } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { LEVEL, periodCaps, scoreOf } from './model';
import { ReviewButtons } from './GoalSheets';
import './goals.css';

/**
 * The one honest number for a level (docs/inspiration.md §6 Goals): `3 of 4` week goals kept over the last four weeks,
 * against the four before. Navy when on track, orange when behind; with nothing answered yet, a dash and a sentence.
 */
export const ScoreCard = ({ goals, level, today }: { goals: readonly Aim[]; level: GoalLevel; today: string }) => {
  const s = scoreOf(goals, level, today);
  const label = s.closed ? `${s.caps}: ${s.kept} of ${s.closed} ${s.words}. ${s.vs}.` : `${s.caps}: no ${LEVEL[level].label.toLowerCase()} goals answered yet.`;
  return (
    <section className={`g-score ${s.tone ? `is-${s.tone}` : 'is-none'}`} aria-label={label}>
      <span className="caps g-score-caps">{s.caps}</span>
      <p className="g-score-line" aria-hidden="true">
        {s.closed ? (
          <>
            <span className="stamp tnum g-score-num">
              {s.kept}
              <small> of {s.closed}</small>
            </span>
            <span className="g-score-words">{s.words}</span>
          </>
        ) : (
          <>
            <span className="stamp tnum g-score-num">–</span>
            <span className="g-score-words">No {LEVEL[level].label.toLowerCase()} goals answered yet</span>
          </>
        )}
      </p>
      <p className="g-score-vs" aria-hidden="true">
        {s.closed ? <span className="g-score-chip">{s.tone === 'behind' ? 'Behind' : 'On track'}</span> : null}
        {s.closed || s.prev ? <span>{s.vs}</span> : null}
        {s.owed ? <span className="g-score-owed">{s.owed} to review</span> : null}
      </p>
    </section>
  );
};

/** `Send the draft to Ana (Fri, Nov 6)`: a stale goal named with its period. */
const named = (g: Aim, today: string) => `${g.text.replace(/[.\s]+$/, '')} (${periodCaps(g.level, g.period, today).split(' · ').pop()})`;

/**
 * The nudge for goals left open after their period ended: it names them (three at most, then "and N more") and one tap
 * walks through them in the review sheet.
 */
export const StaleNudge = ({ goals, today }: { goals: readonly Aim[]; today: string }) => {
  const sheet = useSheet();
  const owed = awaitingReview(goals, today);
  if (!owed.length) return null;
  const shown = owed.slice(0, 3);
  const more = owed.length - shown.length;
  return (
    <section className="g-nudge" aria-label="Goals to review">
      <span className="g-nudge-dot" aria-hidden="true" />
      <div className="g-nudge-main">
        <p className="g-nudge-title">
          {owed.length === 1 ? 'One goal is still open' : `${owed.length} goals are still open`} after {owed.length === 1 ? 'its' : 'their'} time ran out
        </p>
        <ul className="g-nudge-list">
          {shown.map((g) => (
            <li key={g.id}>{named(g, today)}</li>
          ))}
          {more ? <li className="g-nudge-more">and {more} more</li> : null}
        </ul>
      </div>
      <Button variant="primary" size="sm" className="g-nudge-btn" onClick={() => sheet.open({ eyebrow: 'Review', title: owed.length === 1 ? 'Did you hit it?' : 'How did they go?', body: <ReviewSheet total={owed.length} /> })}>
        Review
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
      <div className="gsheet">
        <p className="gs-sentence serif">All reviewed.</p>
        <p className="gs-hint">{first.current === 1 ? 'It is in the history with its answer.' : `All ${first.current} are in the history with their answers.`}</p>
        <div className="sheet-foot">
          <span />
          <div className="foot-right">
            <Button variant="primary" onClick={() => sheet.close()}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  const n = g.steps.length;
  const k = g.steps.filter((x) => x.done).length;
  return (
    <div className="gsheet">
      <span className="caps">
        {periodCaps(g.level, g.period, today)}
        {first.current > 1 ? ` · ${Math.min(first.current, first.current - owed.length + 1)} of ${first.current}` : ''}
      </span>
      <p className="gs-sentence serif">{g.text}</p>
      {n ? <p className="gs-hint">{k === n ? 'Every step was checked.' : `${k} of ${n} steps were checked.`}</p> : null}
      <ReviewButtons goal={g} />
      <div className="sheet-foot">
        <Button variant="ghost" onClick={() => sheet.close()}>
          Later
        </Button>
      </div>
    </div>
  );
};
