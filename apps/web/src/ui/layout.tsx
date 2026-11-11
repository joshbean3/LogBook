import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useId, type ReactNode } from 'react';

/*
 * The layout kit (docs/layout-review.md §3, styles/layout.css): the pieces every tab builds a page from, so a section on
 * Today, Plan, Progress, Goals, Learned, Journal and Settings is spaced and named the same way.
 *
 *   PageSection   32 above, a header, its cards 12 below the header; size="sm" is a list-page group (Settings): 24 above, 8 below
 *   SectionHeader Fraunces 26/32 title (22/28 with size="sm"), a Dusk 15/20 500 meta 8 after it on its baseline, one quiet
 *                 Deep Sky 17/600 action with an 18 px chevron at the trailing edge (layout standard 6.1)
 *   Stack         cards 12 apart
 *   TileGrid      two columns of tiles at every phone width
 *   Footnote      13/18 grey, 8 under its card, 16 in (where the card's words start)
 */

export interface SectionHeaderProps {
  title: ReactNode;
  /** Quiet words at the title's baseline: a count, a range ("Last 30 days"). */
  meta?: ReactNode;
  /** A string with `onAction` draws the standard action ("History ›"); any other node sits in the action's slot. */
  action?: ReactNode;
  onAction?: () => void;
  /** VoiceOver's name for the action when its words alone are not enough. */
  actionLabel?: string;
  /** 'sm' for list pages (Settings): Fraunces 22/28; on a PageSection it also takes the list-page spacing (24 above, 8 below). */
  size?: 'lg' | 'sm';
  /** The heading's id (for aria-labelledby). */
  id?: string;
  /** The heading level. h2 by default. */
  level?: 2 | 3;
  className?: string;
}

export const SectionHeader = ({ title, meta, action, onAction, actionLabel, size = 'lg', id, level = 2, className = '' }: SectionHeaderProps) => {
  const H = level === 3 ? 'h3' : 'h2';
  return (
    <div className={`lb-head ${size === 'sm' ? 'is-sm' : ''} ${className}`.trim()}>
      <H className="lb-title" id={id}>
        {title}
      </H>
      {meta != null && meta !== '' && meta !== false ? <span className="lb-meta">{meta}</span> : null}
      {onAction && typeof action === 'string' ? (
        <button type="button" className="lb-act" onClick={onAction} aria-label={actionLabel}>
          {action}
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : action ? (
        <span className="lb-slot">{action}</span>
      ) : null}
    </div>
  );
};

export type PageSectionProps = Omit<SectionHeaderProps, 'title' | 'id' | 'className'> & {
  /** Leave it out for a headerless section (it still takes the section's space above). */
  title?: ReactNode;
  /** No space above: the first thing under the page header. */
  first?: boolean;
  /** The class of the header row, for a feature's own tweaks. */
  headClassName?: string;
  className?: string;
  children?: ReactNode;
  ref?: React.Ref<HTMLElement>;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>;

/** A section of a page: the header, then its cards. Labelled by its own title for VoiceOver. */
export const PageSection = ({ title, meta, action, onAction, actionLabel, size, level, first, headClassName, className = '', children, ...rest }: PageSectionProps) => {
  const hid = useId();
  const named = title != null && title !== '';
  return (
    <section className={`lb-sec ${size === 'sm' ? 'is-list' : ''} ${first ? 'is-first' : ''} ${className}`.replace(/\s+/g, ' ').trim()} aria-labelledby={named && !rest['aria-label'] ? hid : undefined} {...rest}>
      {named ? <SectionHeader title={title} meta={meta} action={action} onAction={onAction} actionLabel={actionLabel} size={size} level={level} id={hid} className={headClassName} /> : null}
      {children}
    </section>
  );
};

/** Cards in a column, 12 apart. */
export const Stack = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`lb-stack ${className}`.trim()} {...rest}>
    {children}
  </div>
);

/** Two columns of tiles, 12 apart, at every phone width (a tile's content fits 150). */
export const TileGrid = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`tiles ${className}`.trim()} {...rest}>
    {children}
  </div>
);

/** The small grey line under a card: what the card means, or what happens next. */
export const Footnote = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`lb-foot ${className}`.trim()} {...rest}>
    {children}
  </p>
);
