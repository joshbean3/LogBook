import { createElement, useEffect, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { isReplaying } from '@/features/onboarding/replay';
import { TOUR_PATH, tourFrom } from '@/features/onboarding/tour/route';
import { usePrefs } from '@/lib/prefs';
import type { TabId } from '@/ui/nav';
import { useSheet } from '@/ui/Sheet';
import { TipSheet } from './TipSheet';
import { TIP_DELAY_MS, TIP_EYEBROW, tipDue, tipsStore, type Tip } from './tips';

/** How often the tab is looked at while a tip waits for it to be clear. */
const LOOK_MS = 150;
/** A tab that is never clear in this long keeps its tip for another visit. */
const GIVE_UP_MS = 12_000;
/** If the sheet's own step back in history is never heard, the tour opens after this long. */
const TOUR_CAP_MS = 1500;

/**
 * What a tip must not rise over, read off the page at the moment it would rise: the splash, the still copy first run
 * lays over Today while it hands off, a sheet or a menu (the nav state says so too; this is the frame it is drawn in), a
 * tab that has not painted or still shows a skeleton, a field with the keys up, an app in the background.
 */
const busyNow = (): boolean => {
  if (document.hidden) return true;
  if (document.querySelector('.brand-splash, .ob-handoff, .sheet-wrap, .cm-layer')) return true;
  if (document.documentElement.classList.contains('kb-open')) return true;
  const a = document.activeElement;
  if (a instanceof HTMLElement && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return true;
  const page = document.querySelector<HTMLElement>('.tab[data-active] > .tab-scroll');
  if (!page || !page.firstElementChild) return true;
  return !!page.querySelector('.skel, .is-skel, .is-shell > .hero-skel, [aria-busy="true"]');
};

/** The lit tab's own button in the capsule: where focus goes back to when a tip closes. */
const tabButton = () => document.querySelector<HTMLElement>('.tabbar .tab-item[aria-current="page"]');

/**
 * First-visit tips, mounted once in the Shell: the first time a tab is on screen at its root, its tip rises as the app's
 * own sheet. `tipDue` (tips.ts) says whether one is due from what the Shell knows; this hook waits until the tab has been
 * painted and clear for `TIP_DELAY_MS`, opens the sheet, and marks the place seen however the sheet is dismissed. A tab
 * change cancels a tip that has not risen yet.
 */
export const useTabTip = ({ active, path, overlays }: { /** the tab on screen */ active: TabId; /** the path on screen: the tab's root, or the pushed page over it */ path: string; /** sheets and menus up (`NavState.overlays`) */ overlays: number }): void => {
  const sheet = useSheet();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const store = useSyncExternalStore(tipsStore.subscribe, tipsStore.get, tipsStore.get);

  // a tab change: a tip may rise over the new tab (never two in a row without one)
  const was = useRef(active);
  useEffect(() => {
    if (was.current === active) return;
    was.current = active;
    tipsStore.tabChanged();
  }, [active]);

  // "See it in the tour": the tour opens once the sheet has gone and given its history entry back
  const leave = useRef<(() => void) | null>(null);
  useEffect(() => () => leave.current?.(), []);

  const tip = tipDue({ path, prefs, seen: store.seen, overlays, busy: false, replaying: isReplaying(), rose: store.rose });
  // the tip's words are fixed per place, account and build: the place is all the effect needs to follow
  const due = useRef<Tip | null>(tip);
  due.current = tip;
  const place = tip?.place ?? null;

  useEffect(() => {
    if (!place) return;
    const began = performance.now();
    let clearSince: number | null = null;
    let timer = 0;
    const open = (t: Tip) => {
      const toTour = () => {
        // the sheet closes, walks back off its own history entry, and only then does the route change: a route written
        // while that step back is still on its way would be undone by it
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          stop();
          setTimeout(() => void navigate(TOUR_PATH, { state: tourFrom(t.place) }), 0);
        };
        const cap = window.setTimeout(go, TOUR_CAP_MS);
        const stop = () => {
          window.removeEventListener('popstate', go);
          clearTimeout(cap);
          leave.current = null;
        };
        window.addEventListener('popstate', go);
        leave.current = stop;
        sheet.close();
      };
      // focus comes back to the tab's own button when the tip closes (the sheet restores its opener)
      const a = document.activeElement;
      if (!a || a === document.body) tabButton()?.focus({ preventScroll: true });
      tipsStore.rose();
      sheet.open({
        eyebrow: TIP_EYEBROW,
        title: t.title,
        body: createElement(TipSheet, { tip: t, onDone: () => sheet.close(), onTour: toTour }),
        // Got it, the link, Close, a flick down, Escape, Back, the scrim: each one is the tip seen
        onClose: () => tipsStore.markSeen(t.place),
      });
    };
    const look = () => {
      const now = performance.now();
      const t = due.current;
      if (!t || sheet.isOpen()) return;
      if (busyNow()) {
        clearSince = null;
        if (now - began < GIVE_UP_MS) timer = window.setTimeout(look, LOOK_MS);
        return;
      }
      clearSince ??= now;
      if (now - clearSince >= TIP_DELAY_MS) return open(t);
      timer = window.setTimeout(look, Math.min(LOOK_MS, TIP_DELAY_MS - (now - clearSince)));
    };
    timer = window.setTimeout(look, 0);
    return () => clearTimeout(timer);
  }, [place, sheet]);
};
