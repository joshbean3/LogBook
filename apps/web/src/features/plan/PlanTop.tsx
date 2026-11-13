import { CalendarDays, ChevronRight, ListChecks, Plus } from 'lucide-react';
import type * as React from 'react';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { openPlanDetail, openPlans, openTemplate, type PlanBlockProps } from './Blocks';
import { fromEndingBlock } from './builderModel';
import { planCardWords } from './topWords';
import './plantop.css';

/**
 * The plan row, the last thing on Fitness (guide 6.5a, "Fitness"): one quiet row, never the page's lead (the training card
 * leads). It sits under Progress and Trends, on the page itself (PlanView), so it is the same row whatever week or month
 * is on show. With no plan: a dashed plus, "Build a plan", "It takes a minute"; it opens the builder. With a plan: the
 * plan's name and where it stands ("Week 3 of 12 · Build", "Warm-up · Week 1 starts Mon"); a tap opens the plan's
 * summary (PlanSummary.tsx: what the assistant reads, the outline, and the assistant to change it). An ended plan's row
 * says so and opens the builder for the next one. A hold offers Open the plan, New plan and All plans.
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
        <Pressable className="pt-row card is-empty" press="surface" onPress={() => openTemplate(sheet, block.getLog())} holdMenu={menu} menuLabel="Plan actions" label="Build a plan. It takes a minute">
          <span className="pt-row-ic is-add" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="pt-row-main">
            <span className="pt-row-name">Build a plan</span>
            <span className="pt-row-state">It takes a minute</span>
          </span>
          <ChevronRight size={18} className="pt-chev" aria-hidden="true" />
        </Pressable>
      </div>
    );
  // an ended plan's row is the door to the next one: the builder, starting the day after, with the same answers
  const next = () => {
    const log = block.getLog();
    const prof = log.boot?.user.trainingProfile ?? null;
    openTemplate(sheet, log, false, prof ? fromEndingBlock(d.b!, prof) : undefined);
  };
  return (
    <div className="pt-plan-wrap">
      <Pressable
        className="pt-row card"
        press="surface"
        onPress={plan.ended ? next : () => openPlanDetail(sheet, d.b!, block.getLog())}
        holdMenu={menu}
        menuLabel="Plan actions"
        label={plan.ended ? `Your plan. ${plan.title}. ${plan.state}` : `Your plan. ${plan.title}. ${plan.state}. Open the plan summary to see it or change it with the assistant; hold for more`}
      >
        <span className="pt-row-ic" aria-hidden="true">
          <CalendarDays size={18} />
        </span>
        <span className="pt-row-main">
          <span className="pt-row-name">{plan.title}</span>
          <span className="pt-row-state">{plan.state}</span>
        </span>
        <ChevronRight size={18} className="pt-chev" aria-hidden="true" />
      </Pressable>
    </div>
  );
};
