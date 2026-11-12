import { addMonths, mondayOf, monthOf, monthStart, parseISO, shiftDays } from '@logbook/shared';
import { useMotionValueEvent } from 'motion/react';
import type * as React from 'react';
import { Activity, startTransition, useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHomeControl, useNav, useRootRequest, useRouteParams, useTabScroller } from '@/app/NavController';
import { crossfadeSlow, ease } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { DayPager, useDayPagerHandle } from '@/ui/DayPager';
import { monthCaption, NavBar } from '@/ui/NavBar';
import { dayCaption } from '@/ui/captions';
import { Note } from '@/ui/primitives';
import { useOpenCalendar } from '../day/Calendar';
import { STRAVA_BUILT } from '@/lib/features';
import { useLog } from '../log/useLog';
import { usePlanBlock } from './Blocks';
import { HeldBanner } from './Held';
import { X } from 'lucide-react';
import { Pressable } from '@/ui/Pressable';
import { MonthPage } from './Month';
import { markNavHintSeen, navHintSeen } from './navHint';
import { PlanCard } from './PlanTop';
import { WeekPage } from './Week';
import './plan.css';

/**
 * Fitness (guide 6.5a, "Fitness"; docs/feel.md §7, contracts §A.3 page-root): the NavBar (caps: today's date in Week, as
 * on the other tabs, `OCTOBER 2026` in Month, bound to the month pager's progress; the caps date is a button, with its
 * small calendar glyph: it shows the month, and from the month goes back to the week; title `Fitness`, tap → this week /
 * this month, hold → `Go to a week…`); then the held banner and a one-time hint line; then two mounted panes: the week
 * pager (`DayPager step='week'`, full-bleed, each page that week's card and its line of days: Week.tsx) and the month
 * pager (`step='month'`); then the plan row (PlanTop). Weeks move by a sideways swipe anywhere on the page. No chart on
 * the page. Switching is a 200 ms crossfade of the two panes (both in the DOM during it). No haptic on any of it.
 *
 * `view` and the anchor (the Monday, the first of the month) are page state: read once from the route, mirrored into the
 * URL with `nav.replace` on every commit, changed from outside only through `useRootRequest` (a cut sets them before the
 * first frame; on an active Fitness the pager slides, or the panes crossfade when the view changes). The lit tab re-tapped
 * off this week (month) slides home (`useHomeControl`).
 */
type View = 'week' | 'month';
/** How a pager slot draws its page: live, still (no row hooks), from the stash's HTML, or empty (PlanView's faceOf). */
type Face = 'live' | 'still' | 'snap' | 'none';
interface St {
  view: View;
  mon: string;
  first: string;
  /** The pane fading out (both are in the DOM; this one is absolute over the top of the incoming one). */
  leaving: View | null;
}

