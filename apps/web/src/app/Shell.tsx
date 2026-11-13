import { GoalsBadge } from '@/features/goals/GoalsBadge';
import { Dock } from './Dock';
import { CelebrateLayer } from '@/features/goals/Celebrate';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { motionValue, motion, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { Fragment, memo, Suspense, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import { isOffline } from '@/api/client';
import { outbox } from '@/api/outbox';
import { keys } from '@/api/queries';
import { PTR_ARM_PX, PTR_QUIET_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { REFRESH, shownTabs, TABS, type PushedEntry, type TabDef, type TabId, type TabState } from '@/ui/nav';
import { useFitness } from '@/lib/prefs';
import { useTabTip } from '@/features/tips/useTabTip';
import { BackButton } from '@/ui/NavBar';
import { PushedLayer, StackCtx, type StackMotion } from '@/ui/PushedLayer';
import { pointerClaimed } from '@/ui/useHold';
import { showToast } from '@/ui/toastStore';
import { usePress } from '@/ui/usePress';
import { ErrorBoundary } from './ErrorBoundary';
import { healthSyncNow, useHealthSync } from '@/lib/healthSync';
import { OrbsMoment } from '@/features/orbs/moment/OrbsMoment';
import { useReconcile } from '@/features/orbs/useReconcile';
import { PushedEntryScope, TabScope, useNav, useNavInternal, useNavState, type Controller } from './NavController';
import './shell.css';
import './healthPill.css';

/**
 * The frame (docs/feel.md §9.1, contracts §A.3): the tabs, each its own mounted scroller (`visibility: hidden` + `inert`
 * when not active, never `display: none`, so WebKit keeps its scrollTop), each with a stack of pushed layers over it; the tab
 * bar and the ask bar float over them in the dock (Dock.tsx). A tab change is a 0 ms cut: no opacity, no transform, no scrollTo, no remount.
 */
export const Shell = ({ pages, pushed }: { pages: Record<TabId, ReactNode>; pushed: (entry: PushedEntry) => ReactNode }): React.JSX.Element => {
  const ctl = useNavInternal();
  const st = useNavState();
  // Orbs: the one reconciler, for the whole app. It draws nothing (features/orbs/useReconcile.ts)
  useReconcile();
  // with Fitness off its tab is not mounted and not drawn; the ones that remain share the capsule evenly
  const tabs = shownTabs(useFitness());
  // the tab on screen is always one the capsule draws: should the state ever name one that is not shown (Fitness, the
  // moment it is switched off; NavController.fitnessOff then moves the state itself), Today stands in, never a blank page
  const active: TabId = tabs.some((t) => t.id === st.active) ? st.active : 'today';
  // a tab root mounts on its first activation or in idle after the first content paint, then stays mounted
  const mounted = useRef(new Set<TabId>());
  mounted.current.add(active);
  // the first visit to each tab: its tip rises once, over the tab at its root (features/tips)
  useTabTip({ active, path: st.tabs[active].stack.at(-1)?.path ?? st.tabs[active].path, overlays: st.overlays });
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
  const prevActive = useRef(active);
  const [leaving, setLeaving] = useState<TabId | null>(null);
  if (prevActive.current !== active) {
    setLeaving(prevActive.current);
    prevActive.current = active;
  }
  useEffect(() => {
    if (!leaving) return;
    let to = 0;
    const raf = requestAnimationFrame(() => (to = window.setTimeout(() => {
      tabEl(active)?.removeAttribute('data-preparing');
      setLeaving(null);
    }, 0)));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
    };
  }, [leaving, active]);
  return (
    <div className="shell">
      <CelebrateLayer />
      <OrbsMoment />
      <div className="tabs-host">
        {tabs.map((t) => (
          <TabSection key={t.id} ctl={ctl} tab={t.id} state={st.tabs[t.id]} active={active === t.id} leaving={leaving === t.id && active !== t.id} mounted={mounted.current.has(t.id)} page={pages[t.id]} pushed={pushed} />
        ))}
      </div>
      <Dock today={st.tabs.today.path}>
        <TabBar ctl={ctl} active={active} tabs={tabs} />
      </Dock>
      <StatusPill />
    </div>
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
  // the root reads its own params (useRouteParams): toggling `active` or a URL change re-renders nothing below the section
  const root = useMemo(
    () =>
      mounted ? (
        <PageBoundary tab={tab}>
          <Suspense fallback={null}>{page}</Suspense>
        </PageBoundary>
      ) : null,
    [mounted, page],
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
                    <PageBoundary tab={tab} pushed>
                      <Suspense fallback={null}>
                        <LayerPage entry={e} pushed={pushed} />
                      </Suspense>
                    </PageBoundary>
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

/**
 * A page's boundary (shell-18): Reload, plus a quiet way out. A tab root offers Go to Today (Today itself has none); a
 * pushed page keeps its chevron in a bar above the fallback and offers Back.
 */
const PageBoundary = ({ tab, pushed, children }: { tab: TabId; pushed?: boolean; children: ReactNode }) => {
  const nav = useNav();
  const secondary = pushed ? { label: 'Back', onPress: () => nav.pop() } : tab !== 'today' ? { label: 'Go to Today', onPress: () => nav.go('/today') } : undefined;
  return (
    <ErrorBoundary secondary={secondary} bar={pushed ? <BackButton /> : undefined}>
      {children}
    </ErrorBoundary>
  );
};

/** A pushed layer's page, memoised on its entry: a tab change (or a push above it) does not re-render it. */
const LayerPage = memo(function LayerPage({ entry, pushed }: { entry: PushedEntry; pushed: (entry: PushedEntry) => ReactNode }) {
  return <>{pushed(entry)}</>;
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
  // one glyph in both states (guide 6.1): the shown tab is the Sky disc behind it, a Night Ink glyph and a heavier label
  return (
    <button
      type="button"
      aria-current={on ? 'page' : undefined}
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
      <span className="tab-ic">
        <Icon size={22} />
      </span>
      <span className="tab-label">{t.label}</span>
      {t.id === 'goals' ? <GoalsBadge /> : null}
    </button>
  );
});
const TabBar = ({ ctl, active, tabs }: { ctl: Controller; active: TabId; tabs: readonly TabDef[] }) => (
  <nav className="tabbar" aria-label="Views">
    {/* a navigation landmark of buttons, the current one marked (a11y-15): no tablist, which promised arrow keys */}
    <div className="tabs">
      {tabs.map((t) => (
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
    // a pull also asks Apple Health for anything new (the engine joins a run already going)
    healthSyncNow(qc, 'manual', true).catch(() => null),
  ]);
const R = 10;
const C = 2 * Math.PI * R;
const SLACK = 6;
const GAIN = 0.8;
const MAX_PULL = 100;
/** However the fetches are doing, the busy ring goes after this long. */
const PTR_GIVE_UP_MS = 10_000;

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
        // offline there is nothing to fetch: the ring goes, with a warning tap and a word (shell-08)
        if (isOffline()) {
          hide();
          haptics.warning();
          showToast('You’re offline');
          return;
        }
        busy = true;
        if (ring) {
          ring.style.transform = '';
          arc!.style.strokeDashoffset = '0';
        }
        // a quick fetch shows no busy state at all; a slow one turns a short arc
        const quiet = setTimeout(() => {
          ring?.classList.add('busy');
          if (arc) arc.style.strokeDashoffset = String(C * 0.72);
        }, PTR_QUIET_MS);
        window.dispatchEvent(new Event(REFRESH));
        // the ring always clears: when the fetches end, or after PTR_GIVE_UP_MS whatever they are doing
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(quiet);
          clearTimeout(giveUp);
          busy = false;
          hide();
        };
        const giveUp = setTimeout(finish, PTR_GIVE_UP_MS);
        void refetchAll(qc).finally(finish);
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

// ---------- the status pill: one slot above the dock, for the network or Apple Health (shell-07) ----------
/**
 * One line, never two, just above the dock: it covers no title or control (pages make room for it while it shows) and sits
 * apart from the toasts at the top. The network state wins the slot; Apple Health's import or a sync that brought data
 * shows only when the network has nothing to say.
 */
const StatusPill = () => {
  const net = useNetState();
  const health = useHealthPillState();
  const text = net ?? health;
  useEffect(() => {
    const el = document.documentElement;
    if (text) el.setAttribute('data-status-pill', '');
    else el.removeAttribute('data-status-pill');
    return () => el.removeAttribute('data-status-pill');
  }, [text]);
  if (net)
    return (
      <div className="net-pill" role="status">
        <span className="dot" style={net.startsWith('Offline') ? { background: 'var(--warn)' } : undefined} />
        {net}
      </div>
    );
  if (health)
    return (
      <div className={`net-pill hl-pill ${health === HEALTH_DONE ? 'is-done' : ''}`.trim()} role="status">
        <span className={`dot ${health === HEALTH_DONE ? '' : 'hl-pill-spin'}`.trim()} />
        {health}
      </div>
    );
  return null;
};

const HEALTH_DONE = 'Apple Health synced';
/** Apple Health's words for the slot: while the first import reads history, and for a moment when a sync brings data. */
const useHealthPillState = (): string | null => {
  const s = useHealthSync();
  const [flash, setFlash] = useState(false);
  const lastAt = s.last?.at;
  const brought = (s.last?.uploaded ?? 0) > 0;
  useEffect(() => {
    if (!lastAt || !brought) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1800);
    return () => clearTimeout(t);
  }, [lastAt, brought]);
  if (s.phase === 'importing') return `Reading Apple Health${s.detail ? ` · ${new Date(s.detail).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '…'}`;
  if (flash && s.phase === 'done') return HEALTH_DONE;
  return null;
};

/**
 * The network's words for the slot (shell-07, shell-09): offline, "Offline. Changes are saved."; online with changes
 * queued, "Syncing…" only while one is on the wire, otherwise "Waiting to sync 1 change" between the outbox's retries.
 */
const useNetState = (): string | null => {
  const [n, setN] = useState(0);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const a = outbox.subscribe(setN);
    const b = outbox.subscribeSending(setSending);
    return () => {
      a();
      b();
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
  if (!online) return 'Offline. Changes are saved.';
  if (!n) return null;
  return sending ? 'Syncing…' : `Waiting to sync ${n} change${n === 1 ? '' : 's'}`;
};
