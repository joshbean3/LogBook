import { Plus } from 'lucide-react';
import type * as React from 'react';
import { PushedBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { useLog } from '../log/useLog';
import { PlansPanel } from './Blocks';
import { useOpenBuilder } from './PlanBuilder';
import './plan.css';

/**
 * `/settings/plans` (spec M10, contracts §F): the block list as a pushed page at depth 2 over Settings, with `New block` in
 * the bar. The rows open each plan's detail sheet; `New block` opens the builder (large sheet). The list is the plans
 * panel Plan's block card opened as a sheet.
 */
export default function PlansPage(): React.JSX.Element {
  const log = useLog([]);
  const openBuilder = useOpenBuilder();
  return (
    <div className="page plans-page">
      <PushedBar
        title="Plans"
        trailing={
          <Pressable className="icon-btn pl-new-block" press="scale" onPress={() => openBuilder()} label="New block">
            <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          </Pressable>
        }
      />
      <div className="section">{log.boot ? <PlansPanel log={log} foot={false} /> : null}</div>
    </div>
  );
}
