import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { motionValue, motion, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { Fragment, memo, Suspense, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NavigationType, parsePath, Route, Routes, UNSAFE_LocationContext as LocationContext, UNSAFE_RouteContext as RouteContext } from 'react-router';
import { outbox } from '@/api/outbox';
import { keys } from '@/api/queries';
import { PTR_ARM_PX, PTR_QUIET_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { matchRoute, REFRESH, TABS, type PushedEntry, type TabDef, type TabId, type TabState } from '@/ui/nav';
import { PushedLayer, StackCtx, type StackMotion } from '@/ui/PushedLayer';
import { pointerClaimed } from '@/ui/useHold';
import { usePress } from '@/ui/usePress';
import { ErrorBoundary } from './ErrorBoundary';
import { PushedEntryScope, TabScope, useNavInternal, useNavState, type Controller } from './NavController';
import './shell.css';

/**
 * The frame (docs/feel.md §9.1, contracts §A.3): four tabs, each its own mounted scroller (`visibility: hidden` + `inert`
 * when not active, never `display: none`, so WebKit keeps its scrollTop), each with a stack of pushed layers over it; the tab
 * bar as the grid's second row. A tab change is a 0 ms cut: no opacity, no transform, no scrollTo, no remount.
 */
export const Shell = ({ pages, pushed }: { pages: Record<TabId, ReactNode>; pushed: (entry: PushedEntry) => ReactNode }): React.JSX.Element => {
  const ctl = useNavInternal();
  const st = useNavState();
  // a tab root mounts on its first activation or in idle after the first content paint, then stays mounted
  const mounted = useRef(new Set<TabId>());
  mounted.current.add(st.active);
  const [, mountAll] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let idle = 0;
    const raf = requestAnimationFrame(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const run = () => {
        for (const t of TABS) mounted.current.add(t.id);
        mountAll();
      };
      idle = ric ? ric(run, { timeout: 2000 }) : window.setTimeout(run, 400);
    });
    return () => {
      cancelAnimationFrame(raf);
      const cic = (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cic) cic(idle);
      else clearTimeout(idle);
    };
  }, []);
  // The tab being left stays painted (under the new one, which is on top while active) for the cut's frame and takes
  // visibility: hidden + inert in the task after that frame: both are inherited, so each costs a style recalc of the whole
  // subtree, and the cut's frame then pays only for the tab it shows (§9.1 budget; nothing on screen differs).
  const prevActive = useRef(st.active);
  const [leaving, setLeaving] = useState<TabId | null>(null);
  if (prevActive.current !== st.active) {
    setLeaving(prevActive.current);
    prevActive.current = st.active;
  }
  useEffect(() => {
    if (!leaving) return;
    let to = 0;
    const raf = requestAnimationFrame(() => (to = window.setTimeout(() => {
      tabEl(st.active)?.removeAttribute('data-preparing');
      setLeaving(null);
    }, 0)));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
    };
  }, [leaving, st.active]);
  return (
    <div className="shell">
      <div className="tabs-host">
        {TABS.map((t) => (
          <TabSection key={t.id} ctl={ctl} tab={t.id} state={st.tabs[t.id]} active={st.active === t.id} leaving={leaving === t.id && st.active !== t.id} mounted={mounted.current.has(t.id)} page={pages[t.id]} pushed={pushed} />
        ))}
      </div>
      <TabBar ctl={ctl} active={st.active} />
      <NetPill />
    </div>
  );
};

/** Each tab root's interim routes (old pages read their params with useParams until their packages replace them). */
const ROOT_ROUTES: Record<TabId, string[]> = {
  today: ['/today/:date?'],
  plan: ['/plan/:view?/:date?'],
  progress: ['/progress'],
  journal: ['/journal/:tab?'],
};

/**
 * Interim (until RouterBridge goes): the old pages read their own route through react-router. `<Routes location>` would
 * still subscribe to the window's location (useRoutes reads useLocation() before it applies the override), so every URL
 * change, a tab tap included, re-rendered every tab's old page. The location here is pinned to the tab's (or the layer's)
 * own path and memoised on it: a URL change elsewhere re-renders nothing below.
 */
/**
 * The route context is reset too: the `<Routes>` around the framed app makes a new matches object on every location change
 * (a popstate, the overlay release's back traversal included), and every nested `<Routes>` reading it re-rendered its old
 * page with it, 100 ms at 4× on the old Plan, inside the frame a sheet's flick needed (feel review 1 #1). The roots' and the
 * layers' patterns are absolute, so they match from an empty parent the same.
 */
