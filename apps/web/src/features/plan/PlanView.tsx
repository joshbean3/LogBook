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
  // A commit moves only its own pager's anchor (a pager still sliding while its pane fades out commits under the other
  // view: code review 1 #4, code review 2 #1); the URL is the shown view's. The other view's anchor is picked when it is
  // shown (`show`), never written into a pane that is on screen.
  const commitWeek = useCallback(
    (m: string) => {
      const shown = live.current.st.view === 'week';
      setSt((s) => ({ ...s, mon: m }));
      if (shown) nav.replace(m === live.current.thisMon ? '/plan' : `/plan/week/${m}`);
      refocus();
    },
    [nav], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const commitMonth = useCallback(
    (f: string) => {
      const shown = live.current.st.view === 'month';
      setSt((s) => ({ ...s, first: f }));
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
    // (only then: a focus on the segmented or the title stays where it is, as a segmented control's does: code review 2 #7)
    queueMicrotask(() => {
      const a = document.activeElement;
      const pane = (live.current.st.view === 'week' ? weekPane : monthPane).current;
      if (a && a !== document.body && !a.closest('[inert]')) return void (hadFocus.current = false);
      const dp = pane?.querySelector<HTMLElement>('.dp');
      if (dp) {
        dp.focus({ preventScroll: true });
        hadFocus.current = false;
      }
    });
  };
  /**
   * Show `v`, anchored where the owner was: Week shows the week of the month in view (this week in this month), Month the
   * month of the week in view. Only the incoming pane's anchor changes: the leaving pane keeps the page it shows while it
   * fades (code review 2 #1). A pager's running goTo counts as already there (its target: code review 1 #1, code review 2
   * #6), and a view shown again inside its own fade-out comes back as it was (code review 2 #1 C).
   */
  const show = (v: View, anchor?: { mon?: string; first?: string }) => {
    const s = live.current.st;
    const back = s.leaving === v;
    let { mon: m, first: f } = s;
    if (v === 'week') {
      const f0 = monthH.target.get() ?? s.first;
      m = anchor?.mon ?? (back ? s.mon : monthOf(f0) === monthOf(today) ? live.current.thisMon : firstWeekOf(f0));
    } else {
      f = anchor?.first ?? (back ? s.first : monthOfWeek(weekH.target.get() ?? s.mon));
      setMonthOn(true);
    }
    if (v !== s.view) preScroll.current = scroller.current?.scrollTop ?? null;
    noteFocus();
    // the other unit's goTo target must not reach this view's labels
    setTgt(null);
    setSt({ view: v, mon: m, first: f, leaving: v === s.view ? s.leaving : s.view });
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
    el.style.clipPath = '';
  };
  /** The bar's parts that the scroll fades (`--hdr`): crossfaded with the panes when a switch changes the scroll (feel review 2 A). */
  const barFades = useRef<Animation[]>([]);
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
      // the held pane shows only below the large title the new scroll brings back, never over it (feel review 2 A)
      const tb = rootRef.current?.querySelector<HTMLElement>('.nb-title')?.getBoundingClientRect().bottom;
      const clip = dy && tb != null ? Math.max(0, Math.ceil(tb - top)) : 0;
      out.style.clipPath = clip ? `inset(${clip}px 0 0 0)` : '';
    }
    // the bar follows the scroll (`--hdr`, written on the next scroll event): when the switch moved it, the large title,
    // the caps and the inline title cross over on the panes' fade instead of snapping (feel review 2 A)
    const hdrOf = (y: number | null | undefined) => Math.min(1, Math.max(0, (y ?? 0) / 44));
    const hb = pre != null ? hdrOf(pre) : null;
    const ha = sc ? hdrOf(sc.scrollTop) : null;
    const barParts = () => {
      const r = rootRef.current;
      const one = (sel: string, at: (h: number) => number) => {
        const el = r?.querySelector<HTMLElement>(sel);
        return el ? [{ el, at }] : [];
      };
      return [...one('.nb-title', (h) => 1 - h), ...one('.nb-date', (h) => 1 - h), ...one('.nb-inline', (h) => h)];
    };
    refocus();
    if (noFade.current || !st.leaving) {
      noFade.current = false;
      releasePane(out);
      if (st.leaving) setSt((s) => ({ ...s, leaving: null }));
      return;
    }
    const ms = ((crossfadeSlow as { duration?: number }).duration ?? 0.2) * 1000;
    const easing = `cubic-bezier(${ease.join(', ')})`;
    if (ha != null && (barFades.current.some((a) => a.playState === 'running') || (hb != null && Math.abs(hb - ha) > 0.01))) {
      // from what is on screen now (a running bar fade included; the CSS still reads the old --hdr here) to the new scroll's
      const parts = barParts().map((p) => ({ ...p, from: +getComputedStyle(p.el).opacity }));
      for (const a of barFades.current) a.cancel();
      barFades.current = parts.map((p) => p.el.animate([{ opacity: p.from }, { opacity: p.at(ha) }], { duration: ms, easing }));
    }
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
   * A page that comes into a pager's neighbour slot is not built live inside the commit's flushSync (review-feel-1 #6;
   * spec §15 risk 1's fallback). When the commit ends a slide (the pager rests), the slot is empty for that frame and the
   * page mounts live on the next one, while nothing moves. When the commit comes under a finger (a swipe that catches the
   * slide: four quick swipes), the page is revealed at once, so the commit draws it `still`: the same pixels as the live
   * page with none of its row hooks (no Pressables, mutation observers or drag state), and it goes live once the pager
   * rests (feel review 2 D: never a blank card, nothing on it changes under the finger). Nothing on a page can be used
   * while its pager moves (a touch then catches the slide). The shown page and a goTo's destination are always live.
   */
  const pagesOf = (m: string, f: string) => new Set([m, shiftDays(m, -7), shiftDays(m, 7), f, addMonths(f, -1), addMonths(f, 1)]);
  const [warm, setWarm] = useState<ReadonlySet<string>>(() => new Set([mon, first]));
  const warmNow = useRef(warm);
  warmNow.current = warm;
  /** Pages drawn still (they stay drawn until they are live: a still page never goes back to empty). */
  const drawn = useRef(new Set<string>());
  const same = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((d) => b.has(d));
  useEffect(() => {
    const want = pagesOf(mon, first);
    const h = view === 'week' ? weekH : monthH;
    let raf = 0;
    const live = () => {
      cancelAnimationFrame(raf);
      if (h.moving.get() || same(want, warmNow.current)) return;
      // the frame after the rest is painted, if nothing has started moving since (flushSync: before any input that frame);
      // while Plan is not the tab on screen (its first mount behind Today) it waits its turn in a transition
      raf = requestAnimationFrame(() => {
        if (h.moving.get()) return;
        drawn.current = new Set([...drawn.current].filter((d) => !want.has(d)));
        if (nav.getState().active === 'plan') flushSync(() => setWarm(want));
        else startTransition(() => setWarm(want));
      });
    };
    live();
    const off = h.moving.on('change', live);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [mon, first, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const faceOf = (d: string, live: boolean, h: typeof weekH): 'live' | 'still' | 'none' => {
    if (live || warmNow.current.has(d) || h.target.get() === d) return 'live';
    if (drawn.current.has(d) || h.moving.get()) {
      drawn.current.add(d);
      return 'still';
    }
    return 'none';
  };
  const renderWeek = useCallback(
    (m: string, live: boolean) => {
      const f = faceOf(m, live, weekH);
      return f === 'none' ? <div className="pl-wpage" aria-hidden="true" /> : <WeekPage mon={m} onThisWeek={onThisWeek} block={block} still={f === 'still'} />;
    },
    [onThisWeek, block, warm], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const renderMonth = useCallback(
    (f: string, live: boolean) => {
      const k = faceOf(f, live, monthH);
      return k === 'none' ? <div className="pl-mpage" aria-hidden="true" /> : <MonthPage first={f} onWeek={onWeek} block={block} still={k === 'still'} />;
    },
    [onWeek, block, warm], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
