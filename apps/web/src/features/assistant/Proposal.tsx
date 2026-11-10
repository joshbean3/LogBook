import type { AssistantChange, AssistantProposal } from '@logbook/shared';
import { Bike, CalendarCheck, CalendarDays, CalendarX, Check, CheckSquare, Dumbbell, Footprints, Moon, RotateCcw, Target, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useAssistantActions } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { proposalFailure } from './errors';
import { assistantStore } from './store';

/** What a change is about, for its icon: a workout added, a change to the plan's days, a to-do, a goal. Deletes are flagged. */
const kindOf = (c: AssistantChange): { Icon: LucideIcon; risky?: boolean } => {
  const op = c.op;
  switch (op.op) {
    case 'add_session':
      return { Icon: op.kind === 'lift' ? Dumbbell : op.kind === 'cross' ? Bike : op.kind === 'rest' ? Moon : Footprints };
    case 'mark_session':
      return { Icon: CalendarCheck };
    case 'delete_session':
      return { Icon: CalendarX, risky: true };
    case 'move_session':
    case 'update_session':
      return { Icon: CalendarDays };
    case 'delete_todo':
      return { Icon: CheckSquare, risky: true };
    case 'add_todo':
    case 'update_todo':
      return { Icon: CheckSquare };
    default:
      return { Icon: Target };
  }
};

/** A proposal of more than six changes shows a count line, the first six and a "Show all" (a plan can be fifty). */
const FOLD_OVER = 6;
const changesWord = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

/** "12 changes: 6 added, 3 removed, 3 moved": every kind named, so nothing is hidden behind Show all before Apply. */
export const countLine = (changes: AssistantChange[]): string => {
  const n = { added: 0, removed: 0, moved: 0, changed: 0 };
  for (const c of changes) {
    const op = c.op.op;
    if (op.startsWith('add_')) n.added++;
    else if (op.startsWith('delete_')) n.removed++;
    else if (op === 'move_session') n.moved++;
    else n.changed++;
  }
  const parts = (Object.keys(n) as (keyof typeof n)[]).filter((k) => n[k] > 0).map((k) => `${n[k]} ${k}`);
  return `${changesWord(changes.length)}: ${parts.join(', ')}`;
};

/**
 * A proposal (docs/inspiration.md §3, Proposal card): the summary, then each change on its own card with its icon, its
 * words and its reason, and a Remove for leaving that one out. Apply names how many will run; after it, Undo.
 */
export const ProposalCard = ({ p, waiting }: { p: AssistantProposal; waiting: boolean }) => {
  const { apply, undo, dismiss } = useAssistantActions();
  const [all, setAll] = useState(false);
  const toast = useToast();
  const skipped = new Set(p.skipped ?? []);
  const live = p.changes.length - skipped.size;
  const open = p.status === 'proposed';
  const busy = apply.isPending || undo.isPending || dismiss.isPending;
  const shown = all || p.changes.length <= FOLD_OVER ? p.changes : p.changes.slice(0, 6);
  const toggle = (i: number) => {
    const next = skipped.has(i) ? [...skipped].filter((x) => x !== i) : [...skipped, i];
    assistantStore.setProposal({ ...p, skipped: next.sort((a, b) => a - b) });
  };
  const run = async (fn: () => Promise<AssistantProposal>, ok?: () => void) => {
    try {
      const next = await fn();
      // the server says what it skipped once applied; a dismissed one keeps what was removed here
      assistantStore.setProposal(next.skipped || next.status !== 'dismissed' ? next : { ...next, skipped: p.skipped });
      ok?.();
    } catch (e) {
      toast(proposalFailure(e));
    }
  };
  const applied = p.status === 'applied';
  return (
    <section className={`as-proposal card is-${p.status}`} data-waiting={waiting ? '' : undefined} aria-label="Proposed changes">
      <header className="as-prop-head">
        <span className="caps">{open ? `${changesWord(p.changes.length)} to review` : 'Changes'}</span>
        <p className="as-proposal-sum">{p.summary}</p>
        {p.changes.length > FOLD_OVER ? <p className="as-prop-count">{countLine(p.changes)}</p> : null}
      </header>
      <ul className="as-changes">
        {shown.map((c, i) => {
          const { Icon, risky } = kindOf(c);
          const off = skipped.has(i);
          return (
            <li key={i} className={`as-change${off ? ' is-off' : ''}${risky ? ' is-risky' : ''}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <span className="icon-tile as-change-ic" aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span className="as-change-body">
                <span className="as-change-text">
                  {off ? <span className="sr-only">Removed: </span> : null}
                  {c.label}
                </span>
                {c.reason ? <span className="as-change-why">{c.reason}</span> : null}
              </span>
              {open ? (
                <button type="button" className="as-change-x" disabled={busy} aria-label={off ? `Put back: ${c.label}` : `Remove: ${c.label}`} onClick={() => toggle(i)}>
                  {off ? <RotateCcw size={15} aria-hidden="true" /> : <X size={15} strokeWidth={2.4} aria-hidden="true" />}
                </button>
              ) : off ? (
                <span className="as-change-left">Left out</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {shown.length < p.changes.length ? (
        <button type="button" className="as-more" onClick={() => setAll(true)}>
          Show all {p.changes.length} changes
        </button>
      ) : null}
      {open ? (
        <div className="as-proposal-foot">
          <Button variant="quiet" disabled={busy} onClick={() => void run(() => dismiss.mutateAsync(p.id))}>
            Not now
          </Button>
          <Button variant="primary" className="as-apply" disabled={busy || live === 0} aria-busy={apply.isPending} onClick={() => void run(() => apply.mutateAsync({ id: p.id, skip: p.skipped }), () => haptics.drop())}>
            {apply.isPending ? 'Applying…' : live === 0 ? 'Apply' : `Apply ${changesWord(live)}`}
          </Button>
        </div>
      ) : (
        <div className="as-proposal-state">
          <span className={`as-status ${applied ? 'is-on' : ''}`}>
            {applied ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : p.status === 'undone' ? <RotateCcw size={14} strokeWidth={2.4} aria-hidden="true" /> : <X size={14} strokeWidth={2.4} aria-hidden="true" />}
            {applied ? (skipped.size ? `Applied ${live} of ${p.changes.length}` : 'Applied') : p.status === 'undone' ? 'Undone' : 'Not applied'}
          </span>
          {applied ? (
            <button type="button" className="as-undo" disabled={busy} onClick={() => void run(() => undo.mutateAsync(p.id))}>
              <RotateCcw size={14} aria-hidden="true" /> {undo.isPending ? 'Undoing…' : 'Undo'}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
};

