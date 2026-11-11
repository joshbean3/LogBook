import type { Aim, GoalLevel } from '@logbook/shared';
import { NoData } from '@/ui/primitives';
import { LEVEL, scoreOf } from './model';
import './goals.css';

const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];
/** The span each level's number looks back over, in a word or two. */
const SPAN_WORDS: Record<GoalLevel, string> = { day: '7 days', week: '4 weeks', month: '3 months', year: 'This year' };

/**
 * The one honest number per level (docs/inspiration.md §6 Goals), all four in one card under "History · Goals kept"
 * (layout plan 2.2 G4): each level's label, its goals kept of those answered over its span as the card's value, and the
 * span under it. Behind the span before (or under half with nothing to compare), the line under it says so in warning
 * words. Nothing answered yet reads "None yet", never a dash.
 */
export const ScoreStrip = ({ goals, today }: { goals: readonly Aim[]; today: string }) => (
  <section className="k-card g-scores" aria-label="Goals kept">
    <ul className="g-scores-row">
      {LEVELS.map((l) => {
        const s = scoreOf(goals, l, today);
        // behind: the line under the number says against what
        const why = s.tone === 'behind' ? (s.prev ? `Was ${s.prev.kept} of ${s.prev.closed}` : 'Under half') : null;
        const label = s.closed ? `${LEVEL[l].label}, ${l === 'year' ? 'this year' : `last ${SPAN_WORDS[l]}`}: ${s.kept} of ${s.closed} done${why ? `, behind: ${why.toLowerCase()} before` : ''}` : `${LEVEL[l].label}: none answered yet`;
        return (
          <li key={l} className={`g-sc ${s.tone ? `is-${s.tone}` : 'is-none'}`} aria-label={label}>
            <span className="g-sc-lv" aria-hidden="true">
              {LEVEL[l].label}
            </span>
            <span className="g-sc-num tnum" aria-hidden="true">
              {s.closed ? (
                <>
                  {s.kept}
                  <small>/{s.closed}</small>
                </>
              ) : (
                <NoData />
              )}
            </span>
            <span className={`g-sc-span ${why ? 'is-why' : ''}`} aria-hidden="true">
              {why ?? SPAN_WORDS[l]}
            </span>
          </li>
        );
      })}
    </ul>
  </section>
);
