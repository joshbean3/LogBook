import { monthOf } from '@logbook/shared';
import type { Mutation, QueryClient } from '@tanstack/react-query';
import { keys } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { getDraft, setDraft } from '../journal/drafts';

/** The Journal's own words for a refused entry (features/journal/JournalDaySection.tsx `Composer.save`). */
export const REFUSED_TEXT = 'Couldn’t save that. Your words are back in the field.';

type AnyMutation = Mutation<unknown, unknown, unknown, unknown>;
/** The journal's add (`useJournalMutations().add`) is the one mutation whose variables are exactly `{ date, text }`. */
const addOf = (m: AnyMutation, date: string): string | null => {
  const v = m.state.variables as Record<string, unknown> | undefined;
  if (!v || typeof v !== 'object' || v.date !== date || typeof v.text !== 'string' || Object.keys(v).length !== 2) return null;
  return v.text;
};

/**
 * Follows the journal entry a Today composer has just sent until the server answers, from the mutation cache, so it holds
 * whatever is mounted by then (code review 2 #1, #2; day review 2 #1). The Composer's own error path is a callback passed to
 * `mutate()`, which TanStack runs only while that Composer is mounted; Today's cards take the field away on Save (the entry
 * crossfades into its place, or the composer closes), so a refusal that comes back after a normal round trip found no one.
 *
 * On a refusal: the provisional entry leaves the month at once; the words go back into the day's draft and the error toast
 * is raised, unless the Composer was still there and did both itself (its `onError` runs first and puts exactly the words
 * back); then `onRefused` (the card brings the field back). Call right after the Composer's `onSaved`, inside the Save task: the add is already in the cache as
 * `pending`. Returns the words being sent (null when no add is in flight) and a stop.
 */
export const watchJournalAdd = (qc: QueryClient, date: string, { toast, onRefused }: { toast: (text: string) => void; onRefused: () => void }): { text: string | null; stop: () => void } => {
  const cache = qc.getMutationCache();
  const target = (cache.getAll() as AnyMutation[]).filter((m) => m.state.status === 'pending' && addOf(m, date) !== null).at(-1);
  const text = target ? addOf(target, date) : null;
  if (!target || text === null) return { text: null, stop: () => undefined };
  let done = false;
  const unsub = cache.subscribe((e) => {
    if (done || e.type !== 'updated' || e.mutation !== target) return;
    const st = target.state.status;
    if (st !== 'success' && st !== 'error') return;
    done = true;
    unsub();
    if (st === 'success') return;
    // the provisional entry leaves the month now (the add's own onError refetches it, a round trip later), so nothing reads
    // the refused words as an entry meanwhile: the Close card's title, its entries, the Journal
    qc.setQueryData<MonthBundle>(keys.month(monthOf(date)), (b) => (b ? { ...b, journal: b.journal.filter((j) => !(j.id.startsWith('tmp-') && j.date === date && j.text === text)) } : b));
    // after the observer's callbacks (a mounted Composer's set(v) and toast)
    setTimeout(() => {
      const cur = getDraft(date).trim();
      if (cur !== text.trim()) {
        setDraft(date, cur ? `${text}\n\n${cur}` : text);
        toast(REFUSED_TEXT);
      }
      onRefused();
    }, 0);
  });
  return {
    text,
    stop: () => {
      if (done) return;
      done = true;
      unsub();
    },
  };
};
