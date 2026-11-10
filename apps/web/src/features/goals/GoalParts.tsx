import { awaitingReview, type Aim, type GoalLevel } from '@logbook/shared';
import { CircleAlert, Target } from 'lucide-react';
import { useRef } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { LEVEL, periodCaps, scoreOf } from './model';
import { ReviewButtons } from './GoalSheets';
import { KPin } from './Kit';
import './goals.css';

const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];
/** The span each level's number looks back over, in a word or two. */
const SPAN_WORDS: Record<GoalLevel, string> = { day: '7 days', week: '4 weeks', month: '3 months', year: 'This year' };

/**
 * The one honest number per level (docs/inspiration.md §6 Goals), all four in one card: each level's goals kept of those
 * answered over its span, in warning words with a Marigold marker when it is behind the span before (or under half with nothing to compare), a dash with
 * nothing answered yet.
 */
export const ScoreStrip = ({ goals, today }: { goals: readonly Aim[]; today: string }) => (
  <section className="k-card g-scores" aria-label="Goals kept">
    <div className="k-label" aria-hidden="true">
      <Target size={18} />
      Goals kept
    </div>
    <ul className="g-scores-row">
      {LEVELS.map((l) => {
        const s = scoreOf(goals, l, today);
        // behind: the number in warning words, and the line under it says against what
        const why = s.tone === 'behind' ? (s.prev ? `was ${s.prev.kept} of ${s.prev.closed}` : 'under half') : null;
        const label = s.closed ? `${LEVEL[l].label}, ${l === 'year' ? 'this year' : `last ${SPAN_WORDS[l]}`}: ${s.kept} of ${s.closed} done${why ? `, behind: ${why} before` : ''}` : `${LEVEL[l].label}: none answered yet`;
        return (
          <li key={l} className={`g-sc ${s.tone ? `is-${s.tone}` : 'is-none'}`} aria-label={label}>
            <span className="g-sc-lv" aria-hidden="true">
              <i />
              {LEVEL[l].label}
            </span>
            <span className="g-sc-num tnum" aria-hidden="true">
              {s.closed ? (
                <>
                  {s.kept}
                  <small>/{s.closed}</small>
                </>
              ) : (
                '–'
              )}
            </span>
            <span className="g-sc-span" aria-hidden="true">
              {SPAN_WORDS[l]}
            </span>
            {why ? (
              <span className="g-sc-why" aria-hidden="true">
                {why}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  </section>
);

/** A stale goal's period, short: `Fri, Nov 6`, `Oct 26–Nov 1`, `October 2026`. */
const whenOf = (g: Aim, today: string) => periodCaps(g.level, g.period, today).split(' · ').pop() ?? g.period;

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
        <CircleAlert size={18} aria-hidden="true" />
        To review
      </div>
      <p className="g-nudge-title">
        {owed.length === 1 ? 'One goal is still open' : `${owed.length} goals are still open`} after {owed.length === 1 ? 'its' : 'their'} time ran out
      </p>
      <ul className="g-nudge-list">
        {shown.map((g) => (
          <li key={g.id}>
            <span className="g-nudge-text">{g.text.replace(/[.\s]+$/, '')}</span>
            <span className="g-nudge-when">{whenOf(g, today)}</span>
          </li>
        ))}
        {more ? <li className="g-nudge-more">and {more} more</li> : null}
      </ul>
      <Button size="sm" className="g-nudge-btn" onClick={() => sheet.open({ eyebrow: 'Review', title: owed.length === 1 ? 'Did you hit it?' : 'How did they go?', body: <ReviewSheet total={owed.length} /> })}>
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
