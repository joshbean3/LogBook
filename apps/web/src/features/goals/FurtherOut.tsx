import { periodOf, periodSpan, shiftDays, shiftPeriod, type GoalLevel, type ISODate } from '@logbook/shared';
import { CalendarRange, ChevronRight, Plus, Sunrise } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { FarHills, type FarHill } from '@/ui/poster';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { hillsOf, type FarLevel } from './further';
import { useOpenGoal } from './GoalSheets';
import { goalOf, setWords } from './model';
import { useReviewAccess } from './refine';
import './goalsPage.css';

const bare = (t: string) => t.replace(/[.\s]+$/, '');

/**
 * A goal that is ahead (tomorrow's, next week's) as a row: set, its name over the goal; not set, the invitation over its
 * dates with a plus in the tile. The whole row is the one target: it opens the goal, or the ways to set one.
 */
export const AheadRow = ({ level, period, name }: { level: GoalLevel; period: string; name: string }) => {
  const today = useToday();
  const goals = useGoals();
  const open = useOpenGoal();
  const goal = goalOf(goals.data, level, period);
  const when = periodSpan(level, period);
  const ask = name === 'Next week' ? 'Set next week’s goal' : setWords(level, period, today);
  const Icon = goal ? (level === 'day' ? Sunrise : CalendarRange) : Plus;
  return (
    <Pressable className="k-row two g-follow-row gx-ahead" press="surface" onPress={() => open(level, period)} label={goal ? `${name}, ${when}. ${bare(goal.text)}. Open` : `${ask}. ${name}, ${when}`}>
      <span className="icon-tile" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="k-row-main" aria-hidden="true">
        <span className="k-row-title">{goal ? goal.text : ask}</span>
        <span className="k-row-sub">{goal ? `${name} · ${when}` : when}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="k-chev" />
    </Pressable>
  );
};

/** What comes after today and this week, one row each: tomorrow's goal and next week's. */
const AheadSheet = () => {
  const today = useToday();
  const review = useReviewAccess();
  return (
    <div className="gsheet k-sheet">
      <div className="k-rows has-icons">
        <AheadRow level="day" period={shiftDays(today, 1)} name="Tomorrow" />
        <AheadRow level="week" period={shiftPeriod('week', periodOf('week', today), 1)} name="Next week" />
      </div>
      <p className="k-foot">{review === 'on' ? 'Set them the night before. The review makes each one specific and due on time.' : 'Set them the night before.'}</p>
    </div>
  );
};

/** Open "Coming up": tomorrow's goal and next week's. */
export const useOpenAhead = () => {
  const sheet = useSheet();
  return () => sheet.open({ eyebrow: 'Goals', title: 'Coming up', body: <AheadSheet /> });
};

/**
 * "Further out": the year, the month and this week as one card of three hills toward a pale sun (ui/poster FarHills).
 * A set goal is written on its hill with its caption and its steps done, and opens its sheet. Of the hills with no goal
 * only the nearest carries the plus and the invitation; the others show their name and still open the way to set one.
 * The caption on the sky opens "Coming up" (tomorrow's goal and next week's). A hill that takes a goal while the page is
 * open brings its words in once.
 */
export const FurtherOut = ({ today, now }: { today: ISODate; now: number }) => {
  const goals = useGoals();
  const open = useOpenGoal();
  const ahead = useOpenAhead();
  const hills = hillsOf(goals.data, today, now);

  // a hill that takes its goal while the page is open (never one that loads set)
  const was = useRef<Partial<Record<FarLevel, boolean>>>({});
  const [took, setTook] = useState<readonly FarLevel[]>([]);
  const sig = hills.map((h) => (h.goal ? 1 : 0)).join('');
  useEffect(() => {
    const fresh = hills.filter((h) => h.goal && was.current[h.level] === false).map((h) => h.level);
    for (const h of hills) was.current[h.level] = !!h.goal;
    setTook((t) => [...t.filter((l) => hills.find((h) => h.level === l)?.goal), ...fresh]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const hill = (h: (typeof hills)[number]): FarHill => ({
    caption: h.caption,
    words: h.words == null ? undefined : took.includes(h.level) ? <span className="gx-take">{h.words}</span> : h.words,
    value: h.value,
    plus: h.state === 'invite',
    onPress: () => open(h.level, h.period),
    label: h.label,
  });
  return (
    <FarHills
      className="gx-far"
      title={
        <Pressable className="gx-far-title" press="dim" onPress={ahead} label="Further out. Coming up: tomorrow and next week">
          Further out
          <ChevronRight size={12} aria-hidden="true" />
        </Pressable>
      }
      hills={[hill(hills[0]), hill(hills[1]), hill(hills[2])]}
    />
  );
};
