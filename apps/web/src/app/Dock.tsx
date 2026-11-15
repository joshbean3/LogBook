import type { ISODate } from '@logbook/shared';
import { Orb } from '@/ui/Orb';
import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useOpenAssistant } from '@/features/assistant/openAssistant';
import { useScreenContext } from '@/features/assistant/screen';
import { useAssistantTurns } from '@/features/assistant/store';
import { useLiveToday } from '@/lib/useToday';
import { NAV_EVENT, type TabId } from '@/ui/nav';
import { useNowMark } from '@/ui/nowBudget';
import { Pressable } from '@/ui/Pressable';
import { AddMenu } from './AddMenu';

const DAY = /^\/today\/(\d{4}-\d{2}-\d{2})/;

/** Under this width the ask bar never folds: the round button beside the capsule would squeeze the tabs and hide their words (shell-20). */
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
 * The ask bar's words. The Add button shares the bar's row, so on a narrow phone or at a large text size a long line
 * may not fit: it then gives way to its short form, whole, instead of being cut with an ellipsis. The full line is always
 * in the DOM (hidden, and the measure of what fits); the button's accessible name is the full line either way.
 */
const AskWords = ({ words, short }: { words: string; short?: string }): React.JSX.Element => {
  const box = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const b = box.current;
    const f = full.current;
    if (!b || !f) return;
    const measure = () => setFits(f.offsetWidth <= b.clientWidth + 0.5);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(f);
    return () => ro.disconnect();
  }, [words]);
  return (
    <span ref={box} className="dock-ask-text">
      <span ref={full} className="dock-ask-full" aria-hidden="true">
        {words}
      </span>
      {fits || !short ? words : short}
    </span>
  );
};

/**
 * The dock (docs/inspiration.md §2, rules 1 and 2): the assistant's door on every tab, floating over the page above the tab
 * capsule. It asks about the day Today is showing (or today, from any other tab). While a conversation is going it says so,
 * with the badge dot (a Sunrise mark, under the budget in ui/nowBudget.ts). Scrolling down folds it into a round button so the page has the room; scrolling up brings it back.
 * At the trailing end of the ask bar's row stands the Add button (AddMenu.tsx), which never moves.
 */
export const Dock = ({ today: todayPath, plan: planPath, active, children }: { today: string; /** Fitness's root, for the week it shows. */ plan: string; active: TabId; children: ReactNode }): React.JSX.Element => {
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
  // the longer line in fewer words, for a bar too narrow for it (a 320 pt phone, very large text). The short line is the
  // start of the full one, so the button's name still holds the words on screen (WCAG 2.5.3). "Ask or change anything"
  // has no short form: the bar is laid out so it always fits (shell.css)
  const short = going ? 'Continue' : undefined;
  // the badge is one Sunrise element (two nodes, one shown at a time): it yields to Night Ink past the budget (guide 3.5)
  const now = useNowMark('badge', going);
  const dotNow = now === 'ink' ? 'ink' : undefined;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="dock" data-compact={compact ? '' : undefined}>
      {/* the ask bar's row: the bar, then the Add button at its trailing end. Folded, the bar sinks out and the button
          stays where it is, above the capsule's trailing end (guide 6.1) */}
      <div className="dock-top">
        <Pressable className="dock-ask" press="surface" onPress={() => open(date)} label={`${words}. Opens the assistant`} tabIndex={compact ? -1 : 0} aria-hidden={compact || undefined}>
          {/* the 28 px gloss Orb (guide 6.1): under 48 px the Orb holds still; one Orb shows, the folded one is at opacity 0 */}
          <Orb size={28} className="dock-ask-ic" state="still" />
          <AskWords words={words} short={short} />
          {going ? <span className="dock-dot" data-now={dotNow} aria-hidden="true" /> : null}
        </Pressable>
        <AddMenu active={active} todayPath={todayPath} planPath={planPath} />
      </div>
      <div className="dock-row">
        {children}
        <Pressable className="dock-ask-mini" press="scale" onPress={() => open(date)} label={`${words}. Opens the assistant`} tabIndex={compact ? 0 : -1} aria-hidden={!compact || undefined}>
          <Orb size={28} state="still" />
          {going ? <span className="dock-dot" data-now={dotNow} aria-hidden="true" /> : null}
        </Pressable>
      </div>
    </div>
  );
};
