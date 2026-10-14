import type { CSSProperties } from 'react';

/**
 * Ghost previews for empty states (critic B1). A ghost shows the *shape* of what will fill the screen, never content:
 * no numbers, no words, no dates, no domains, nobody's entries. Made-up personal data in a private log reads as a bug or as
 * someone else's account. These three cover every empty state in the app; pass one as `EmptyState`'s `ghost` (or the
 * shorthand `ghost="bars" | "rows" | "lines"`). They are plain blocks (`--ghost-ink`, bright enough to read at the 30% the
 * EmptyState draws its ghost at), aria-hidden, and never move.
 */

/** Heights (0–1) of a chart that rises, dips once, and rises again: reads as "a chart of weeks", says nothing. */
const BAR_SHAPE = [0.42, 0.55, 0.48, 0.66, 0.6, 0.78, 0.52, 0.84, 0.72, 0.9, 0.8, 0.96];
/** Widths (%) the lines of a row cycle through, so rows don't look stamped out. */
const TITLE_W = [62, 48, 70, 55, 66];
const SUB_W = [35, 28, 40, 32, 24];

export interface GhostBarsProps {
  /** How many bars (weeks). Default 8. */
  count?: number;
  /** Chart height in px. Default 120. */
  height?: number;
  className?: string;
}
/** A bar chart with no axis, no numbers and no labels (Progress's weeks). */
export const GhostBars = ({ count = 8, height = 120, className = '' }: GhostBarsProps) => (
  <div className={`ghost ghost-bars ${className}`} aria-hidden="true" style={{ height }}>
    {Array.from({ length: count }, (_, i) => (
      <span key={i} className="ghost-bar" style={{ height: `${Math.round(BAR_SHAPE[(i + BAR_SHAPE.length - count) % BAR_SHAPE.length]! * 100)}%` }} />
    ))}
  </div>
);

export interface GhostLinesProps {
  /** Line widths in %, top to bottom. Default 60% then 35% (a title and a sub line). */
  widths?: number[];
  /** Line height in px. Default 12. */
  h?: number;
  className?: string;
  style?: CSSProperties;
}
/** A block of text as grey bars: by default two lines, 60% and 35% wide (a paragraph, a quote, an entry). */
export const GhostLines = ({ widths = [60, 35], h = 12, className = '', style }: GhostLinesProps) => (
  <div className={`ghost ghost-lines ${className}`} aria-hidden="true" style={style}>
    {widths.map((w, i) => (
      <span key={i} className="ghost-line" style={{ width: `${w}%`, height: i === 0 ? h + 2 : h }} />
    ))}
  </div>
);

export interface GhostRowsProps {
  /** How many rows. Default 3. */
  rows?: number;
  /** A shape at the start of each row: a dot (an entry, a link's icon), a square (a to-do), or nothing. Default none. */
  lead?: 'dot' | 'square' | 'none';
  /** Row height in px. Default 60 (like `SkeletonRows`). */
  rowHeight?: number;
  className?: string;
}
/** List rows, each two grey text bars (60% and 35%) with hairlines between: Journal entries, Library, Reads. */
export const GhostRows = ({ rows = 3, lead = 'none', rowHeight = 60, className = '' }: GhostRowsProps) => (
  <div className={`ghost ghost-rows ${className}`} aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="ghost-row" style={{ minHeight: rowHeight }}>
        {lead !== 'none' ? <span className={`ghost-lead ghost-lead-${lead}`} /> : null}
        <GhostLines widths={[TITLE_W[i % TITLE_W.length]!, SUB_W[i % SUB_W.length]!]} />
      </div>
    ))}
  </div>
);

/** `EmptyState`'s shorthand for the three ghosts. */
export type GhostKind = 'bars' | 'rows' | 'lines';
export const ghostOf = (kind: GhostKind) => (kind === 'bars' ? <GhostBars /> : kind === 'rows' ? <GhostRows /> : <GhostLines />);
