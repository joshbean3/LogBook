import { Check, ChevronRight, Flag } from 'lucide-react';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useChallengeCadence, useOrbsOn } from '../store';
import { openChallenge } from './ChallengeSheet';
import type { RowView, Scope } from './model';
import { useChallengeRowViews } from './useBoard';
import './challenge.css';

/**
 * The rows for the challenges on offer or running (spec section 8). `scope="today"`: at most one row, the day challenge on
 * its day (or the week challenge on a Monday when there is no day challenge), for the foot of Plan your day. `scope="page"`:
 * both, for the Orbs page. Each is one row of the shared template: the engine's title, and under it what it is and what
 * it is worth ("Today's challenge · 5 Orbs"), then progress once added, then "Done · 5 Orbs" for the rest of the day. A
 * row the assistant picked says so in its caption, with the reason under the title. A tap opens the sheet.
 *
 * Nothing renders when there is no challenge, when Orbs are off or challenges are off. A skipped, dropped, lapsed or
 * voided challenge leaves no row and no trace. The first challenge ever gets nothing extra: no tip, no badge, no dot.
 */
export const ChallengeRows = ({ scope }: { scope: Scope }) => {
  const on = useOrbsOn();
  const cadence = useChallengeCadence();
  if (!on || cadence === 0) return null;
  return <Rows scope={scope} />;
};

const Rows = ({ scope }: { scope: Scope }) => {
  const rows = useChallengeRowViews(scope);
  const sheet = useSheet();
  if (!rows.length) return null;
  return (
    <>
      {rows.map((v) => (
        <ChallengeRow key={v.key} view={v} onOpen={() => openChallenge(sheet, v.key, v.kind)} />
      ))}
    </>
  );
};

/** Is there a challenge row to show in this place now? For a parent that draws a group only while it has rows. */
export const useHasChallengeRows = (scope: Scope): boolean => {
  const on = useOrbsOn();
  const cadence = useChallengeCadence();
  const rows = useChallengeRowViews(scope);
  return on && cadence !== 0 && rows.length > 0;
};

export const ChallengeRow = ({ view, onOpen }: { view: RowView; onOpen: () => void }) => (
  <Pressable className={`k-row two ch-row${view.caption ? ' is-picked' : ''}`} press="surface" onPress={onOpen} label={view.label} data-challenge={view.kind} data-state={view.shown}>
    <span className="icon-tile" aria-hidden="true">
      {view.shown === 'done' ? <Check size={18} /> : <Flag size={18} />}
    </span>
    <span className="k-row-main" aria-hidden="true">
      {view.caption ? <span className="caps ch-cap">{view.caption}</span> : null}
      <span className="k-row-title">{view.title}</span>
      <span className="k-row-sub">{view.sub}</span>
    </span>
    <ChevronRight size={18} className="k-chev" aria-hidden="true" />
  </Pressable>
);
