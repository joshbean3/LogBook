import { mondayOf } from '@logbook/shared';
import { CalendarDays, ChevronRight, ListChecks, Plus } from 'lucide-react';
import type * as React from 'react';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { openPlanDetail, openPlans, openTemplate, type PlanBlockProps } from './Blocks';
import { fromEndingBlock } from './builderModel';
import { firstMonOf, planCardWords } from './topWords';
import './plantop.css';

/**
 * The weeks-done row (layout plan P2, the Runna model): one 6 px mark per plan week, a done week Deep Sky, a week ahead in
 * the quiet dot, this week ringed in Night Ink. A picture of the line above it, so it is hidden from VoiceOver (the card's
 * label says the week).
 */
const WeekMarks = ({ weeks, wk }: { weeks: number; wk: number }) => (
  <span className="pt-marks" aria-hidden="true">
    {Array.from({ length: weeks }, (_, i) => (
      <i key={i} className={i + 1 < wk ? 'is-done' : i + 1 === wk ? 'is-now' : undefined} />
    ))}
  </span>
);

/**
 * The plan across the top of Plan, Plan's hero (`.card.is-hero.has-glow`, the screen's one glow): a caps eyebrow, the plan's
 * name in the serif, one line on where it stands (`Week 3 of 12 · Build`, `Warm-up · Week 1 starts Mon`), the weeks-done
 * row, and the chevron. A tap opens the plan's summary (PlanSummary.tsx: what the assistant reads, the outline, and the
 * assistant to change it); a hold offers Open the plan, New plan and All plans. An ended plan's card says so and opens the
 * builder for the next one. With no plan it opens the builder.
 */
export const PlanCard = ({ block }: { block: PlanBlockProps }): React.JSX.Element => {
  const sheet = useSheet();
  const d = block.data;
  if (!d.boot) return <div className="pt-plan-wrap is-wait" aria-hidden="true" />;
  const plan = planCardWords(d);
  const menu = (): ContextMenuItem[] => [
    ...(d.b ? [{ label: 'Open the plan', icon: <CalendarDays size={18} />, onSelect: () => openPlanDetail(sheet, d.b!, block.getLog()) }] : []),
    { label: 'New plan', icon: <Plus size={18} />, onSelect: () => openTemplate(sheet, block.getLog()) },
    { label: 'All plans', icon: <ListChecks size={18} />, onSelect: () => openPlans(sheet) },
  ];
  if (!plan || !d.b)
    return (
      <div className="pt-plan-wrap">
        <Pressable className="pt-plan card is-empty" press="surface" onPress={() => openTemplate(sheet, block.getLog())} holdMenu={menu} menuLabel="Plan actions" label="Your plan. No plan. Build one in a minute">
          <span className="pt-plan-ic" aria-hidden="true">
            <Plus size={20} />
          </span>
          <span className="pt-plan-main">
            <span className="caps pt-eyebrow">Your plan</span>
            <span className="pt-plan-name">No plan</span>
            <span className="pt-plan-state is-act">Build one in a minute</span>
          </span>
          <ChevronRight size={20} className="pt-chev" aria-hidden="true" />
        </Pressable>
      </div>
    );
  // an ended plan's card is the door to the next one: the builder, starting the day after, with the same answers
  const next = () => {
    const log = block.getLog();
    const prof = log.boot?.user.trainingProfile ?? null;
    openTemplate(sheet, log, false, prof ? fromEndingBlock(d.b!, prof) : undefined);
  };
  // the marks count the plan's numbered weeks; before week 1 (the warm-up) none is ringed, after the end all are done
  const wk = d.st === 'Upcoming' || mondayOf(d.t) < firstMonOf(d.b) ? 0 : d.st === 'Finished' ? d.weeks + 1 : d.wk;
  return (
    <div className="pt-plan-wrap">
      <Pressable
        className={`pt-plan card is-hero ${plan.ended ? 'is-ended' : 'has-glow'}`.trim()}
        press="surface"
        onPress={plan.ended ? next : () => openPlanDetail(sheet, d.b!, block.getLog())}
        holdMenu={menu}
        menuLabel="Plan actions"
        label={plan.ended ? `Your plan. ${plan.title}. ${plan.state}` : `Your plan. ${plan.title}. ${plan.state}. Open the plan summary to see it or change it with the assistant; hold for more`}
      >
        <span className="pt-plan-main">
          <span className="caps pt-eyebrow">Your plan</span>
          <span className="pt-plan-name">{plan.title}</span>
          <span className={`pt-plan-state ${plan.ended ? 'is-act' : ''}`.trim()}>{plan.state}</span>
          {plan.ended || d.weeks < 2 ? null : <WeekMarks weeks={d.weeks} wk={wk} />}
        </span>
        <ChevronRight size={20} className="pt-chev" aria-hidden="true" />
      </Pressable>
    </div>
  );
};
