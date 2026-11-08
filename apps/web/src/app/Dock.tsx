import type { ISODate } from '@logbook/shared';
import { Sparkles } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOpenAssistant } from '@/features/assistant/AskBar';
import { useAssistantTurns } from '@/features/assistant/store';
import { useLiveToday } from '@/lib/useToday';
import { Pressable } from '@/ui/Pressable';

const DAY = /^\/today\/(\d{4}-\d{2}-\d{2})/;

/**
 * Fold on the way down, open on the way up: a vertical scroll anywhere (every tab and pushed page is its own scroller) of
 * more than 6 px past the first 48 px folds the ask bar into a round button beside the tabs; any scroll back up, or reaching
 * the top, opens it again. Horizontal scrollers (the habit row, carousels) never move scrollTop, so they never count.
 */
const useCompactOnScroll = () => {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.scrollingElement;
      if (!el) return;
      const y = el.scrollTop;
      const prev = last.get(el);
      last.set(el, y);
      if (prev === undefined || Math.abs(y - prev) < 6) return;
      setCompact(y > 48 && y > prev);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
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
  const open = useOpenAssistant();
  const turns = useAssistantTurns();
  const compact = useCompactOnScroll();
  const date = (DAY.exec(todayPath)?.[1] ?? live) as ISODate;
  const going = turns.length > 0;
  const words = going ? 'Continue with the assistant' : 'Ask or change anything';
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="dock" data-compact={compact ? '' : undefined}>
      <Pressable className="dock-ask" press="surface" onPress={() => open(date)} label={`${words}. Ask Logbook`} tabIndex={compact ? -1 : 0} aria-hidden={compact || undefined}>
        <Sparkles size={17} className="dock-ask-ic" aria-hidden="true" />
        <span className="dock-ask-text">{words}</span>
        {going ? <span className="dock-dot" aria-hidden="true" /> : null}
      </Pressable>
      <div className="dock-row">
        {children}
        <Pressable className="dock-ask-mini" press="scale" onPress={() => open(date)} label={`${words}. Ask Logbook`} tabIndex={compact ? 0 : -1} aria-hidden={!compact || undefined}>
          <Sparkles size={20} aria-hidden="true" />
          {going ? <span className="dock-dot" aria-hidden="true" /> : null}
        </Pressable>
      </div>
    </div>
  );
};