const ROOT_ROUTE_CTX = { outlet: null, matches: [], isDataRoute: false };
const RouteAt = ({ path, children }: { path: string; children: ReactNode }) => {
  const value = useMemo(() => {
    const p = parsePath(path);
    return { location: { pathname: p.pathname ?? '/', search: p.search ?? '', hash: p.hash ?? '', state: null, key: path }, navigationType: NavigationType.Pop };
  }, [path]);
  return (
    <RouteContext.Provider value={ROOT_ROUTE_CTX}>
      <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
    </RouteContext.Provider>
  );
};

/** Memoised: a tab change re-renders the two sections whose `active` flips, and never their pages (the 0 ms cut). */
const TabSection = memo(function TabSection({ ctl, tab, state, active, leaving, mounted, page, pushed }: { ctl: Controller; tab: TabId; state: TabState; active: boolean; leaving: boolean; mounted: boolean; page: ReactNode; pushed: (entry: PushedEntry) => ReactNode }) {
  const scroller = ctl.scrollers[tab];
  const layer1 = useRef<HTMLDivElement | null>(null);
  const sm = useMemo<StackMotion>(() => ({ tab, offsets: [motionValue(0), motionValue(0)], scrims: [motionValue(0), motionValue(0)], layer1 }), [tab]);
  useScrollerVars(scroller);
  usePullToRefresh(scroller, tab === 'today' && active);
  const stack = state.stack;
  // the root's subtree depends on its path only: toggling `active` re-renders nothing below the section
  const root = useMemo(
    () =>
      mounted ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <RouteAt path={state.path}>
              <Routes>
                {ROOT_ROUTES[tab].map((p) => (
                  <Route key={p} path={p} element={page} />
                ))}
                <Route path="*" element={page} />
              </Routes>
            </RouteAt>
          </Suspense>
        </ErrorBoundary>
      ) : null,
    [mounted, state.path, tab, page],
  );
  return (
    <TabScope tab={tab}>
      <section className="tab" data-tab={tab} data-active={active || undefined} data-leaving={leaving || undefined} inert={(!active && !leaving) || undefined} aria-hidden={!active || undefined}>
        <motion.div className="tab-scroll" ref={scroller} style={{ x: sm.offsets[0] }}>
          {root}
        </motion.div>
        <Scrim depth={1} value={sm.scrims[0]} />
        <StackCtx.Provider value={sm}>
          <div className="stack-host" data-empty={stack.length ? undefined : ''}>
            {stack.map((e, i) => (
              <Fragment key={e.key}>
                {i === 1 ? <Scrim depth={2} value={sm.scrims[1]} /> : null}
                <PushedLayer entry={e} depth={e.depth} parent={(i === 0 ? scroller : layer1) as RefObject<HTMLElement | null>}>
                  <PushedEntryScope entry={e}>
                    <ErrorBoundary>
                      <Suspense fallback={null}>
                        <LayerRoutes entry={e} pushed={pushed} />
                      </Suspense>
                    </ErrorBoundary>
                  </PushedEntryScope>
                </PushedLayer>
              </Fragment>
            ))}
          </div>
        </StackCtx.Provider>
      </section>
    </TabScope>
  );
});

/** A pushed layer's page, memoised on its entry: a tab change (or a push above it) does not re-render it. */
const LayerRoutes = memo(function LayerRoutes({ entry, pushed }: { entry: PushedEntry; pushed: (entry: PushedEntry) => ReactNode }) {
  const page = pushed(entry);
  return (
    <RouteAt path={entry.path}>
      <Routes>
        <Route path={matchRoute(entry.path).route?.pattern ?? '*'} element={page} />
        <Route path="*" element={page} />
      </Routes>
    </RouteAt>
  );
});

const Scrim = ({ depth, value }: { depth: 1 | 2; value: MotionValue<number> }) => <motion.div className="tab-scrim" data-depth={depth} aria-hidden="true" style={{ opacity: value }} />;

/** One passive scroll listener per scroller writes --hdr (0..1 over the first 44 px); a ResizeObserver writes --scroller-h. */
const useScrollerVars = (ref: RefObject<HTMLDivElement | null>) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let collapsed = false;
    const onScroll = () => {
      const hdr = Math.min(1, Math.max(0, el.scrollTop / 44));
      el.style.setProperty('--hdr', String(hdr));
      const c = hdr >= 0.99;
      if (c !== collapsed) {
        collapsed = c;
        el.querySelector('.nb-bar')?.classList.toggle('is-collapsed', c);
      }
    };
    el.style.setProperty('--hdr', '0');
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => el.style.setProperty('--scroller-h', `${el.clientHeight}px`));
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [ref]);
};

