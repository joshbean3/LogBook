import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { today } from '@logbook/shared';
import type { ReactNode } from 'react';
import { usePushedEntry } from '@/app/NavController';
import { deprecated } from '@/lib/motion';
import { Avatar } from './Avatar';
import { BackButton as Chevron, dayCaption, NavBar, PushedBar } from './NavBar';
import { usePop } from './PushedLayer';

/*
 * @deprecated module (contracts rule 5): the old headers, kept working while a feature file imports them. `TabHeader` gives
 * way to `NavBar` and `PushedHeader` to `PushedBar` (ui/NavBar.tsx) as each package lands; WP1 deletes this file after WP6.
 * Back here is the pushed layer's own pop (usePop).
 */

/** @deprecated use `dayCaption`: the date line's words ('FRI, OCT 23'). */
export const dateLine = (d: Date | string = new Date()) => {
  deprecated('dateLine');
  const date = typeof d === 'string' ? d : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return dayCaption(date, today());
};

export interface TabHeaderProps {
  /** The title: "Plan", "Progress", or the day's word on Today ("Speed"). */
  title: ReactNode;
  /** The caps line above the title. Default: today ("FRI, OCT 23"); pass a node for another date, or `false` for none. */
  date?: ReactNode | false;
  /** Tap the title block (the date line and the titles): the old pages open their calendar here. */
  onDatePress?: () => void;
  /** @deprecated ignored: the pager under the bar pages (the date line no longer swipes). */
  onDateStep?: (dir: -1 | 1) => void;
  /** Accessible name for the title block, e.g. "Wednesday, October 14. Pick a day". */
  dateLabel?: string;
  /** Sits before the avatar in the trailing slot: one small thing (a "Month" button, the library search). */
  accessory?: ReactNode;
  /** @deprecated ignored (layoutId is gone). */
  titleLayoutId?: string;
  /** Under the bar and title: a segmented Journal · Library switch. */
  children?: ReactNode;
}

/**
 * @deprecated use `NavBar` (ui/NavBar.tsx). The old tab header's API rendered on the new bar: on a tab root it is `NavBar`
 * (a fragment: the sticky bar, the large title, `children` in the strip slot, the gap) with the accessory and the avatar in
 * the trailing slot and `onDatePress` as the title block's tap; inside a pushed layer (the old Morning page) it is
 * `PushedBar` with the date as its eyebrow. Each package replaces it with `NavBar` / `PushedBar` when it lands.
 */
export const TabHeader = ({ title, date, onDatePress, dateLabel, accessory, children }: TabHeaderProps) => {
  deprecated('TabHeader');
  const pushed = !!usePushedEntry();
  const line = date === false ? null : (date ?? dayCaption(today()));
  const tools = children ? <div className="tabh-tools">{children}</div> : null;
  if (pushed)
    return (
      <>
        <PushedBar title={typeof title === 'string' ? title : ''} eyebrow={line} trailing={accessory} />
        {tools}
      </>
    );
  return (
    <NavBar
      caps={{ cur: (line ?? '') as string }}
      title={{ cur: title as string }}
      trailing={
        <span key="acc" className="nb-acc">
          {accessory}
          <Avatar />
        </span>
      }
      onTitlePress={onDatePress}
      titleLabel={dateLabel}
      gap={24}
    >
      {tools}
    </NavBar>
  );
};

/** @deprecated use `usePop()`. Back for a pushed page: the layer's own pop, unless the page overrides it. */
export const usePushedBack = (onBack?: () => void) => {
  const pop = usePop();
  return onBack ?? pop;
};

/** @deprecated use `BackButton` from ui/NavBar. The 44px back chevron of a pushed page. */
export const BackButton = ({ onBack, label }: { onBack?: () => void; label?: string }) => {
  if (!onBack) return <Chevron label={label} />;
  return (
    <button type="button" className="icon-btn back-btn" aria-label={label ?? 'Back'} title={label ?? 'Back'} onClick={onBack}>
      <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
};

export interface PushedHeaderProps {
  /** The serif title (28): "Morning", "Reads", "Settings". */
  title: ReactNode;
  /** A caps line above the title: Morning's date. */
  eyebrow?: ReactNode;
  /** One action on the right (an icon button, a verb). */
  right?: ReactNode;
  /** Override Back (rare: a page with unsaved edits that wants to confirm). */
  onBack?: () => void;
  /** VoiceOver name for the chevron. Default "Back to <owning tab>". */
  backLabel?: string;
  titleLayoutId?: string;
  /** Under the header: a segmented control, a date pager. */
  children?: ReactNode;
}

/**
 * The header of a pushed page (Morning, Reads, Settings): a 44px back chevron, the serif title at 28 with an optional caps
 * eyebrow, and one optional right action. It pins to the top while the page scrolls. The edge swipe back comes with the
 * route (App.tsx wraps every pushed route in `PushedPage`), and this chevron calls the same back(): slide out, then pop.
 */
export const PushedHeader = ({ title, eyebrow, right, onBack, backLabel, titleLayoutId, children }: PushedHeaderProps) => {
  deprecated('PushedHeader');
  // Settings: the avatar, ringed, says where you are
  const onSettings = !!usePushedEntry()?.path.startsWith('/settings');
  if (onSettings && right === undefined) right = <Avatar />;
  return (
    <header className="pushed-head">
      <div className="pushed-top">
        <BackButton onBack={onBack} label={backLabel} />
        <div className="pushed-text">
          {eyebrow ? <span className="caps pushed-eyebrow">{eyebrow}</span> : null}
          <motion.h1 className="pushed-title" layoutId={titleLayoutId} layout={titleLayoutId ? 'position' : undefined}>
            {title}
          </motion.h1>
        </div>
        {right ? <div className="pushed-right">{right}</div> : null}
      </div>
      {children ? <div className="pushed-tools">{children}</div> : null}
    </header>
  );
};
