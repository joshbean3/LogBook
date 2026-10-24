import { addMonths, mondayOf, monthOf, monthStart, shiftDays } from '@logbook/shared';
import { useMotionValueEvent } from 'motion/react';
import type * as React from 'react';
import { Activity, startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHomeControl, useNav, useRootRequest, useRouteParams, useTabScroller } from '@/app/NavController';
import { crossfadeSlow, ease } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { DayPager, useDayPagerHandle } from '@/ui/DayPager';
import { monthCaption, NavBar, weekCaption } from '@/ui/NavBar';
import { Note, Segmented } from '@/ui/primitives';
import { Skeleton } from '@/ui/Skeleton';
import { useOpenCalendar } from '../day/Calendar';
import { useLog } from '../log/useLog';
import { usePlanBlock } from './Blocks';
import { MonthPage } from './Month';
import { WeekPage } from './Week';
import './plan.css';

/**
 * Plan (docs/feel.md §7, contracts §A.3 page-root): the NavBar (caps `THIS WEEK · OCT 19–25` / `OCTOBER 2026` as stacked
 * labels bound to the shown pager's progress; title `Plan`, tap → this week / this month, hold → `Go to a week…`; the
 * `Week | Month` segmented in the 96 px slot), then two mounted panes: the week pager (`DayPager step='week'`, full-bleed,
 * each page the week line, seven rows and the block card) and the month pager (`step='month'`). Switching is a 200 ms
 * crossfade of the two panes (both in the DOM during it); the segmented's thumb rides `settle`. No haptic on any of it.
 *
 * `view` and the anchor (the Monday, the first of the month) are page state: read once from the route, mirrored into the
 * URL with `nav.replace` on every commit, changed from outside only through `useRootRequest` (a cut sets them before the
 * first frame; on an active Plan the pager slides, or the panes crossfade when the view changes). The lit tab re-tapped off
 * this week (month) slides home (`useHomeControl`).
 */
type View = 'week' | 'month';
interface St {
  view: View;
  mon: string;
  first: string;
  /** The pane fading out (both are in the DOM; this one is absolute over the top of the incoming one). */
  leaving: View | null;
}

/** The month a week belongs to: its Thursday's (ISO weeks). */
const monthOfWeek = (mon: string) => monthStart(shiftDays(mon, 3));
/** The first week that belongs to a month: the one whose Thursday falls in it. */
const firstWeekOf = (first: string) => (shiftDays(mondayOf(first), 3) >= first ? mondayOf(first) : shiftDays(mondayOf(first), 7));

const fromParams = (p: Readonly<Record<string, string>>, today: string): Omit<St, 'leaving'> => {
  if (p.month) return { view: 'month', first: p.month, mon: monthOf(p.month) === monthOf(today) ? mondayOf(today) : firstWeekOf(p.month) };
  const mon = p.mon ?? mondayOf(today);
  return { view: 'week', mon, first: monthOfWeek(mon) };
};

/** A neighbour page before it mounts (one transition after a commit): the week's skeleton, nothing that can be tapped. */
const SKEL = Array.from({ length: 7 }, (_, i) => i);
const ColdWeek = () => (
  <div className="pl-wpage" aria-hidden="true">
    <div className="pl-wl" />
    <div className="pl-group pl-skel">
      {SKEL.map((i) => (
        <div key={i} className="pl-skel-row">
          <Skeleton w={28} h={32} r={8} />
          <Skeleton w="55%" h={18} r="line" />
        </div>
      ))}
    </div>
  </div>
);
const ColdMonth = () => <div className="pl-mpage" aria-hidden="true" />;

