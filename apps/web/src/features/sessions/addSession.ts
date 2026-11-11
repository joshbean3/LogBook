import { label, type Session } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutations } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui/Toast';
import { beforeWeekChange, markArriving } from '../plan/weekLive';
import { addedWords } from './addModel';

/*
 * Adding a session, for the Add sheet and the full editor alike (AddSessionSheet.tsx, SessionEditor.tsx): when the write may
 * run, and the write itself with its words.
 */

/**
 * Run `fn` once the closing sheet has left the screen (its close covers the sheet's own height in about 100 ms), or has
 * faded out (Reduce Motion), or after 240 ms whatever happened.
 */
export const afterSheetLeft = (fn: () => void) => {
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector<HTMLElement>('.sheet');
    const gone = !el || el.getBoundingClientRect().top >= window.innerHeight - 1 || Number(getComputedStyle(el).opacity) < 0.05;
    if (gone || performance.now() - t0 > 240) fn();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/**
 * Write a new session, and say so. Free of the sheet that made it (it has closed by the time the server answers):
 * the week on screen reads where its rows are (`beforeWeekChange`), the row goes in at once and is lit as it lands
 * (`markArriving`), one `drop` haptic, and the toast carries Undo. Undo takes the session as it is by then (moved to
 * another day since, it leaves from there; deleted since, there is nothing to do). A refusal by the server takes the row
 * back and says one plain line with Try again, which sends the same session again: nothing that was picked is lost.
 */
export const useAddSession = () => {
  const { add, remove } = useSessionMutations();
  const toast = useToast();
  const qc = useQueryClient();
  /** The session as the app holds it now, whichever month it is in. */
  const held = (id: string): Session | null => {
    for (const [, b] of qc.getQueriesData<MonthBundle>({ queryKey: ['month'] })) {
      const hit = b?.sessions.find((x) => x.id === id);
      if (hit) return hit;
    }
    return null;
  };
  const commit = (s: Session, today: string) => {
    let id = s.id;
    let undone = false;
    haptics.drop();
    beforeWeekChange(s.date);
    markArriving(s.id);
    add.mutateAsync(s).then(
      (saved) => {
        if (saved) id = saved.id;
      },
      () => {
        if (undone) return;
        haptics.error();
        const name = label(s);
        toast(`Couldn’t add ${name.length > 24 ? 'that' : name}.`, { label: 'Try again', fn: () => commit(s, today) });
      },
    );
    toast(addedWords(s, today), {
      label: 'Undo',
      fn: () => {
        undone = true;
        const now = held(id);
        if (!now) return;
        beforeWeekChange(now.date);
        remove.mutate(now);
      },
    });
  };
  return commit;
};
