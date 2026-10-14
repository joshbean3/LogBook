import type { CSSProperties, ReactNode } from 'react';

export interface SkeletonProps {
  /** Width: a number is px, a string any CSS length. Default 100%. */
  w?: number | string;
  /** Height: a number is px. Default 16 (a line of text). */
  h?: number | string;
  /** Corner radius: 'card' (20), 'control' (12), 'line' (6), 'pill', or px. Default 'line'. */
  r?: 'card' | 'control' | 'line' | 'pill' | number;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}
const RADIUS = { card: 'var(--r-lg)', control: 'var(--r-md)', line: '6px', pill: 'var(--r-pill)' } as const;
const len = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

/**
 * One grey block standing in for content that is on its way: `surface` at 100%, no shimmer, nothing moves. Compose blocks
 * into the shape of the real layout (a hero, three rows) so the page lays out once. Blocks are aria-hidden; wrap a group of
 * them in `SkeletonGroup`, which announces "Loading" once.
 */
export const Skeleton = ({ w = '100%', h = 16, r = 'line', circle, className = '', style }: SkeletonProps) => (
  <span
    className={`skel ${className}`}
    aria-hidden="true"
    style={{ width: len(circle ? (w === '100%' ? h : w) : w), height: len(h), borderRadius: circle ? '50%' : typeof r === 'number' ? `${r}px` : RADIUS[r], ...style }}
  />
);

/** A set of skeleton blocks that is announced once ("Loading to-dos") and marked busy. */
export const SkeletonGroup = ({ label = 'Loading', children, className = '', style }: { label?: string; children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={`skel-group ${className}`} role="status" aria-busy="true" aria-label={label} style={style}>
    {children}
  </div>
);

const rowBlocks = (rows: number, sub: boolean) =>
  Array.from({ length: rows }, (_, i) => (
    <div className="skel-row" key={i}>
      <Skeleton w={`${62 - ((i * 13) % 24)}%`} h={14} />
      {sub ? <Skeleton w={`${34 + ((i * 7) % 18)}%`} h={12} /> : null}
    </div>
  ));

/** Rows of an edge-to-edge or grouped list: a title line and a shorter sub line each, 60px tall. */
export const SkeletonRows = ({ rows = 3, label, sub = true }: { rows?: number; label?: string; sub?: boolean }) => (
  <SkeletonGroup label={label} className="skel-rows">
    {rowBlocks(rows, sub)}
  </SkeletonGroup>
);

/** A tab page on its way: header lines, a hero card, three rows. Used by the app shell while the log opens. */
export const SkeletonPage = ({ label = 'Loading' }: { label?: string }) => (
  <SkeletonGroup label={label} className="skel-page">
    <Skeleton w={96} h={11} />
    <Skeleton w={150} h={40} r="control" style={{ marginTop: 8 }} />
    <Skeleton h={220} r="card" style={{ marginTop: 24 }} />
    <div className="skel-rows" style={{ marginTop: 48 }}>
      {rowBlocks(3, true)}
    </div>
  </SkeletonGroup>
);
