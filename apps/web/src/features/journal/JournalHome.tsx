import type * as React from 'react';
import type { Quote } from '@logbook/shared';
import { EyeOff } from 'lucide-react';
import { FavoriteIcon } from '@/ui/icons';
import { useDaily, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Pressable, useToast } from '@/ui';
import { popFav } from './feel';

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/**
 * The quote line (contracts §F, docs/feel.md §8): the day's quote as one quiet serif line, 44 tall (15/20 `--ink-3`). Tap:
 * the quote goes to `onInsert` as a prompt (`“…” (Author)`). Hold 450 ms: `Favorite · Hide`; Hide has Undo. No swipe. It
 * sits inside Journal's writer and the Close card's. `date` is the day the line sits on (the quote is the day's, `/daily`).
 * A favorite has no star on the line, so the `toggle` lands when a star's pop would peak (`popFav`). `labelled` (the
 * Journal's writer): the line says what it is ("Today's quote. Tap to use") and the quote may take two lines.
 */
export const QuoteLine = ({ date, onInsert, labelled = false }: { date: string; onInsert: (text: string) => void; labelled?: boolean }): React.JSX.Element | null => {
  const daily = useDaily();
  const { quotePrefs, another } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  if (!q) return null;
  const items = [
    {
      label: q.fav ? 'Unfavorite' : 'Favorite',
      icon: <FavoriteIcon size={18} />,
      onSelect: () => {
        if (!q.fav) popFav();
        quotePrefs.mutate({ id: q.id, fav: !q.fav });
      },
    },
    ...(q.mine
      ? []
      : [
          {
            label: 'Hide',
            icon: <EyeOff size={18} />,
            destructive: true,
            onSelect: () => {
              haptics.delete();
              quotePrefs.mutate({ id: q.id, hidden: true });
              another.mutate('quote');
              toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
            },
          },
        ]),
  ];
  return (
    <Pressable className={`qline quote-line ${labelled ? 'is-labelled' : ''}`} press="dim" data-date={date} onPress={() => onInsert(asPrompt(q))} holdMenu={items} menuLabel="Today’s quote" label={`Today’s quote${labelled ? '. Tap to use' : ''}: ${q.text}${q.author ? `, ${q.author}` : ''}${labelled ? '' : '. Use as a prompt'}`}>
      <span className="qline-in">
        {labelled ? (
          <span className="qline-hint" aria-hidden="true">
            Today’s quote. Tap to use
          </span>
        ) : null}
        <span className="qline-text">“{q.text}”</span>
      </span>
    </Pressable>
  );
};