// ---------- the tab bar ----------
/*
 * Preparing the tab under the finger (§9.1 budget). Showing a tab costs a style recalc of its whole subtree (visibility and
 * inert are inherited) and a paint: on pointerdown, in the task after the pressed frame, the target tab is made visible and
 * not inert UNDER the active one (which is opaque and on top: z-index), so that work happens while the finger is down and
 * pointerup only moves the z-index. Nothing on screen changes; a press that does not switch (drag-off, cancel) puts it back.
 */
const tabEl = (tab: TabId) => document.querySelector<HTMLElement>(`.tab[data-tab="${tab}"]`);
let preparing: { tab: TabId; raf: number; to: number } | null = null;
const prepareTab = (tab: TabId) => {
  unprepareTab();
  const p = { tab, raf: 0, to: 0 };
  preparing = p;
  p.raf = requestAnimationFrame(() => {
    p.to = window.setTimeout(() => {
      const el = tabEl(tab);
      if (preparing !== p || !el || el.hasAttribute('data-active')) return;
      el.setAttribute('data-preparing', '');
      el.inert = false;
    }, 0);
  });
};
/** Undo a preparation that did not become the active tab (an activated tab keeps its state: React owns it from there). */
function unprepareTab() {
  const p = preparing;
  if (!p) return;
  preparing = null;
  cancelAnimationFrame(p.raf);
  clearTimeout(p.to);
  const el = tabEl(p.tab);
  if (!el || !el.hasAttribute('data-preparing')) return;
  el.removeAttribute('data-preparing');
  if (!el.hasAttribute('data-active')) el.inert = true;
}
const TabItem = memo(function TabItem({ t, on, ctl }: { t: TabDef; on: boolean; ctl: Controller }) {
  const onPress = () => (ctl.getState().active === t.id ? ctl.reselect(t.id) : ctl.activate(t.id));
  const press = usePress();
  const fromPointer = useRef(false);
  const Icon = t.icon;
  // selected: Sun (its disc filled, its rays kept: with no stroke it is a bare dot) and the book filled, the calendar filled, Activity at stroke 2.5 (§1.1); unselected: stroke 1.8, no fill
  const iconProps = on ? (t.id === 'today' ? { fill: 'currentColor', strokeWidth: 2 } : t.id === 'progress' ? { strokeWidth: 2.5 } : { fill: 'currentColor', fillOpacity: 0.22, strokeWidth: 2 }) : { strokeWidth: 1.8 };
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      className="tab-item pressable"
      data-tab={t.id}
      data-press="scale"
      {...press.handlers}
      onPointerDown={(e) => {
        fromPointer.current = false;
        press.handlers.onPointerDown?.(e);
        if (e.isPrimary && ctl.getState().active !== t.id) prepareTab(t.id);
      }}
      onPointerUp={(e) => {
        const wasPressed = e.currentTarget.hasAttribute('data-pressed');
        press.handlers.onPointerUp?.(e);
        // the switch runs on pointerup (§9.1), not on the click that follows it; the keyboard's click still works
        if (wasPressed && e.isPrimary) {
          fromPointer.current = true;
          onPress();
        }
        unprepareTab();
      }}
      onPointerCancel={(e) => {
        press.handlers.onPointerCancel?.(e);
        unprepareTab();
      }}
      onClick={() => {
        if (fromPointer.current) return void (fromPointer.current = false);
        onPress();
      }}
    >
      <Icon size={24} aria-hidden="true" {...iconProps} />
      <span className="tab-label">{t.label}</span>
    </button>
  );
});
const TabBar = ({ ctl, active }: { ctl: Controller; active: TabId }) => (
  <nav className="tabbar" aria-label="Views">
    <div className="tabs" role="tablist">
      {TABS.map((t) => (
        <TabItem key={t.id} t={t} on={active === t.id} ctl={ctl} />
      ))}
    </div>
  </nav>
);

// ---------- pull to refresh (Today only, gesture-scoped, §9.5) ----------
/** Everything the data tabs draw from. Ends when the fetches end: no floor, no hold. */
const refetchAll = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['month'] }),
    qc.invalidateQueries({ queryKey: keys.bootstrap }),
    qc.invalidateQueries({ queryKey: keys.todos }),
    qc.invalidateQueries({ queryKey: keys.lifts }),
    qc.invalidateQueries({ queryKey: keys.activities }),
  ]);
