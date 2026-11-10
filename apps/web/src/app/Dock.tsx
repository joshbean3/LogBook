import type { ISODate } from '@logbook/shared';
import { Orb } from '@/ui/Orb';
import type * as React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOpenAssistant } from '@/features/assistant/AskBar';
import { useScreenContext } from '@/features/assistant/screen';
import { useAssistantTurns } from '@/features/assistant/store';
import { useLiveToday } from '@/lib/useToday';
import { NAV_EVENT } from '@/ui/nav';
import { Pressable } from '@/ui/Pressable';

const DAY = /^\/today\/(\d{4}-\d{2}-\d{2})/;

/** Under this width the ask bar never folds: the round button would squeeze six tabs to 37 px and hide their words (shell-20). */
const FOLD_MIN_W = 375;

/**
 * Fold on the way down, open on the way up: a vertical scroll anywhere (every tab and pushed page is its own scroller) of
 * more than 6 px past the first 48 px folds the ask bar into a round button beside the tabs; any scroll back up, or reaching
 * the top, opens it again. Horizontal scrollers (the habit row, carousels) never move scrollTop, so they never count.
 * A tab change, a push or a pop (NAV_EVENT) decides afresh from the scroller now shown: folded only if it is past 48 px
 * and was last moving down; open when it is at the top or cannot scroll (shell-19).
 */
const useCompactOnScroll = () => {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const down = new WeakMap<Element, boolean>();
    const narrow = () => window.innerWidth < FOLD_MIN_W;
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.scrollingElement;
      if (!el) return;
      const y = el.scrollTop;
      const prev = last.get(el);
      last.set(el, y);
      if (prev === undefined || Math.abs(y - prev) < 6) return;
      down.set(el, y > prev);
      setCompact(!narrow() && y > 48 && y > prev);
    };
    const shown = (): Element | null => {
      const tab = document.querySelector('.tab[data-active]');
      if (!tab) return null;
      const layers = tab.querySelectorAll('.pushed');
      return layers.length ? layers[layers.length - 1]! : tab.querySelector('.tab-scroll');
    };
    const onNav = () =>
      // the new page is laid out after the controller's state lands: decide on the next frame
      requestAnimationFrame(() => {
        const el = shown();
        if (!el || narrow()) return setCompact(false);
        const canScroll = el.scrollHeight > el.clientHeight + 1;
        setCompact(canScroll && el.scrollTop > 48 && down.get(el) === true);
      });
    const onResize = () => {
      if (narrow()) setCompact(false);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener(NAV_EVENT, onNav);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener(NAV_EVENT, onNav);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return compact;
};

/**
 * The dock (docs/inspiration.md §2, rules 1 and 2): the assistant's door on every tab, floating over the page above the tab
 * capsule. It asks about the day Today is showing (or today, from any other tab). While a conversation is going it says so,
 * with the one orange dot. Scrolling down folds it into a round button so the page has the room; scrolling up brings it back.
 */
export const Dock = ({ today: todayPath, children }: { today: string; children: ReactNode }): React.JSX.Element => {
  const live = useLiveToday();
  const openAssistant = useOpenAssistant();
  const screenNow = useScreenContext();
  // the conversation carries the screen it was opened from (Today and its day, Plan and its week, a tab)
  const open = (d: ISODate) => openAssistant(d, undefined, screenNow(d, live));
  const turns = useAssistantTurns();
  const compact = useCompactOnScroll();
  const date = (DAY.exec(todayPath)?.[1] ?? live) as ISODate;
  const going = turns.length > 0;
  const words = going ? 'Continue with the assistant' : 'Ask or change anything';
  const ref = useRef<HTMLDivElement>(null);
  // the orb rests as one painted frame and comes alive only for a moment when the bar is pressed (perf-06)
  const [lively, setLively] = useState(false);
  const calm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = () => {
    setLively(true);
    clearTimeout(calm.current);
    calm.current = setTimeout(() => setLively(false), 1600);
  };
  useEffect(() => () => clearTimeout(calm.current), []);
  const orbState = lively ? 'idle' : 'still';
  return (
    <div ref={ref} className="dock" data-compact={compact ? '' : undefined}>
      <Pressable className="dock-ask" press="surface" onPointerDown={wake} onPress={() => open(date)} label={`${words}. Opens the assistant`} tabIndex={compact ? -1 : 0} aria-hidden={compact || undefined}>
        <Orb size={22} className="dock-ask-ic" state={orbState} />
        <span className="dock-ask-text">{words}</span>
        {going ? <span className="dock-dot" aria-hidden="true" /> : null}
      </Pressable>
      <div className="dock-row">
        {children}
        <Pressable className="dock-ask-mini" press="scale" onPointerDown={wake} onPress={() => open(date)} label={`${words}. Opens the assistant`} tabIndex={compact ? 0 : -1} aria-hidden={!compact || undefined}>
          <Orb size={26} state={orbState} />
          {going ? <span className="dock-dot" aria-hidden="true" /> : null}
        </Pressable>
      </div>
    </div>
  );
};
