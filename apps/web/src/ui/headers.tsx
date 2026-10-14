import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { haptics } from '@/lib/haptics';
import { Avatar } from './Avatar';
import { canPopHistory, PUSHED, tabDef, useRouteInfo } from './nav';
import { usePushedFrame } from './PushedPage';

/** "Wed, Oct 14": the date line's words (shown in caps). */
export const dateLine = (d: Date | string = new Date()) => {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : d;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** A serif page title that steps down from 44 to 28 when it would wrap (and always under 360px, in CSS). */
const useStepDown = (deps: unknown) => {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      el.classList.remove('wraps');
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 46;
      if (el.scrollHeight > lh * 1.5) el.classList.add('wraps');
    };
    check();
    const ro = new ResizeObserver(check);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [deps]);
  return ref;
};

/** A horizontal swipe on an element calls `onStep(+1)` for a swipe left (the next day) and `-1` for a swipe right. */
const useStepSwipe = (onStep?: (dir: -1 | 1) => void) => {
  const s = useRef<{ x: number; y: number; id: number; done: boolean } | null>(null);
  if (!onStep) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => {
      s.current = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const st = s.current;
      if (!st || st.done || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - st.y) * 1.5) {
        st.done = true;
        haptics.select();
        onStep(dx < 0 ? 1 : -1);
      }
    },
    onPointerUp: () => (s.current = null),
    onPointerCancel: () => (s.current = null),
  };
};

export interface TabHeaderProps {
  /** The serif word: "Plan", "Progress", or the day's word on Today ("Speed"). */
  title: ReactNode;
  /** The caps line above the title. Default: today ("Wed, Oct 14"); pass a node for another date, or `false` for none. */
  date?: ReactNode | false;
  /** Tap the date line (Today, Morning: opens the calendar sheet). The line becomes a button. */
  onDatePress?: () => void;
  /** Swipe the date line: +1 for the next day/week, -1 for the previous. `haptics.select()` fires on the step. */
  onDateStep?: (dir: -1 | 1) => void;
  /** Accessible name for the date button, e.g. "Wednesday, October 14. Pick a day". */
  dateLabel?: string;
  /** Sits before the avatar: a "Today" chip when off today, a "Month" button. Keep it to one small thing. */
  accessory?: ReactNode;
  /** Shared-element id for the title (rare: a title that travels into a sheet). */
  titleLayoutId?: string;
  /** Under the header: a week header, a segmented Journal · Library switch. */
  children?: ReactNode;
}

/**
 * The header of every tab page: a small caps date line on the left above the serif title (44, stepping to 28 when it would
 * wrap or under 360px), and on the right an optional accessory and the Avatar (the way to Settings). No gear and no
 * prev/next arrows: date navigation is a swipe on the date line (`onDateStep`) or the hero, or a tap on it (`onDatePress`).
 */
export const TabHeader = ({ title, date, onDatePress, onDateStep, dateLabel, accessory, titleLayoutId, children }: TabHeaderProps) => {
  const ref = useStepDown(title);
  const swipe = useStepSwipe(onDateStep);
  const line = date === false ? null : (date ?? dateLine());
  return (
    <header className="tabh">
      <div className="tabh-top">
        <div className="tabh-text">
          {line != null ? (
            onDatePress ? (
              <button type="button" className="tabh-date caps" onClick={onDatePress} aria-label={dateLabel} {...swipe}>
                {line}
              </button>
            ) : (
              <span className={`tabh-date caps ${onDateStep ? 'swipes' : ''}`} {...swipe}>
                {line}
              </span>
            )
          ) : null}
          <motion.h1 ref={ref} className="tabh-title" layoutId={titleLayoutId} layout={titleLayoutId ? 'position' : undefined}>
            {title}
          </motion.h1>
        </div>
        <div className="tabh-right">
          {accessory}
          <Avatar />
        </div>
      </div>
      {children ? <div className="tabh-tools">{children}</div> : null}
    </header>
  );
};

/** Back for a pushed page: the frame's (slide out, pop or go to the owning tab), else history, else Today. */
export const usePushedBack = (onBack?: () => void) => {
  const frame = usePushedFrame();
  const nav = useNavigate();
  const info = useRouteInfo();
  if (onBack) return onBack;
  if (frame) return frame.back;
  return () => (canPopHistory() ? nav(-1) : nav(info.backTo, { replace: true }));
};
/** "Back to Today" for VoiceOver: the owning tab's name, or just "Back". */
export const useBackLabel = () => {
  const info = useRouteInfo();
  const owner = PUSHED[info.section]?.owner;
  return owner ? `Back to ${tabDef(owner).label}` : 'Back';
};

/** The 44px back chevron of a pushed page. */
export const BackButton = ({ onBack, label }: { onBack?: () => void; label?: string }) => {
  const back = usePushedBack(onBack);
  const auto = useBackLabel();
  return (
    <button type="button" className="icon-btn back-btn" aria-label={label ?? auto} title={label ?? auto} onClick={back}>
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
  // Settings lights no tab; the avatar, ringed, says where you are
  const onSettings = useRouteInfo().section === 'settings';
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