export default function PlanView(): React.JSX.Element {
  const params = useRouteParams();
  const nav = useNav();
  const today = useToday();
  const thisMon = mondayOf(today);
  const thisFirst = monthStart(today);
  const [st, setSt] = useState<St>(() => ({ ...fromParams(params, today), leaving: null }));
  const { view, mon, first } = st;
  const live = useRef({ st, thisMon, thisFirst });
  live.current = { st, thisMon, thisFirst };
  const weekH = useDayPagerHandle();
  const monthH = useDayPagerHandle();
  const handle = view === 'week' ? weekH : monthH;

  // the month pane mounts with the first switch, or in idle after the first paint; then it stays
  const [monthOn, setMonthOn] = useState(view === 'month');
  useEffect(() => {
    if (monthOn) return;
    const ric = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1200));
    const cic = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ric(() => setMonthOn(true), { timeout: 3000 });
    return () => cic(id);
  }, [monthOn]);

  const weekPath = (m: string) => (m === live.current.thisMon ? '/plan' : `/plan/week/${m}`);
  const monthPath = (f: string) => `/plan/month/${f}`;

  // ---------- commits (inside the pager's flushSync) ----------
  // A pager still sliding while its pane fades out commits under the other view (code review 1 #4): it moves only its own
  // anchor, never the shown view's, and the URL stays the shown view's.
  const commitWeek = useCallback(
    (m: string) => {
      const shown = live.current.st.view === 'week';
      setSt((s) => (s.view === 'week' ? { ...s, mon: m, first: monthOfWeek(m) } : { ...s, mon: m }));
      if (shown) nav.replace(m === live.current.thisMon ? '/plan' : `/plan/week/${m}`);
      refocus();
    },
    [nav], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const commitMonth = useCallback(
    (f: string) => {
      const shown = live.current.st.view === 'month';
      setSt((s) => (s.view === 'month' ? { ...s, first: f } : s));
      if (shown) nav.replace(`/plan/month/${f}`);
      refocus();
    },
    [nav], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---------- Week ⇄ Month: a 200 ms crossfade of the two mounted panes ----------
  const noFade = useRef(false);
  const scroller = useTabScroller();
  /** The tab's scrollTop when a switch was asked for: the leaving pane is held where it was on screen (review-feel-1 #1). */
  const preScroll = useRef<number | null>(null);
  /** Focus was in the page when a switch or a page change was asked for: it follows to the shown pager (code review 1 #8). */
  const hadFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const noteFocus = () => {
    const a = document.activeElement;
    hadFocus.current = !!a && a !== document.body && !!rootRef.current?.contains(a);
  };
  const refocus = () => {
    if (!hadFocus.current) return;
    // after the commit's DOM is in: a focus left inside an inert page or pane (or dropped to body) moves to the shown pager
    queueMicrotask(() => {
      const a = document.activeElement;
      const pane = (live.current.st.view === 'week' ? weekPane : monthPane).current;
      if (a && a !== document.body && !a.closest('[inert]') && pane?.contains(a)) return void (hadFocus.current = false);
      const dp = pane?.querySelector<HTMLElement>('.dp');
      if (dp) {
        dp.focus({ preventScroll: true });
        hadFocus.current = false;
      }
    });
  };
  const show = (v: View, anchor?: { mon?: string; first?: string }) => {
    const s = live.current.st;
    // a week goTo still running is going to its target: the month is the target's (code review 1 #1)
    const wk = weekH.target.get() ?? s.mon;
    const m = anchor?.mon ?? (v === 'week' ? (monthOf(s.first) === monthOf(today) ? live.current.thisMon : firstWeekOf(s.first)) : wk);
    const f = anchor?.first ?? (v === 'month' ? monthOfWeek(wk) : s.first);
    if (v === 'month') setMonthOn(true);
    if (v !== s.view) preScroll.current = scroller.current?.scrollTop ?? null;
    noteFocus();
    setSt({ view: v, mon: m, first: v === 'week' ? monthOfWeek(m) : f, leaving: v === s.view ? s.leaving : s.view });
    nav.replace(v === 'week' ? weekPath(m) : monthPath(f));
  };
  const weekPane = useRef<HTMLElement>(null);
  const monthPane = useRef<HTMLElement>(null);
  const fades = useRef<Animation[]>([]);
  const fadeGen = useRef(0);
  const shownView = useRef(view);
  const releasePane = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.transform = '';
    el.style.height = '';
    el.style.overflow = '';
  };
  const opacityOf = (el: HTMLElement | null) => (el && getComputedStyle(el).visibility !== 'hidden' ? +getComputedStyle(el).opacity : 0);
  // every render: a cut's no-fade belongs to the render it was asked for, whether or not that render switched the view
  useLayoutEffect(() => {
    if (shownView.current === view) {
      noFade.current = false;
      return;
    }
    shownView.current = view;
    const gen = ++fadeGen.current;
    const inc = (view === 'week' ? weekPane : monthPane).current;
    const out = (view === 'week' ? monthPane : weekPane).current;
    // a switch inside a running crossfade starts from where the panes are now (code review 1 #6)
    const running = fades.current.some((a) => a.playState === 'running');
    const from = running ? { inc: opacityOf(inc), out: opacityOf(out) } : { inc: 0, out: 1 };
    for (const a of fades.current) a.cancel();
    fades.current = [];
    // the shown pane alone sets the height now (the leaving one is absolute): hold the leaving one where it was on screen
    const pre = preScroll.current;
    preScroll.current = null;
    const sc = scroller.current;
    // a pane shown again inside its own fade-out was held by a translate: give that offset back to the scroll, so it stays put
    const held = inc ? parseFloat(/translateY\((-?[\d.]+)px\)/.exec(inc.style.transform)?.[1] ?? '0') : 0;
    releasePane(inc);
    if (out && sc) {
      // out of flow and 0 tall for one read: the scroll range is now the shown pane's alone (the browser clamps it here,
      // before the first frame, instead of when the fade ends)
      out.style.height = '0px';
      out.style.overflow = 'hidden';
      out.style.transform = '';
      if (held) sc.scrollTop -= held;
      const dy = pre != null ? sc.scrollTop - pre : 0;
      // then as tall as the screen below its (held) top, so it neither adds scroll range nor shows a cut edge
      const top = out.getBoundingClientRect().top + dy;
      out.style.height = `${Math.max(0, Math.floor(sc.getBoundingClientRect().bottom - top))}px`;
      out.style.transform = dy ? `translateY(${dy}px)` : '';
    }
    refocus();
    if (noFade.current || !st.leaving) {
      noFade.current = false;
      releasePane(out);
      if (st.leaving) setSt((s) => ({ ...s, leaving: null }));
      return;
    }
    const ms = ((crossfadeSlow as { duration?: number }).duration ?? 0.2) * 1000;
    const easing = `cubic-bezier(${ease.join(', ')})`;
    const aIn = inc?.animate([{ opacity: from.inc }, { opacity: 1 }], { duration: Math.max(1, ms * (1 - from.inc)), easing });
    const aOut = out?.animate([{ opacity: from.out }, { opacity: 0 }], { duration: Math.max(1, ms * from.out), easing, fill: 'forwards' });
    fades.current = [aIn, aOut].filter((a): a is Animation => !!a);
    const leavingH = view === 'week' ? monthH : weekH;
    const done = () => {
      if (fadeGen.current !== gen) return;
      // a slide still running in the leaving pane finishes (and commits) first: hiding it now would freeze it mid-slide
      // (code review 1 #1); it is invisible and inert meanwhile
      if (leavingH.moving.get()) {
        const off = leavingH.moving.on('change', (m) => {
          if (m) return;
          off();
          queueMicrotask(done);
        });
        return;
      }
      // the leaving pane goes off (hidden) on the same frame its fill is dropped
      flushSync(() => setSt((s) => (s.view === view ? { ...s, leaving: null } : s)));
      releasePane(out);
      aOut?.cancel();
    };
    if (aOut) aOut.onfinish = done;
    else done();
  });

  // ---------- home, requests, the title ----------
  const goHome = useCallback(() => {
    const s = live.current.st;
    noteFocus();
    if (s.view === 'week') weekH.goTo(live.current.thisMon);
    else monthH.goTo(live.current.thisFirst);
  }, [weekH, monthH]);
  const atHome = view === 'week' ? mon === thisMon : first === thisFirst;
  useHomeControl({ atHome, goHome });
  useRootRequest((p, how) => {
    const want = fromParams(p, today);
    const s = live.current.st;
    if (how.cut) {
      // the first frame that shows Plan is already at the request: no pager motion, no crossfade
      noFade.current = true;
      if (want.view === 'month') setMonthOn(true);
      setSt({ ...want, leaving: null });
      return;
    }
    if (want.view !== s.view) return show(want.view, want);
    if (want.view === 'week') weekH.goTo(want.mon);
    else monthH.goTo(want.first);
  });
  const pickWeek = (d: string) => {
    const m = mondayOf(d);
    if (live.current.st.view === 'month') show('week', { mon: m });
    else weekH.goTo(m);
  };
  const openCalendar = useOpenCalendar({ mode: 'week', value: view === 'week' ? mon : first, onPick: pickWeek });
  const titleMenu = (): ContextMenuItem[] => [{ label: 'Go to a week…', onSelect: openCalendar }];

  // the large title row pages the shown view too (no dead band between the bar and the page)
  const titleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    handle.attach([titleRef.current]);
    (handle === weekH ? monthH : weekH).attach([]);
  }, [handle, weekH, monthH]);

  // the destination of a 2–7 page goTo shows in the label in its direction (one render at its start, one at its end)
  const [tgt, setTgt] = useState<string | null>(null);
  useMotionValueEvent(weekH.target, 'change', (v) => live.current.st.view === 'week' && setTgt(v));
  useMotionValueEvent(monthH.target, 'change', (v) => live.current.st.view === 'month' && setTgt(v));
  const caps =
    view === 'week'
      ? (() => {
          const prev = tgt && tgt < mon ? tgt : shiftDays(mon, -7);
          const next = tgt && tgt > mon ? tgt : shiftDays(mon, 7);
          return { prev: weekCaption(prev, today), cur: weekCaption(mon, today), next: weekCaption(next, today) };
        })()
      : (() => {
          const prev = tgt && tgt < first ? tgt : addMonths(first, -1);
          const next = tgt && tgt > first ? tgt : addMonths(first, 1);
          return { prev: monthCaption(prev), cur: monthCaption(first), next: monthCaption(next) };
        })();

  const onThisWeek = useCallback(() => {
    noteFocus();
    weekH.goTo(live.current.thisMon);
  }, [weekH]); // eslint-disable-line react-hooks/exhaustive-deps
  const onWeek = useCallback((m: string) => show('week', { mon: m }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const block = usePlanBlock();
  /**
   * A page that has just come into a pager's neighbour slot mounts after the commit, in a transition (React yields every
   * few ms), not inside the commit's flushSync: the commit frame re-renders the three pages it already has instead of
   * building a fourth (review-feel-1 #6; spec §15 risk 1's fallback). Until then the slot holds the page's skeleton; the
   * shown page and a goTo's destination are always whole.
   */
  const [warm, setWarm] = useState<ReadonlySet<string>>(() => new Set([mon, first]));
  const warmNow = useRef(warm);
  warmNow.current = warm;
  useEffect(() => {
    const want = new Set([mon, shiftDays(mon, -7), shiftDays(mon, 7), first, addMonths(first, -1), addMonths(first, 1)]);
    const have = warmNow.current;
    if ([...want].every((d) => have.has(d)) && have.size === want.size) return;
    // the shown pages are whole already (they were live); the newcomers mount in a transition
    startTransition(() => setWarm(want));
  }, [mon, first]);
  const isWarm = (d: string, live: boolean, h: typeof weekH) => live || warmNow.current.has(d) || h.target.get() === d;
  const renderWeek = useCallback((m: string, live: boolean) => (isWarm(m, live, weekH) ? <WeekPage mon={m} onThisWeek={onThisWeek} block={block} /> : <ColdWeek />), [onThisWeek, block, warm]); // eslint-disable-line react-hooks/exhaustive-deps
  const renderMonth = useCallback((f: string, live: boolean) => (isWarm(f, live, monthH) ? <MonthPage first={f} onWeek={onWeek} block={block} /> : <ColdMonth />), [onWeek, block, warm]); // eslint-disable-line react-hooks/exhaustive-deps

  const strava = useLog([]).strava;
  const paneCls = (v: View) => (view === v ? 'is-on' : st.leaving === v ? 'is-leaving' : 'is-off');
  const hidden = (v: View) => view !== v || undefined;
  // the pane that is neither shown nor fading out defers its updates (a drop re-renders the shown pages only)
  const mode = (v: View) => (view === v || st.leaving === v ? 'visible' : 'hidden');
  return (
    <div ref={rootRef} className={`page-root plan-root plan-${view}`}>
      <NavBar
        caps={caps}
        title={{ cur: 'Plan' }}
        progress={handle.progress}
        wideTrailing
        trailing={<Segmented key="seg" className="in-bar" label="Week or month" value={view} onChange={(v: View) => v !== live.current.st.view && show(v)} options={[['week', 'Week'], ['month', 'Month']]} />}
        onTitlePress={() => {
          const s = live.current.st;
          if (s.view === 'week' ? s.mon !== live.current.thisMon : s.first !== live.current.thisFirst) goHome();
        }}
        titleMenu={titleMenu}
        titleLabel={atHome ? 'Plan' : view === 'week' ? 'Plan. Go to this week' : 'Plan. Go to this month'}
        titleRef={titleRef}
        gap={24}
      />
      <div className="pl-panes">
        <section ref={weekPane} className={`pl-pane pl-week-pane ${paneCls('week')}`} inert={hidden('week')} aria-hidden={hidden('week')} aria-label="Week">
          <Activity mode={mode('week')}>
            <DayPager className="pl-wpager" date={mon} step="week" handle={weekH} onCommit={commitWeek} render={renderWeek} label="Week" prevLabel="Previous week" nextLabel="Next week" />
          </Activity>
        </section>
        {monthOn ? (
          <section ref={monthPane} className={`pl-pane pl-month-pane ${paneCls('month')}`} inert={hidden('month')} aria-hidden={hidden('month')} aria-label="Month">
            <Activity mode={mode('month')}>
              <DayPager className="pl-mpager" date={first} step="month" handle={monthH} onCommit={commitMonth} render={renderMonth} label="Month" prevLabel="Previous month" nextLabel="Next month" />
            </Activity>
          </section>
        ) : null}
      </div>
      {strava?.error ? (
        <div className="pl-note">
          <Note kind="warn">{strava.error}</Note>
        </div>
      ) : null}
    </div>
  );
}
