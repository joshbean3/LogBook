import { Activity, BookOpen, CalendarDays, Settings, Sun, Sunrise } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { outbox } from '@/api/outbox';
import { pageVariants, spring } from '@/lib/motion';
import { useMedia } from '@/lib/useToday';
import './shell.css';

const NAV = [
  { to: '/today', label: 'Today', icon: Sun },
  { to: '/morning', label: 'Morning', icon: Sunrise },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/trends', label: 'Trends', icon: Activity },
  { to: '/journal', label: 'Journal', icon: BookOpen },
];

const PendingDot = () => {
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
    <div className="net-pill" role="status">
      <span className={`dot ${online ? 'on' : ''}`} style={!online ? { background: 'var(--warn)' } : undefined} />
      {!online ? 'Offline · changes saved here' : `Syncing ${n} change${n === 1 ? '' : 's'}…`}
    </div>
  );
};

export const Shell = ({ children }: { children?: ReactNode }) => {
  const loc = useLocation();
  const wide = useMedia('(min-width: 900px)');
  const section = loc.pathname.split('/')[1] ?? '';
  return (
    <div className="shell">
      {wide ? (
        <aside className="rail">
          <NavLink to="/today" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-word">Logbook</span>
          </NavLink>
          <nav aria-label="Views" className="rail-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `rail-link ${isActive ? 'on' : ''}`}>
                {({ isActive }) => (
                  <>
                    {isActive ? <motion.span layoutId="rail-pill" className="rail-pill" transition={spring} /> : null}
                    <n.icon size={18} strokeWidth={1.9} />
                    <span>{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/settings" className={({ isActive }) => `rail-link foot ${isActive ? 'on' : ''}`}>
            <Settings size={18} strokeWidth={1.9} />
            <span>Settings</span>
          </NavLink>
        </aside>
      ) : null}
      <main className="content" id="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="page-anim" variants={pageVariants} initial="initial" animate="enter" exit="exit">
            {children ?? <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>
      <PendingDot />
      {!wide ? (
        <nav className="tabbar" aria-label="Views">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
              {({ isActive }) => (
                <>
                  <span className="tab-ic">
                    {isActive ? <motion.span layoutId="tab-glow" className="tab-glow" transition={spring} /> : null}
                    <n.icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
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