const R = 10;
const C = 2 * Math.PI * R;
const SLACK = 6;
const GAIN = 0.8;
const MAX_PULL = 100;

/**
 * A `touchstart` on Today's scroller at scrollTop 0 attaches a non-passive `touchmove` synchronously, for that gesture only,
 * and removes it on `touchend`/`touchcancel`. The first move decides: downward and mostly vertical is ours; anything else
 * detaches. The ring follows (dy − 6) × 0.8 to a 100 px cap, arms at 64 (one `threshold`), and a release while armed fires
 * REFRESH and refetches; a fetch under 150 ms shows no busy state. Nothing listens on `document`.
 */
const usePullToRefresh = (ref: RefObject<HTMLDivElement | null>, enabled: boolean) => {
  const qc = useQueryClient();
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let ring: HTMLDivElement | null = null;
    let arc: SVGCircleElement | null = null;
    const ensureRing = () => {
      if (ring) return;
      ring = document.createElement('div');
      ring.className = 'ptr';
      ring.setAttribute('aria-hidden', 'true');
      ring.innerHTML = `<svg viewBox="0 0 24 24"><circle class="track" cx="12" cy="12" r="${R}" fill="none" stroke-width="2.5"/><circle class="fill" cx="12" cy="12" r="${R}" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`;
      arc = ring.querySelector('circle.fill');
      document.body.appendChild(ring);
    };
    const draw = (p: number) => {
      ensureRing();
      ring!.style.transform = `translateY(${Math.round(p) - 40}px)`;
      ring!.style.opacity = String(Math.min(1, p / 16));
      arc!.style.strokeDashoffset = String(C * (1 - Math.min(1, p / PTR_ARM_PX)));
    };
    const hide = () => {
      if (!ring) return;
      ring.style.transform = '';
      ring.style.opacity = '';
      ring.classList.remove('busy');
    };
    let busy = false;
    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || el.scrollTop > 0 || document.querySelector('.sheet-wrap, .cm-layer')) return;
      const t0 = e.touches[0]!;
      const y0 = t0.clientY;
      const x0 = t0.clientX;
      let decided = false;
      let armed = false;
      const detach = () => {
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
        el.removeEventListener('touchcancel', onEnd);
      };
      const onMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        if (!t) return;
        const dy = t.clientY - y0;
        const dx = t.clientX - x0;
        if (!decided) {
          if (Math.hypot(dx, dy) < 2) return;
          decided = true;
          // a hold that became a drag (an object follows the finger) is never a pull (consumer review 1 #5)
          if (dy <= 0 || Math.abs(dx) >= dy || el.scrollTop > 0 || pointerClaimed()) {
            detach();
            return;
          }
        }
        if (ev.cancelable) ev.preventDefault();
        const p = Math.min(MAX_PULL, Math.max(0, (dy - SLACK) * GAIN));
        const over = p >= PTR_ARM_PX;
        if (over && !armed) haptics.threshold();
        armed = over;
        draw(p);
      };
      const onEnd = () => {
        detach();
        if (!armed) return hide();
        busy = true;
        if (ring) {
          ring.style.transform = '';
          arc!.style.strokeDashoffset = '0';
        }
        // a quick fetch shows no busy state at all
        const quiet = setTimeout(() => ring?.classList.add('busy'), PTR_QUIET_MS);
        window.dispatchEvent(new Event(REFRESH));
        void refetchAll(qc).finally(() => {
          clearTimeout(quiet);
          busy = false;
          hide();
        });
        if (ring) ring.style.opacity = '';
      };
      // synchronously, inside this touchstart: the first move already has a listener that may preventDefault
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd);
      el.addEventListener('touchcancel', onEnd);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      ring?.remove();
    };
  }, [ref, enabled, qc]);
};

// ---------- the network pill ----------
const NetPill = () => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const off = outbox.subscribe(setN);
    return () => {
      off();
    };
  }, []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online && !n) return null;
  return (
    <div className="net-pill t-cap" role="status">
      <span className="dot" style={!online ? { background: 'var(--warn)' } : undefined} />
      {!online ? 'Offline · changes saved here' : `Syncing ${n} change${n === 1 ? '' : 's'}…`}
    </div>
  );
};
