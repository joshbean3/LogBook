import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Activity, BookOpen, CalendarDays, Settings, Sun, Sunrise } from 'lucide-react';
import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { outbox } from '@/api/outbox';
import { keys } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { useMedia } from '@/lib/useToday';
import { LogoMark } from '@/ui/primitives';
import './shell.css';

const NAV = [
  { to: '/today', label: 'Today', icon: Sun },
  { to: '/morning', label: 'Morning', icon: Sunrise },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/trends', label: 'Trends', icon: Activity },
  { to: '/journal', label: 'Journal', icon: BookOpen },
];

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

/** Everything the three data tabs draw from: the months, the bootstrap (habits, settings, zones), to-dos and lifts. Half a second at least, so the ring is seen. */
const refetchAll = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['month'] }),
    qc.invalidateQueries({ queryKey: keys.bootstrap }),
    qc.invalidateQueries({ queryKey: keys.todos }),
    qc.invalidateQueries({ queryKey: keys.lifts }),
    qc.invalidateQueries({ queryKey: keys.activities }),
    new Promise((r) => setTimeout(r, 500)),
  ]);

const R = 10;
const C = 2 * Math.PI * R;
const THRESHOLD = 72;
const MAX_PULL = 100;

/**
 * Pull to refresh on Today, Plan and Trends: from the top of the page, a small overscroll pulls a 24px ring down under the
 * status bar and fills it; past the threshold (one tick) letting go fetches the months again. No spinner, no words: the ring
 * sits full while the data arrives, then fades.
 */
const PullToRefresh = ({ enabled }: { enabled: boolean }) => {
  const qc = useQueryClient();
  const ring = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const [state, setState] = useState<'idle' | 'pulling' | 'busy' | 'done'>('idle');
  useEffect(() => {
    if (!enabled) return;
    let y0: number | null = null;
    let pulling = false;
    let armed = false;
    let busy = false;
    const draw = (p: number) => {
      const el = ring.current;
      if (!el) return;
      const prog = Math.min(1, p / THRESHOLD);
      el.style.transform = `translateY(${Math.round(p * 0.7) - 40}px)`;
      el.style.opacity = String(Math.min(1, p / 24));
      if (arc.current) arc.current.style.strokeDashoffset = String(C * (1 - prog));
    };
    const reset = () => {
      y0 = null;
      pulling = false;
      armed = false;
      const el = ring.current;
      if (el) {
        el.style.transform = '';
        el.style.opacity = '';
      }
    };
    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || document.querySelector('.sheet-wrap')) {
        y0 = null;
        return;
      }
      y0 = e.touches[0]!.clientY;
      pulling = false;
    };
    const onMove = (e: TouchEvent) => {
      if (y0 == null || busy) return;
      const dy = e.touches[0]!.clientY - y0;
      if (!pulling) {
        if (dy < 0 || window.scrollY > 0) {
          y0 = null;
          return;
        }
        if (dy < 10) return;
        pulling = true;
        setState('pulling');
      }
      if (e.cancelable) e.preventDefault();
      const p = Math.min(MAX_PULL, (dy - 10) * 0.55);
      const over = p >= THRESHOLD;
      if (over && !armed) haptic('tick');
      armed = over;
      draw(p);
    };
    const onEnd = () => {
      if (!pulling) {
        y0 = null;
        return;
      }
      const go = armed;
      reset();
      if (!go) {
        setState('idle');
        return;
      }
      busy = true;
      setState('busy');
      if (arc.current) arc.current.style.strokeDashoffset = '0';
      void refetchAll(qc).finally(() => {
        busy = false;
        setState('done');
        setTimeout(() => setState('idle'), 260);
      });
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      reset();
    };
  }, [enabled, qc]);
  if (!enabled) return null;
  return (
    <div ref={ring} className={`ptr ${state}`} aria-hidden={state === 'idle' || state === 'pulling'} role="status" aria-label={state === 'busy' ? 'Refreshing' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle className="track" cx={12} cy={12} r={R} fill="none" strokeWidth={2.5} />
        <circle ref={arc} className="fill" cx={12} cy={12} r={R} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
      </svg>
    </div>
  );
};

/**
 * The frame: a rail on wide screens, a tab bar on phones. Page changes fade in with CSS only,
 * so a view that suspends while loading can never be left invisible.
 */
export const Shell = ({ children }: { children?: ReactNode }) => {
  const loc = useLocation();
  const nav = useNavigate();
  const wide = useMedia('(min-width: 900px)');
  // a tab tap navigates inside a transition: the page you are on stays put until the next one can paint
  const go = (to: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (loc.pathname === to) return;
    startTransition(() => nav(to));
  };
  const refreshable = /^\/(today|plan|trends)(\/|$)/.test(loc.pathname);
  return (
    <div className="shell">
      {wide ? (
        <aside className="rail">
          <NavLink to="/today" className="brand">
            <span className="brand-mark">
              <LogoMark size={22} color="var(--accent)" />
            </span>
            <span className="brand-word">Logbook</span>
          </NavLink>
          <nav aria-label="Views" className="rail-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} onClick={go(n.to)} className={({ isActive }) => `rail-link ${isActive ? 'on' : ''}`}>
                <n.icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <NavLink to="/settings" className="rail-link foot">
            <Settings size={18} strokeWidth={2} aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
        </aside>
      ) : null}
      <main className="content" id="main">
        {children ?? <Outlet />}
      </main>
      <PullToRefresh enabled={refreshable && !wide} />
      <NetPill />
      {!wide ? (
        <nav className="tabbar" aria-label="Views" role="tablist">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={go(n.to)} role="tab" aria-selected={loc.pathname === n.to || loc.pathname.startsWith(`${n.to}/`)} className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
              {({ isActive }) => (
                <>
                  <n.icon size={24} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.18 : 0} aria-hidden="true" />
                  <span className="tab-label">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
};
