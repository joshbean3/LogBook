import type * as React from 'react';
import type { SVGProps } from 'react';

/**
 * The Orby icon set (guide 7; source docs/brand/tools/icons.mjs, kept in step by hand: the paths are copied unmodified).
 * A 24 px grid, a 1.75 px stroke with round caps and joins, `currentColor`, no fill but a single 1.3 px center dot. Sizes:
 * 22 in the tabs (26 above 150 percent Larger Text, from CSS), 18 in buttons and chips, 15 inside a 22 px tile, 28 on
 * sheets. Lucide stays allowed where the set has no glyph, at the same stroke (base.css sets it for every Lucide icon).
 */
const PATHS = {
  today: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M5.5 18.5l1.6-1.6M16.9 7.1l1.6-1.6" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  learned: <path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />,
  plan: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  progress: (
    <>
      <path d="M3 19.5h18" />
      <path d="M4.5 15.5l4.5-5 3.5 3 4.6-5.4" />
      <circle cx="19" cy="6.3" r="2" />
    </>
  ),
  journal: <path d="M12 6.5c-2-1.6-4.8-2-8-1.6v13.6c3.2-.4 6 0 8 1.6 2-1.6 4.8-2 8-1.6V4.9c-3.2-.4-6 0-8 1.6zM12 6.5v13.6" />,
  run: (
    <>
      <circle cx="14.5" cy="4.8" r="1.8" />
      <path d="M8 20.5l3-5.5 3 2.5v4M6 11l3.5-3 4 .5 2.5 3.5 3 1M11 15l1.5-6.5" />
    </>
  ),
  lift: <path d="M7 8v8M17 8v8M4.5 10v4M19.5 10v4M7 12h10" />,
  habit: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 4.9-5.2" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  wake: <path d="M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 6v2.5M5.2 9.7l1.6 1.4M18.8 9.7l-1.6 1.4M9.5 21h5" />,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  favorite: <path d="M12 19.5s-7.5-4.4-7.5-9.6A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.5c0 5.2-7.5 9.6-7.5 9.6z" />,
  send: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 16V8.5M8.8 11.5L12 8.3l3.2 3.2" />
    </>
  ),
  attach: <path d="M15.5 7.5l-6.8 6.8a1.9 1.9 0 0 0 2.7 2.7l7-7a3.9 3.9 0 0 0-5.5-5.5l-7 7a5.8 5.8 0 0 0 8.2 8.2l5.4-5.4" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />,
  edit: <path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.9 2.9L8.4 18.5zM14 6.8l2.9 2.9" />,
  history: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3h3" />
      <path d="M12 8v4.2l2.6 1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M15.5 15.5l4.5 4.5" />
    </>
  ),
} as const;

export type BrandIconName = keyof typeof PATHS;
export const BRAND_ICONS = Object.keys(PATHS) as BrandIconName[];

export interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: BrandIconName;
  /** px; default 24 (the grid). Tabs 22, buttons and chips 18, in a 22 px tile 15, on sheets 28. */
  size?: number;
}

/** One glyph of the set. Decorative unless the caller gives it a label (`aria-label` and `role="img"`). */
export const BrandIcon = ({ name, size = 24, className, ...rest }: BrandIconProps): React.JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={rest['aria-label'] ? undefined : true}
    className={`brand-icon${className ? ` ${className}` : ''}`}
    {...rest}
  >
    {PATHS[name]}
  </svg>
);

/** A glyph bound to its name, shaped like a Lucide component (`<Icon size={22} />`), for tables of icons such as the tabs. */
export type BrandIconComponent = (props: Omit<BrandIconProps, 'name'>) => React.JSX.Element;
const bound = (name: BrandIconName): BrandIconComponent => {
  const C = (props: Omit<BrandIconProps, 'name'>) => <BrandIcon name={name} {...props} />;
  C.displayName = `BrandIcon(${name})`;
  return C;
};
export const TodayIcon = bound('today');
export const GoalsIcon = bound('goals');
export const LearnedIcon = bound('learned');
export const PlanIcon = bound('plan');
export const ProgressIcon = bound('progress');
export const JournalIcon = bound('journal');
export const RunIcon = bound('run');
export const LiftIcon = bound('lift');
export const HabitIcon = bound('habit');
export const FavoriteIcon = bound('favorite');
