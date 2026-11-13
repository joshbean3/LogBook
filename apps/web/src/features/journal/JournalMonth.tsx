import type * as React from 'react';
import { useMemo } from 'react';
import { PushedEntryScope, usePushedEntry } from '@/app/NavController';
import LearnedMonth from '../learned/LearnedMonth';

/**
 * A placeholder for the Journal month page (`/journal/:month`, pushed over the tab; the param is a `YYYY-MM`). Until the
 * merged page lands it shows the month of lines as it was: that page reads its month as the first of the month, so the
 * param is handed to it in that shape. Replaced at merge.
 */
export default function JournalMonth(): React.JSX.Element {
  const entry = usePushedEntry();
  const month = entry?.params.month;
  const asFirst = useMemo(() => (entry && month ? { ...entry, params: { ...entry.params, month: `${month}-01` } } : null), [entry, month]);
  if (!asFirst) return <LearnedMonth />;
  return (
    <PushedEntryScope entry={asFirst}>
      <LearnedMonth />
    </PushedEntryScope>
  );
}
