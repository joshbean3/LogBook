import { fmtDate, shiftDays } from '@logbook/shared';
import { CalendarDays, ChevronRight, Flag, Layers, Mountain, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { openPlanDetail, openTemplate, whereFor, type PlanBlockProps } from './Blocks';
import { phaseWords, shortName } from './context';
import type { TrainingPhase } from './phases';

const PHASE_ICON: Record<TrainingPhase, LucideIcon> = { base: Layers, build: TrendingUp, peak: Mountain, taper: TrendingDown, race: Flag };

/**
 * The context row under Plan's title (docs/shape-system.md §3 context chips, as on Today): the block and where the page sits
 * in it (`Week 3 of 12`, `Starts Nov 9`; a tap opens the plan, or the builder when there is none), and the phase of the
 * week shown (`Build`, `The miles climb`). `mons` are the Mondays of the page shown: one for a week, the month's for a month.
 */
export const PlanContext = ({ block, mons, page }: { block: PlanBlockProps; mons: string[]; page: { from: string; to: string } }): React.JSX.Element | null => {
  const sheet = useSheet();
  const d = block.data;
  if (!d.boot) return <div className="ctx-row pl-ctx" aria-hidden="true" />;
  const b = d.b;
  if (!b)
    return (
      <div className="ctx-row pl-ctx">
        <Pressable className="ctx-chip pl-ctx-block" press="scale" onPress={() => openTemplate(sheet, block.getLog())} label="No block yet. Start one">
          <span className="ctx-ic" aria-hidden="true">
            <CalendarDays size={17} />
          </span>
          <span className="ctx-text">
            <span className="ctx-title">No block yet</span>
            <span className="ctx-sub">Start one in a minute</span>
          </span>
          <ChevronRight size={15} aria-hidden="true" />
        </Pressable>
      </div>
    );
  const where = whereFor(d, page);
  const ph = phaseWords(d.phases, mons.filter((m) => shiftDays(m, 6) >= b.start && m <= b.end));
  const Icon = ph ? PHASE_ICON[ph.phase] : null;
  return (
    <div className="ctx-row pl-ctx">
      <Pressable className="ctx-chip pl-ctx-block" press="scale" onPress={() => openPlanDetail(sheet, b, block.getLog())} label={`${b.name}, ${where}. Open the plan`}>
        <span className="ctx-ic is-lit" aria-hidden="true">
          <CalendarDays size={17} />
        </span>
        <span className="ctx-text">
          <span className="ctx-title">{shortName(b.name)}</span>
          <span className="ctx-sub">{where}</span>
        </span>
      </Pressable>
      {ph && Icon ? (
        <div className={`ctx-chip pl-ctx-phase ph-${ph.phase}`} role="note" aria-label={`Phase: ${ph.title}. ${ph.sub}`}>
          <span className="ctx-ic" aria-hidden="true">
            <Icon size={17} />
          </span>
          <span className="ctx-text">
            <span className="ctx-title">{ph.title}</span>
            <span className="ctx-sub">{ph.sub}</span>
          </span>
        </div>
      ) : (
        <div className="ctx-chip pl-ctx-phase" role="note" aria-label={`${fmtDate('md', b.start)} to ${fmtDate('md', b.end)}`}>
          <span className="ctx-ic" aria-hidden="true">
            <Flag size={17} />
          </span>
          <span className="ctx-text">
            <span className="ctx-title">{d.weeks} {d.weeks === 1 ? 'week' : 'weeks'}</span>
            <span className="ctx-sub">Ends {fmtDate('md', b.end)}</span>
          </span>
        </div>
      )}
    </div>
  );
};
