import { dayKey, mondayOf, monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { useMotionValueEvent } from 'motion/react';
import type * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHomeControl, useIsActiveTab, useNav, useRootRequest, useRouteParams } from '@/app/NavController';
import { useToday, TodayHold } from '@/lib/useToday';
import { hasDraft, subscribeDrafts } from '../journal/drafts';
import { Avatar } from '@/ui/Avatar';
import { DayPager, useDayPagerHandle } from '@/ui/DayPager';
import { DateStrip, dayCaption, dayTitle, NavBar, TodayPill, type StripStatus } from '@/ui/NavBar';
import { REFRESH } from '@/ui/nav';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { useLog } from '../log/useLog';
import { useOpenCalendar } from './Calendar';
import { DayPage } from './DayPage';
import { setLiveDate, setPagerMoving } from './live';
import { deferChange, recheckDeferred, setTodayActive } from './useDeferred';
import { useStravaPull } from './useStravaPull';
import './day.css';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Test builds expose the pager and the page's date to the acceptance scripts (`window.__pager`, `window.__today`). */
const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);
type TodayHooks = { date: () => string; today: () => string; setDate: (d: string) => void; renders: number; pageRenders: number };
const hooks = (TEST_HOOKS ? ((window as unknown as { __today?: TodayHooks }).__today ??= { date: () => '', today: () => '', setDate: () => {}, renders: 0, pageRenders: 0 }) : null) as TodayHooks | null;
const STRIP: Partial<Record<ReturnType<typeof dayKey>, StripStatus>> = { done: 'done', bonus: 'bonus', floor: 'floor', planned: 'planned', today: 'planned', missed: 'missed', skipped: 'skipped' };

/**
 * Today (docs/system.md §2): the tab root. One page element whose first content is the bar (`NavBar`, a fragment: the
 * sticky bar with the date as its caps line, the large title, the sticky `DateStrip`, the gap), then the `DayPager`
 * rendering a `DayPage` for prev, cur and next.
 *
 * - The date is page state: read once from the route, mirrored into the URL with `nav.replace` on every commit (no history
 *   entry), and changed from outside only through `useRootRequest` (a jump cuts to the date; on an active Today the pager
 *   slides). The lit tab re-tapped off today slides home (`useHomeControl`).
 * - Three ways to change the day (§0.1): swipe anywhere under the bar (the strip and the large title row are attached to the
 *   pager), tap a strip cell, come home (the title block, the Today pill, today's cell, the lit tab). The calendar is a jump
 *   behind the title's hold menu (`Go to a day…`).
 * - The bar's stacked labels follow the pager's `progress` with no render; during a 2–7 day `goTo` the label in the direction
 *   of travel shows the destination (`handle.target`: one render at the start of the slide).
 */
/**
 * The trailing slot's two occupants (§2.4): the avatar on today, the Today pill off it, both mounted, crossfading 120 ms by a
 * CSS transition that starts on the commit's own frame. Through NavBar's keyed swap the fade started a frame after the
 * commit's render (motion schedules it on the next frame), which at 4× put the avatar back 165–300 ms after the slide's rest
 * (§14 20: 150). The hidden one is `inert` and leaves the accessibility tree.
 */
function TrailSwap({ home, onHome }: { home: boolean; onHome: () => void }): React.JSX.Element {
  return (
    <span className="trail-swap">
      <span className="trail-swap-item" data-on={home || undefined} inert={!home || undefined} aria-hidden={!home || undefined}>
        <Avatar />
      </span>
      <span className="trail-swap-item" data-on={!home || undefined} inert={home || undefined} aria-hidden={home || undefined}>
        <TodayPill onPress={onHome} />
      </span>
    </span>
  );
}

export default function DayView(): React.JSX.Element {
  // the day the tab treats as today: held past midnight until the rollover may apply (§5.4, useDeferred)
  const live = useToday();
  const [held, setHeld] = useState(live);
  const roll = useRef<(to: ISODate) => void>(setHeld);
  useEffect(() => {
    if (held === live) return;
    return deferChange({ ready: () => !hasDraft(held), apply: () => roll.current(live) });
  }, [held, live]);
  // the rule is re-asked when a draft is written or cleared (it still needs its idle minute, a tab change or a return)
  useEffect(() => subscribeDrafts(recheckDeferred), []);
  return (
    <TodayHold value={held}>
      <TodayRoot roll={roll} setHeld={setHeld} />
    </TodayHold>
  );
}

