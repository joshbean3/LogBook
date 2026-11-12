import { awaitingReview, periodSpan, shiftDays, type Aim, type GoalStatus, type ISODate } from '@logbook/shared';
import { CircleDashed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { goalOf, periodCaps, STATUS_WORD } from './model';
import { ReviewButtons } from './GoalSheets';
import { useCarry } from './CarryOver';
import { answerHeld, owedWords } from './follow';
import { KPin } from './Kit';
import './goals.css';

/**
 * The goals owed a review, one after another: the period and the goal, then Done · Partly · Missed. Each answer moves on to
 * the next. After Partly or Missed on yesterday's day goal, while today has none, the sheet offers to carry it over to
 * today before it moves on. At the end, a line and Done. "Later" is a quiet link: leaving is not the next move.
 */
const ReviewSheet = ({ total }: { total: number }) => {
  const today = useToday();
  const sheet = useSheet();
  const goals = useGoals();
  const carry = useCarry(today);
  const owed = awaitingReview(goals.data, today);
  const first = useRef(total);
  // the goal just answered Partly or Missed that today could take over, until it is carried or skipped
  const [offer, setOffer] = useState<{ goal: Aim; status: GoalStatus } | null>(null);
  // when the goal now asked about came on screen: the answers stay in place as the next goal comes in under them, so an
  // answer that lands at once (the second tap of a double tap) is not taken for a goal nobody has read (follow.ts)
  const shownAt = useRef(0);
  const asked = offer ? undefined : owed[0]?.id;
  useEffect(() => {
    shownAt.current = performance.now();
  }, [asked]);
  if (offer)
    return (
      <div className="gsheet k-sheet">
        <section className="k-card gs-card">
          <span className="caps">Yesterday · {STATUS_WORD[offer.status]}</span>
          <p className="gs-sentence serif">{offer.goal.text}</p>
          <p className="k-foot">Carry it over and it becomes today’s goal, with its steps as they stand.</p>
        </section>
        <KPin>
          <Button
            block
            onClick={() => {
              carry(offer.goal);
              setOffer(null);
            }}
          >
            Carry it over to today
          </Button>
          <Button variant="quiet" className="gs-later" onClick={() => setOffer(null)}>
            {owed.length ? 'Not now' : 'Done'}
          </Button>
        </KPin>
      </div>
    );
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
  const canCarry = g.level === 'day' && g.period === shiftDays(today, -1) && !goalOf(goals.data, 'day', today);
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
      <ReviewButtons goal={g} held={() => answerHeld(shownAt.current, performance.now())} onAnswer={(s) => (canCarry && (s === 'partly' || s === 'missed') ? setOffer({ goal: g, status: s }) : undefined)} />
      <KPin>
        <Button variant="quiet" className="gs-later" onClick={() => sheet.close()}>
          Later
        </Button>
      </KPin>
    </div>
  );
};

/** Open the review: one goal ("Did you hit it?") or several in turn ("How did they go?"). */
export const useOpenReview = () => {
  const sheet = useSheet();
  return (count: number) => sheet.open({ eyebrow: 'Review', title: count === 1 ? 'Did you hit it?' : 'How did they go?', body: <ReviewSheet total={count} /> });
};

/**
 * The review prompt for goals still open after their time ran out (layout plan 2.2 G2, C-6): one row of the shared template,
 * the same on Goals (in its card under the hero) and in Today's Plan your day. One owed goal: the goal as the title, where
 * it came from under it ("Still open from Mon, Nov 9"). Several: "3 goals to review", the oldest under it. A quiet "Review"
 * at the trailing edge; the whole row is the one target, and it opens the review sheet. Nothing renders while none is owed.
 */
export const ReviewRow = ({ today, className = '' }: { today: ISODate; className?: string }) => {
  const goals = useGoals();
  const review = useOpenReview();
  const owed = awaitingReview(goals.data ?? [], today);
  if (!owed.length) return null;
  const one = owed.length === 1;
  const oldest = owed[owed.length - 1]!;
  const title = one ? oldest.text : `${owed.length} goals to review`;
  const sub = one ? owedWords(oldest, today) : `Oldest from ${periodSpan(oldest.level, oldest.period)}`;
  return (
    <Pressable className={`k-row two g-follow-row g-review ${className}`.trim()} press="surface" onPress={() => review(owed.length)} label={`${title}. ${sub}. Review`}>
      <span className="icon-tile" aria-hidden="true">
        <CircleDashed size={18} />
      </span>
      <span className="k-row-main" aria-hidden="true">
        <span className="k-row-title">{title}</span>
        <span className="k-row-sub">{sub}</span>
      </span>
      <span className="g-follow-act" aria-hidden="true">
        Review
      </span>
    </Pressable>
  );
};
