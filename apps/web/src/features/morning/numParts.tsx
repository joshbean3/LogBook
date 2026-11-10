import type * as React from 'react';

/**
 * A sentence with its numbers set apart, for a line in the serif whose times and counts change (`Out the door in 22 min`
 * ticks): the numbers go in `.mc-head-n` spans, which set them in Inter with even figures (guide 4.4: Fraunces has no
 * tabular figures, so it never sets a number that changes). `Out the door at 6:45` -> `Out the door at `, `<span>6:45</span>`.
 */
export const numParts = (text: string): React.ReactNode[] =>
  text
    .split(/(\d[\d:]*(?:\s?[AP]M)?)/)
    .map((part, i) =>
      i % 2 ? (
        <span key={i} className="mc-head-n">
          {part}
        </span>
      ) : (
        part
      ),
    )
    .filter((p) => p !== '');
