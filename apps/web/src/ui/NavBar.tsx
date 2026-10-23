import { ChevronLeft } from 'lucide-react';
import type { MotionValue } from 'motion/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { usePushedEntry, useNavState } from '@/app/NavController';
import { WORD_MAX } from '@/lib/gesture';
import type { ContextMenuItem } from './ContextMenu';
import type { DayPagerHandle } from './DayPager';
import { tabDef } from './nav';
import { usePop } from './PushedLayer';
import { usePress } from './usePress';

/**
 * The bar (docs/feel.md §2, contracts §B.2). STEP 1 OF WP1: the captions, `PushedBar` and `BackButton` are final; `NavBar`,
 * `DateStrip` and `TodayPill` render their contract DOM without the stacked labels, the disc's motion or the title block's
 * hold menu, which arrive in the next step.
 */

// ---------- words ----------
const D = (s: string) => new Date(`${s}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86_400_000);
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => D(s).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
const MON = (s: string) => fmt(s, { month: 'short' }).toUpperCase();
const DAYN = (s: string) => String(D(s).getUTCDate());

/** The date part: 'full' 'THU, OCT 29' → 'short' 'OCT 29' → 'day' '29'. The word never drops; the date shortens. */
export const dayCaption = (date: string, _today?: string, form: 'full' | 'short' | 'day' = 'full'): string => {
  if (form === 'day') return DAYN(date);
  if (form === 'short') return `${MON(date)} ${DAYN(date)}`;
  return `${fmt(date, { weekday: 'short' }).toUpperCase()}, ${MON(date)} ${DAYN(date)}`;
};
/** 'STEADY' from 'Steady': upper-cased, at most WORD_MAX (12) characters, a longer legacy word clipped with '…'; null when empty. */
export const capsWord = (word?: string | null): string | null => {
  const w = (word ?? '').trim();
  if (!w) return null;
  const up = w.toUpperCase();
  return up.length > WORD_MAX ? `${up.slice(0, WORD_MAX - 1)}…` : up;
};
/** 'Today' | 'Tomorrow' | 'Yesterday' | 'Sat 24' (±6 days) | 'Sun, Oct 11' | 'Sun, Oct 11, 2025'. Never from data. */
export const dayTitle = (date: string, today: string): string => {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (Math.abs(n) <= 6) return `${fmt(date, { weekday: 'short' })} ${DAYN(date)}`;
  const base = `${fmt(date, { weekday: 'short' })}, ${fmt(date, { month: 'short' })} ${DAYN(date)}`;
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base}, ${date.slice(0, 4)}`;
};
/** 'THIS WEEK · OCT 19–25' | 'NEXT WEEK · OCT 26–NOV 1' | 'LAST WEEK · …' | 'OCT 12–18'. */
export const weekCaption = (mon: string, today: string): string => {
  const sun = new Date(D(mon).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const range = MON(mon) === MON(sun) ? `${MON(mon)} ${DAYN(mon)}–${DAYN(sun)}` : `${MON(mon)} ${DAYN(mon)}–${MON(sun)} ${DAYN(sun)}`;
  const tMon = new Date(D(today).getTime() - ((D(today).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const w = Math.round(daysBetween(tMon, mon) / 7);
  if (w === 0) return `THIS WEEK · ${range}`;
  if (w === 1) return `NEXT WEEK · ${range}`;
  if (w === -1) return `LAST WEEK · ${range}`;
  return range;
};
/** 'OCTOBER 2026'. */
export const monthCaption = (first: string): string => fmt(first, { month: 'long', year: 'numeric' }).toUpperCase();

// ---------- the root bar ----------
/** cur always; prev/next only while a pager can drive the bar (rendered stacked and bound to `progress`). */
export interface StackedLabel {
  prev?: string;
  cur: string;
  next?: string;
}
export interface NavBarProps {
  /** The owner's word (Today only; capsWord(settings.focus.word)): `.nb-word` 'STEADY · ', opacity 1 at every --hdr. */
  word?: string | null;
  /** The date part, `.nb-date`. */
  caps: StackedLabel;
  title: StackedLabel;
  progress?: MotionValue<number>;
  /** The 80 px slot: <Avatar/> | <TodayPill/> | nothing. */
  trailing?: ReactNode;
  /** Plan: the slot is 96 wide (`.nb-bar.has-seg`) and holds <Segmented/>. */
  wideTrailing?: boolean;
  onTitlePress?: () => void;
  titleMenu?: ContextMenuItem[] | (() => ContextMenuItem[]);
  titleLabel?: string;
  gap?: 16 | 24;
  /** The DateStrip (Today only); rendered sticky under the bar. */
  children?: ReactNode;
  /** Ref to the large title row, for handle.attach. */
  titleRef?: React.Ref<HTMLElement>;
}

/** Returns a FRAGMENT: .nb-bar, .nb-title, {children}, .nb-gap, as direct children of the page element. Never a wrapper. */
export const NavBar = ({ word, caps, title, trailing, wideTrailing, onTitlePress, titleLabel, gap = 24, children, titleRef }: NavBarProps): React.JSX.Element => (
  <>
    <div className={`nb-bar ${wideTrailing ? 'has-seg' : ''}`}>
      <button type="button" className="nb-cap" onClick={onTitlePress} aria-label={titleLabel}>
        {word ? <span className="nb-word">{word} · </span> : null}
        <span className="nb-date">{caps.cur}</span>
      </button>
      <button type="button" className="nb-inline" onClick={onTitlePress} tabIndex={-1} aria-hidden="true">
        {title.cur}
      </button>
      <div className="nb-trail">{trailing}</div>
    </div>
    <h1 className="nb-title" ref={titleRef as React.Ref<HTMLHeadingElement>} onClick={onTitlePress}>
      {title.cur}
    </h1>
    {children}
    <div className={`nb-gap ${gap === 24 ? 'lg' : ''}`} />
  </>
);

export type StripStatus = 'done' | 'bonus' | 'floor' | 'planned' | 'missed' | 'skipped' | 'rest' | null;
export interface DateStripProps {
  shown: string;
  today: string;
  handle: DayPagerHandle;
  stripRef?: React.Ref<HTMLElement>;
  statusOf: (date: string) => StripStatus;
  onPick: (date: string) => void;
  labelOf?: (date: string) => string;
}
export const DateStrip = ({ shown, today, stripRef, statusOf, onPick, labelOf }: DateStripProps): React.JSX.Element => {
  const mon = new Date(D(shown).getTime() - ((D(shown).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) => new Date(D(mon).getTime() + i * 86_400_000).toISOString().slice(0, 10));
  return (
    <div className="nb-strip" ref={stripRef as React.Ref<HTMLDivElement>} role="group" aria-label="Week">
      {days.map((d) => (
        <button key={d} type="button" className={`nb-cell ${d === shown ? 'is-shown' : ''} ${d === today ? 'is-today' : ''}`} aria-label={labelOf?.(d) ?? fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} aria-current={d === shown ? 'date' : undefined} onClick={() => d !== shown && onPick(d)}>
          <span className="nb-letter">{fmt(d, { weekday: 'narrow' })}</span>
          <span className="nb-num tnum">{DAYN(d)}</span>
          <span className={`nb-dot is-${statusOf(d) ?? 'none'}`} />
        </button>
      ))}
    </div>
  );
};

/** 32 tall, --accent-tint, 'Today', 44 hit via ::after. No haptic. */
export const TodayPill = ({ onPress }: { onPress: () => void }): React.JSX.Element => {
  const press = usePress();
  return (
    <button type="button" className="today-pill pressable" data-press="scale" {...press.handlers} onClick={onPress}>
      Today
    </button>
  );
};

// ---------- pushed pages ----------
/** The parent's title for a pushed entry: the tab's name at depth 1, the depth-1 page's title at depth 2. */
const useParentTitle = () => {
  const entry = usePushedEntry();
  const st = useNavState();
  if (!entry) return null;
  for (const t of Object.keys(st.tabs) as Array<keyof typeof st.tabs>) {
    const stack = st.tabs[t].stack;
    const i = stack.findIndex((e) => e.key === entry.key);
    if (i < 0) continue;
    return i === 0 ? tabDef(t).label : stack[i - 1]!.title;
  }
  return null;
};

/** The 44 × 44 chevron of a pushed page: pops the layer it is in. Labelled with the parent's title. */
export const BackButton = ({ label }: { label?: string }): React.JSX.Element => {
  const pop = usePop();
  const parent = useParentTitle();
  const press = usePress();
  const name = label ?? (parent ? `Back to ${parent}` : 'Back');
  return (
    <button type="button" className="icon-btn back-btn pressable" data-press="scale" aria-label={name} title={name} {...press.handlers} onClick={pop}>
      <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
};

export interface PushedBarProps {
  title: string;
  eyebrow?: ReactNode;
  trailing?: ReactNode;
  /** Default 'Back to <the parent's title>'. */
  backLabel?: string;
}
/** 44 + --safe-t, sticky, --bg: the chevron, the title centred (an optional caps eyebrow under it), one trailing action. */
export const PushedBar = ({ title, eyebrow, trailing, backLabel }: PushedBarProps): React.JSX.Element => (
  <header className="pushed-bar">
    <BackButton label={backLabel} />
    <div className="pb-text">
      <span className="pb-title">{title}</span>
      {eyebrow ? <span className="pb-eyebrow caps">{eyebrow}</span> : null}
    </div>
    <div className="pb-trail">{trailing}</div>
  </header>
);
