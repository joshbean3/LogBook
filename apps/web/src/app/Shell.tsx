import { Activity, BookOpen, CalendarDays, Settings, Sun, Sunrise } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { outbox } from '@/api/outbox';
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

/**
 * The frame: a rail on wide screens, a tab bar on phones. Page changes fade in with CSS only,
 * so a view that suspends while loading can never be left invisible.
 */
export const Shell = ({ children }: { children?: ReactNode }) => {
  const loc = useLocation();
  const wide = useMedia('(min-width: 900px)');
  const section = loc.pathname.split('/')[1] ?? '';
  return (
    <div className="shell">
      {wide ? (
        <aside className="rail">
          <NavLink to="/today" className="brand">
            <span className="brand-mark"><LogoMark size={22} color="var(--accent)" /></span>
            <span className="brand-word">Logbook</span>
          </NavLink>
          <nav aria-label="Views" className="rail-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `rail-link ${isActive ? 'on' : ''}`}>
                <n.icon size={18} strokeWidth={2} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <NavLink to="/settings" className="rail-link foot">
            <Settings size={18} strokeWidth={2} />
            <span>Settings</span>
          </NavLink>
        </aside>
      ) : null}
      <main className="content" id="main">
        <div key={section} className="page-enter">
          {children ?? <Outlet />}
        </div>
      </main>
      <NetPill />
      {!wide ? (
        <nav className="tabbar" aria-label="Views">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
              {({ isActive }) => (
                <>
                  <n.icon size={24} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.18 : 0} />
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
