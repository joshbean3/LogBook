import { shiftDays } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { Pressable } from '@/ui/Pressable';
import type { Log } from '../log/useLog';
import { fromEndingBlock, useOpenBuilder } from '../plan/PlanBuilder';
import { planEndOf } from './dayWords';

/**
 * Where the plan stops, as the hero's quiet caption (`Banking Plan ends Sun, Nov 8 · Next block ›`): a tap opens the builder
 * prefilled from the ending block, as a sheet over Today. Loaded lazily by the hero (it shows a few days a block).
 */
const PlanEndCaption = ({ log, text }: { log: Log; text: string }): React.JSX.Element => {
  const openBuilder = useOpenBuilder();
  const end = planEndOf(log, log.today);
  const profile = log.boot?.user.trainingProfile ?? null;
  return (
    <Pressable className="hero-caption" press="dim" label={`${text}. Plan the next block`} onPress={() => end && openBuilder(profile ? fromEndingBlock(end.block, profile) : { startDate: shiftDays(end.block.end, 1) })}>
      {text} · Next block <ChevronRight size={12} aria-hidden="true" />
    </Pressable>
  );
};

export default PlanEndCaption;