/** The month a week belongs to: its Thursday's (ISO weeks). */
const monthOfWeek = (mon: string) => monthStart(shiftDays(mon, 3));
/** Months from `a` to `b` (firsts of months). */
const monthsApart = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
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

  const dismissRef = useRef<() => void>(() => undefined);
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
      // a swipe to another week: the hint has done its work
      if (m !== live.current.thisMon) dismissRef.current();
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
    if (v !== s.view) {
      preScroll.current = scroller.current?.scrollTop ?? null;
      toTop.current = true;
    }
    noteFocus();
    // the other unit's goTo target must not reach this view's labels
    setTgt(null);
    setSt({ view: v, mon: m, first: f, leaving: v === s.view ? s.leaving : s.view });
    nav.replace(v === 'week' ? weekPath(m) : monthPath(f));
  };
  const weekPane = useRef<HTMLElement>(null);
  const monthPane = useRef<HTMLElement>(null);
  /**
   * A switch asked for while the panes sit low on the screen (at rest the week's header is under the plan card, the
   * morning and today's session, so the switch would change one line above the dock): the shown pane's header then
   * scrolls up to just under the bar, so the week or the month that was asked for is what the screen shows (plan-09).
   */
  const toTop = useRef(false);
  useEffect(() => {
    if (!toTop.current) return;
    toTop.current = false;
    const sc = scroller.current;
    const pane = (view === 'week' ? weekPane : monthPane).current;
    const bar = rootRef.current?.querySelector<HTMLElement>('.nb-bar');
    if (!sc || !pane || !bar) return;
    const delta = pane.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - 8;
    if (delta < sc.clientHeight * 0.3) return;
    sc.scrollTo({ top: sc.scrollTop + delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
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
      // a scroll during the fade wins: each part goes on from where it is to the scroll's value (in the time left, 100–150
      // ms), and the CSS (`--hdr`) has it again when the fade ends (code review 3 #2)
      const t0 = performance.now();
      const own = barFades.current;
      let aim = ha;
      const onScroll = () => {
        if (barFades.current !== own || !own.some((a) => a.playState === 'running')) return void sc?.removeEventListener('scroll', onScroll);
        // the scroll event of the switch's own clamp (or any scroll that leaves the bar's value where the fade is going) is
        // not a change of aim
        if (Math.abs(hdrOf(sc?.scrollTop) - aim) <= 0.01) return;
        aim = hdrOf(sc?.scrollTop);
        // in what is left of the fade, at least 100 ms and at most 150 (the scroll is the owner's hand), easing out, so the
        // CSS takes it back with no step
        const left = Math.max(100, Math.min(150, ms - (performance.now() - t0)));
        const h = aim;
        const next = parts.map((p, i) => {
          const from = +getComputedStyle(p.el).opacity;
          own[i]?.cancel();
          return p.el.animate([{ opacity: from }, { opacity: p.at(h) }], { duration: left, easing });
        });
        own.splice(0, own.length, ...next);
      };
      sc?.addEventListener('scroll', onScroll, { passive: true });
    }
    const aIn = inc?.animate([{ opacity: from.inc }, { opacity: 1 }], { duration: Math.max(1, ms * (1 - from.inc)), easing });
    const aOut = out?.animate([{ opacity: from.out }, { opacity: 0 }], { duration: Math.max(1, ms * from.out), easing, fill: 'forwards' });
    fades.current = [aIn, aOut].filter((a): a is Animation => !!a);
    // the switch's own work can hold the frame after the fades start (at 4×, 100–200 ms): their first visible frame would
    // then be most of the way through, a cut (feel review 3 #5). After such a frame they go on from their second frame.
    const paced = [...fades.current, ...barFades.current];
    let f0 = 0;
    requestAnimationFrame((t0) => {
      f0 = t0;
      requestAnimationFrame((t1) => {
        if (t1 - f0 < 50) return;
        for (const a of paced) if (a.playState === 'running' && (a.currentTime as number) > 33) a.currentTime = 33;
      });
    });
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
  // the week's dates are in its header ("This week Nov 9 to 15"): the caption is today's date, as on the other tabs
  const caps =
    view === 'week'
      ? (() => {
          const d = dayCaption(today, today);
          return { prev: d, cur: d, next: d };
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
  const onBackToWeek = useCallback(() => show('week'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onWeek = useCallback((m: string) => show('week', { mon: m }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onThisMonth = useCallback(() => {
    noteFocus();
    monthH.goTo(live.current.thisFirst);
  }, [monthH]); // eslint-disable-line react-hooks/exhaustive-deps
  const onMonthStep = useCallback(
    (dir: -1 | 1) => {
      noteFocus();
      monthH.goTo(addMonths(monthH.target.get() ?? live.current.st.first, dir));
    },
    [monthH], // eslint-disable-line react-hooks/exhaustive-deps
  );
  /**
   * The header arrows while their pager slides (plan-12): a touch then lands on a page that is moving (or on the inert
   * neighbour coming in), so the pager would catch the slide and the arrow would never hear the tap. A press on the spot
   * where an arrow of the page the pager is going to will rest is taken here, before the pager's own listener: it steps
   * one more page from where the slide is going, and the click that follows is swallowed (the arrow under it may be live
   * by then). At rest nothing is taken: the arrow's own press runs.
   */
  useEffect(() => {
    const offs: Array<() => void> = [];
    const bind = (pane: HTMLElement | null, h: typeof weekH, step: (dir: -1 | 1) => void) => {
      if (!pane) return;
      let took = 0;
      const down = (e: PointerEvent) => {
        if (!e.isPrimary || !h.moving.get()) return;
        const to = h.target.get();
        const page = (to && pane.querySelector<HTMLElement>(`.dp-page[data-date="${to}"]`)) || pane.querySelector<HTMLElement>('.dp-page[data-role="cur"]');
        const dp = pane.querySelector<HTMLElement>('.dp');
        if (!page || !dp) return;
        // where that page's arrows will be once it rests: their place in the page, from the pager's left edge
        const dx = dp.getBoundingClientRect().left - page.getBoundingClientRect().left;
        for (const b of page.querySelectorAll<HTMLElement>('.pl-step[data-step]')) {
          const r = b.getBoundingClientRect();
          if (e.clientX >= r.left + dx && e.clientX <= r.right + dx && e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4) {
            e.stopPropagation();
            took = performance.now();
            step(b.dataset.step === '-1' ? -1 : 1);
            return;
          }
        }
      };
      const click = (e: MouseEvent) => {
        if (!took || performance.now() - took > 700) return void (took = 0);
        took = 0;
        e.stopPropagation();
        e.preventDefault();
      };
      pane.addEventListener('pointerdown', down, true);
      pane.addEventListener('click', click, true);
      offs.push(() => (pane.removeEventListener('pointerdown', down, true), pane.removeEventListener('click', click, true)));
    };
    // the week has no arrows now (it moves by swipe); the month's header keeps its own
    bind(monthPane.current, monthH, onMonthStep);
    return () => offs.forEach((f) => f());
  }, [monthOn, monthH, onMonthStep]);
  const block = usePlanBlock();
  // the one-time line that says how to reach other weeks and the month, now that the arrows and the switch are gone
  const [hint, setHint] = useState(() => !navHintSeen());
  const dismissHint = useCallback(() => {
    markNavHintSeen();
    setHint(false);
  }, []);
  dismissRef.current = dismissHint;
  /**
   * A page that comes into a pager's neighbour slot is not built live inside the commit's flushSync (review-feel-1 #6;
   * spec §15 risk 1's fallback). When the commit ends a slide (the pager rests), the slot is empty for that frame and the
   * pages go live one a frame after it, while nothing moves (a finger landing first draws the empty one at once). When the
   * commit comes under a finger (a swipe that catches the slide: four quick swipes), the page is drawn `still`: the same
   * pixels as the live page with none of its row hooks (no Pressables, mutation observers or drag state), in the commit
   * when its slot is at the screen's edge, else two frames later; a still page stays still while the pager moves, even as
   * it becomes the shown page, and goes live once the pager rests (feel review 2 D, feel review 3 #1: never a blank card,
   * nothing on it changes under the finger, and no page is made live under it). Nothing on a page can be used while its
   * pager moves (a touch then catches the slide). A goTo's destination is always live.
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
    // one page a frame, the shown one first, then the one ahead and the one behind (feel review 3 #1: three pages made live
    // in one frame was a 67–117 ms frame at 4×); the other view's pages with the last step
    const order = view === 'week' ? [mon, shiftDays(mon, 7), shiftDays(mon, -7)] : [first, addMonths(first, 1), addMonths(first, -1)];
    let raf = 0;
    let waitFade: Animation | null = null;
    const live = () => {
      cancelAnimationFrame(raf);
      if (h.moving.get()) return;
      // not during Week ⇄ Month's crossfade: the incoming pane's neighbours wait for it to end (feel review 3 #5)
      const fade = fades.current.find((a) => a.playState === 'running') ?? null;
      if (fade) {
        if (waitFade !== fade) {
          waitFade = fade;
          void fade.finished.then(live, live);
        }
        return;
      }
      if (same(want, warmNow.current)) return;
      // the frame after the rest is painted, if nothing has started moving since (flushSync: before any input that frame);
      // while Plan is not the tab on screen (its first mount behind Today) it waits its turn in a transition
      raf = requestAnimationFrame(() => {
        if (h.moving.get()) return;
        const now = warmNow.current;
        const step = nav.getState().active === 'plan' ? order.find((d) => !now.has(d)) : undefined;
        const next = step ? new Set([...now].filter((d) => want.has(d)).concat(step)) : want;
        drawn.current = new Set([...drawn.current].filter((d) => !next.has(d)));
        for (const k of [...snapped.current.keys()]) if (next.has(k.slice(2))) snapped.current.delete(k);
        if (!step) return startTransition(() => setWarm(next));
        flushSync(() => setWarm(next));
        live();
      });
    };
    live();
    const off = h.moving.on('change', (m) => {
      // a finger that lands on a pager at rest whose neighbour is not drawn yet (the commit that ended the slide left it
      // empty, and the live mount has not come): it is drawn now, before the drag can show it (spec §15 risk 1's fallback)
      if (m && order.some((d) => noneNow.current.has(d))) flushSync(bumpDrawn);
      live();
    });
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [mon, first, view]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * The stash (feel review 3 #1): the pages two steps out from the shown one, drawn still in a hidden (display: none) box
   * in a transition after each commit, so the work runs in slices between frames and costs no style or layout. A caught
   * commit that brings one of them into a neighbour slot puts in its HTML (`snap`): the slot's content is parsed, not
   * rendered, in the commit. It is the still page's markup, so the pixels are the live page's.
   */
  const stashRef = useRef<HTMLDivElement>(null);
  const keyOf = (d: string, h: typeof weekH) => `${h === weekH ? 'w' : 'm'}:${d}`;
  /** Pages drawn from a snapshot, with the HTML they were drawn with (kept until they are live: nothing changes on screen). */
  const snapped = useRef(new Map<string, string>());
  const snapOf = (d: string, h: typeof weekH) => {
    const k = keyOf(d, h);
    // this week's page holds Today's training card (its ring, its landing): it is always rendered, never pasted as HTML
    if (h === weekH && d === live.current.thisMon) return false;
    if (snapped.current.has(k)) return true;
    const el = stashRef.current?.querySelector<HTMLElement>(`[data-stash="${k}"] > .pl-wpage, [data-stash="${k}"] > .pl-mpage`);
    if (!el || el.querySelector('.pl-skel, [aria-busy="true"]')) return false;
    snapped.current.set(k, el.outerHTML);
    return true;
  };
  const stashOf = (m: string, f: string, v: View) => (v === 'week' ? [shiftDays(m, 14), shiftDays(m, -14)].map((d) => `w:${d}`) : [addMonths(f, 2), addMonths(f, -2)].map((d) => `m:${d}`));
  const [stash, setStash] = useState<string[]>([]);
  // after each commit (between quick swipes too: its slices run between frames), but never inside Week ⇄ Month's
  // crossfade: then it waits for the fade's end (feel review 3 #5)
  useEffect(() => {
    let on = true;
    const go = () => {
      if (!on) return;
      const fade = fades.current.find((a) => a.playState === 'running');
      if (fade) return void fade.finished.then(go, go);
      const want = stashOf(mon, first, view);
      startTransition(() => setStash((s) => (s.length === want.length && s.every((k, i) => k === want[i]) ? s : want)));
    };
    go();
    return () => void (on = false);
  }, [mon, first, view]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * Pages a caught commit brought into a neighbour slot more than a quarter page off screen are drawn still two frames
   * later (feel review 3 #1): the commit's frame then costs what a role swap costs, the build gets a frame of its own, and
   * the finger cannot bring the slot on screen before then (it is drawn in the rAF before that frame's paint). A slot
   * closer than that (a catch that finished the slide leaves it at the screen's edge) is drawn in the commit.
   */
  const pending = useRef(new Map<string, typeof weekH>());
  /** Neighbours rendered empty in the last render (a commit that ended a slide), until they are drawn. */
  const noneNow = useRef(new Set<string>());
  const pendingRaf = useRef(0);
  const [drawnVer, bumpDrawn] = useReducer((x: number) => x + 1, 0);
  useLayoutEffect(() => {
    if (!pending.current.size || pendingRaf.current) return;
    pendingRaf.current = requestAnimationFrame(() => {
      pendingRaf.current = requestAnimationFrame(() => {
        pendingRaf.current = 0;
        for (const [d, h] of pending.current) if (!snapOf(d, h)) drawn.current.add(d);
        pending.current.clear();
        flushSync(bumpDrawn);
      });
    });
  });
  useEffect(() => () => cancelAnimationFrame(pendingRaf.current), []);
  const faceOf = (d: string, live: boolean, h: typeof weekH): Face => {
    const f = faceOf0(d, live, h);
    if (f === 'none') noneNow.current.add(d);
    else noneNow.current.delete(d);
    return f;
  };
  const faceOf0 = (d: string, live: boolean, h: typeof weekH): Face => {
    if (warmNow.current.has(d) || h.target.get() === d) return 'live';
    // a page drawn still (or from its snapshot) stays so while its pager moves, even as it becomes the shown page under a
    // finger (feel review 3 #1: making it live there was the caught commit's largest cost); it goes live at the rest
    if (snapped.current.has(keyOf(d, h))) return 'snap';
    if (drawn.current.has(d)) return 'still';
    if (h.moving.get()) {
      // the stash drew it already: the commit puts its HTML in the slot (no React render of the page in the commit)
      if (snapOf(d, h)) return 'snap';
      // where the page will sit once this render is in: its slot's offset from the page the track's x is measured against
      // (in a commit's render, the page being left), in page widths
      const dp = (h === weekH ? weekPane : monthPane).current?.querySelector<HTMLElement>(':scope .dp-page[data-role="cur"]');
      const at = dp?.dataset.date;
      const W = window.innerWidth;
      const k = at ? (h === weekH ? Math.round((parseISO(d).getTime() - parseISO(at).getTime()) / (7 * 864e5)) : monthsApart(at, d)) : 0;
      const left = h.x.get() + k * W;
      // close to the screen (a catch that finished the slide: the slot sits right at the edge): drawn in this render
      if (left < W + W / 4 && left > -W - W / 4) {
        drawn.current.add(d);
        return 'still';
      }
      pending.current.set(d, h);
      return 'none';
    }
    return live ? 'live' : 'none';
  };
  const renderWeek = useCallback(
    (m: string, live: boolean) => {
      const f = faceOf(m, live, weekH);
      if (f === 'snap') return <div className="pl-snap" aria-hidden="true" dangerouslySetInnerHTML={{ __html: snapped.current.get(keyOf(m, weekH))! }} />;
      return f === 'none' ? <div className="pl-wpage" aria-hidden="true" /> : <WeekPage mon={m} onThisWeek={onThisWeek} still={f === 'still'} />;
    },
    [onThisWeek, warm, drawnVer], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const renderMonth = useCallback(
    (f: string, live: boolean) => {
      const k = faceOf(f, live, monthH);
      if (k === 'snap') return <div className="pl-snap" aria-hidden="true" dangerouslySetInnerHTML={{ __html: snapped.current.get(keyOf(f, monthH))! }} />;
      return k === 'none' ? <div className="pl-mpage" aria-hidden="true" /> : <MonthPage first={f} onWeek={onWeek} onStep={onMonthStep} onThisMonth={onThisMonth} onBack={onBackToWeek} still={k === 'still'} />;
    },
    [onWeek, onMonthStep, onThisMonth, onBackToWeek, warm, drawnVer], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const stashBox = (
    <div ref={stashRef} className="pl-stash" hidden aria-hidden="true" inert>
      {stash.map((k) => (
        <div key={k} data-stash={k}>
          {k.startsWith('w:') ? <WeekPage mon={k.slice(2)} onThisWeek={onThisWeek} still /> : <MonthPage first={k.slice(2)} onWeek={onWeek} onStep={onMonthStep} onThisMonth={onThisMonth} onBack={onBackToWeek} still />}
        </div>
      ))}
    </div>
  );
  // the sync note belongs to a build with Strava; without it the branch is dropped
  const strava = STRAVA_BUILT ? useLog([]).strava : null; // eslint-disable-line react-hooks/rules-of-hooks
  const paneCls = (v: View) => (view === v ? 'is-on' : st.leaving === v ? 'is-leaving' : 'is-off');
  const hidden = (v: View) => view !== v || undefined;
  // the pane that is neither shown nor fading out defers its updates (a drop re-renders the shown pages only)
  const mode = (v: View) => (view === v || st.leaving === v ? 'visible' : 'hidden');
  return (
    <div ref={rootRef} className={`page-root plan-root plan-${view}`}>
      <NavBar
        caps={caps}
        title={{ cur: 'Fitness' }}
        progress={handle.progress}
        // the date is the way to the month and back (a small calendar glyph marks it as a button)
        onDatePress={() => {
          dismissHint();
          show(live.current.st.view === 'week' ? 'month' : 'week');
        }}
        dateLabel={view === 'week' ? `${caps.cur}. Show the month` : `${caps.cur}. Back to the week`}
        onTitlePress={() => {
          const s = live.current.st;
          if (s.view === 'week' ? s.mon !== live.current.thisMon : s.first !== live.current.thisFirst) goHome();
        }}
        titleMenu={titleMenu}
        titleLabel={atHome ? 'Fitness' : view === 'week' ? 'Fitness. Go to this week' : 'Fitness. Go to this month'}
        titleRef={titleRef}
        gap={16}
      />
      <HeldBanner />
      {/* shown until the first swipe to another week or the first tap on the date, once on this device */}
      {hint && view === 'week' ? (
        <Pressable className="pl-hint" press="dim" onPress={dismissHint} label="Swipe for other weeks. Tap the date for the month. Dismiss">
          <span>Swipe for other weeks. Tap the date for the month.</span>
          <X size={16} aria-hidden="true" />
        </Pressable>
      ) : null}
      <div className="pl-panes">
        <section ref={weekPane} className={`pl-pane pl-week-pane ${paneCls('week')}`} inert={hidden('week')} aria-hidden={hidden('week')} aria-label="Week">
          <Activity mode={mode('week')}>
            <DayPager className="pl-wpager" date={mon} step="week" handle={weekH} onCommit={commitWeek} render={renderWeek} label="Week" prevLabel="Previous week" nextLabel="Next week" />
            {view === 'week' ? stashBox : null}
          </Activity>
        </section>
        {monthOn ? (
          <section ref={monthPane} className={`pl-pane pl-month-pane ${paneCls('month')}`} inert={hidden('month')} aria-hidden={hidden('month')} aria-label="Month">
            <Activity mode={mode('month')}>
              <DayPager className="pl-mpager" date={first} step="month" handle={monthH} onCommit={commitMonth} render={renderMonth} label="Month" prevLabel="Previous month" nextLabel="Next month" />
              {view === 'month' ? stashBox : null}
            </Activity>
          </section>
        ) : null}
      </div>
      {strava?.error ? (
        <div className="pl-note">
          <Note kind="warn">{strava.error}</Note>
        </div>
      ) : null}
      {/* the plan, a quiet row under the days: its name and where it stands, or the way to build one */}
      <PlanCard block={block} />
    </div>
  );
}
