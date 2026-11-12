import type * as React from 'react';
import { markParts } from './days';

/** Words with what was searched for marked in them (days.ts `markParts`); with nothing searched, the words alone. */
export const Marked = ({ text, q }: { text: string; q?: string | null }): React.JSX.Element => {
  if (!q) return <>{text}</>;
  return (
    <>
      {markParts(text, q).map((p, i) =>
        p.hit ? (
          <mark key={i} className="jn-mark">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
};