function TodayRoot({ roll, setHeld }: { roll: React.RefObject<(to: ISODate) => void>; setHeld: (d: ISODate) => void }): React.JSX.Element {
  const params = useRouteParams();
  const nav = useNav();
  const handle = useDayPagerHandle();
  const base = useLog([]);
  const today = base.today;
  const [date, setDate] = useState<ISODate>(() => (params.date && ISO.test(params.date) ? params.date : today));
  const dateRef = useRef(date);
  dateRef.current = date;
  const todayRef = useRef(today);
  todayRef.current = today;

  // the strip's week: its own memoised log (the pages keep theirs)
  const stripMonths = useMemo(() => [...new Set([monthOf(mondayOf(date)), monthOf(shiftDays(mondayOf(date), 6))])], [date]);
  const log = useLog(stripMonths);
  useStravaPull(!!log.strava?.connected);

  // a cold open's Strava check is main.tsx's (from the persisted bootstrap) or App's (after the first bootstrap): one each
  if (hooks) {
    hooks.renders++;
    hooks.date = () => dateRef.current;
    hooks.today = () => todayRef.current;
    hooks.setDate = (d: string) => {
      setDate(d);
      nav.replace(d === todayRef.current ? '/today' : `/today/${d}`);
    };
    (window as unknown as { __pager?: unknown }).__pager = handle;
  }

  const commit = useCallback(
    (d: ISODate) => {
      setDate(d);
      nav.replace(d === todayRef.current ? '/today' : `/today/${d}`);
    },
    [nav],
  );
  const goHome = useCallback(() => handle.goTo(todayRef.current), [handle]);
  // the live page (its once-a-day moments, the nudge, the splash) follows the date in the commit's own layout phase
  useLayoutEffect(() => setLiveDate(date), [date]);
  useEffect(() => setPagerMoving(() => handle.moving.get()), [handle]);
  useRootRequest((p, how) => {
    const d = p.date && ISO.test(p.date) ? p.date : todayRef.current;
    if (how.cut) setDate(d);
    else handle.goTo(d);
  });
  useHomeControl({ atHome: date === today, goHome });
  // the rollover (§5.4): the held day becomes the new today; a page that showed the held today crossfades to the new one
  roll.current = (to: ISODate) => {
    const wasToday = dateRef.current === todayRef.current;
    flushSync(() => setHeld(to));
    if (wasToday) {
      handle.goTo(to, { mode: 'crossfade' });
      nav.replace('/today');
    }
  };
  const active = useIsActiveTab();
  useEffect(() => setTodayActive(active), [active]);

  const openCalendar = useOpenCalendar({ mode: 'day', value: date, onPick: (d) => handle.goTo(d) });
  const titleMenu = (): ContextMenuItem[] => [{ label: 'Go to a day…', onSelect: openCalendar }];

  // the destination of a 2–7 day goTo shows in the label in its direction (one render at its start, one at its end)
  const [tgt, setTgt] = useState<string | null>(null);
  useMotionValueEvent(handle.target, 'change', setTgt);
  const prev = tgt && tgt < date ? tgt : shiftDays(date, -1);
  const next = tgt && tgt > date ? tgt : shiftDays(date, 1);

  const stripRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  useEffect(() => handle.attach([stripRef.current, titleRef.current]), [handle]);

  const statusOf = (d: string): StripStatus => (log.loaded(d) ? (STRIP[dayKey(log.snap, d)] ?? null) : null);
  const render = useCallback((d: string, live: boolean) => <DayPage date={d} live={live} />, []);

  return (
    <div className="page-root today-root">
      <NavBar
        caps={{ prev: dayCaption(prev, today), cur: dayCaption(date, today), next: dayCaption(next, today) }}
        title={{ prev: dayTitle(prev, today), cur: dayTitle(date, today), next: dayTitle(next, today) }}
        progress={handle.progress}
        trailing={<TrailSwap key="trail" home={date === today} onHome={goHome} />}
        onTitlePress={() => {
          if (dateRef.current !== todayRef.current) goHome();
        }}
        titleMenu={titleMenu}
        titleLabel={date === today ? 'Today' : `${dayTitle(date, today)}. Go to today`}
        titleRef={titleRef}
        gap={16}
      >
        <DateStrip shown={date} today={today} handle={handle} stripRef={stripRef} statusOf={statusOf} onPick={(d) => handle.goTo(d)} />
      </NavBar>
      <DayPager date={date} step="day" handle={handle} onCommit={commit} render={render} label="Day" prevLabel="Previous day" nextLabel="Next day" />
      {/* pull to refresh's keyboard and VoiceOver path (WP1's request): the same REFRESH a committed pull fires */}
      <button type="button" className="dpager-sr" onClick={() => window.dispatchEvent(new CustomEvent(REFRESH))}>
        Check for new runs
      </button>
    </div>
  );
}
