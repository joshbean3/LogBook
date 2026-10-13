import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { onUnauthorized } from '@/api/client';
import { onDeepLink } from '@/lib/native';
import { outbox } from '@/api/outbox';
import { prefetchAll, useBootstrap } from '@/api/queries';
import { Login, Setup } from '@/features/auth/AuthScreens';
import { Loading } from '@/ui/primitives';
import { watchDynamicType } from './dynamicType';
import { ErrorBoundary, lazyImport } from './ErrorBoundary';
import { Shell } from './Shell';

const views = {
  day: () => import('@/features/day/DayView'),
  morning: () => import('@/features/morning/MorningView'),
  plan: () => import('@/features/plan/PlanView'),
  trends: () => import('@/features/trends/TrendsView'),
  journal: () => import('@/features/journal/JournalView'),
  settings: () => import('@/features/settings/SettingsView'),
};
const DayView = lazy(lazyImport(views.day));
const MorningView = lazy(lazyImport(views.morning));
const PlanView = lazy(lazyImport(views.plan));
const TrendsView = lazy(lazyImport(views.trends));
const JournalView = lazy(lazyImport(views.journal));
const SettingsView = lazy(lazyImport(views.settings));

/** Once the first screen is up, pull every other view in the idle gaps so a tab switch never waits on the network. */
const prefetchViews = () => {
  const run = () => {
    for (const load of Object.values(views)) void load().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
};

const Boot = () => (
  <div className="page" style={{ minHeight: '60dvh', alignContent: 'center', justifyItems: 'center' }}>
    <Loading text="Opening your log…" />
  </div>
);
/** A view chunk still arriving: hold the paper, say nothing. The page fade covers the hand-off. */
const Quiet = () => <div className="page" style={{ minHeight: '100dvh' }} aria-busy="true" />;

/** The CSS page fade, keyed by section so a tab change fades in once. Lives inside Suspense so the old page stays up until the next one can paint. */
const PageFade = ({ children }: { children: React.ReactNode }) => {
  const loc = useLocation();
  const section = loc.pathname.split('/')[1] ?? '';
  return (
    <div key={section} className="page-enter">
      {children}
    </div>
  );
};

const Authed = () => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  useEffect(() => {
    if (boot.data) {
      void outbox.replay(qc);
      prefetchViews();
      void prefetchAll(qc);
    }
  }, [boot.data, qc]);
  if (boot.isPending && !boot.data) return <Boot />;
  if (boot.error && !boot.data) {
    const status = (boot.error as { status?: number }).status;
    if (status === 401) return <Navigate to="/login" replace />;
    return (
      <div className="page">
        <p className="empty">Couldn’t connect. Check your connection.</p>
      </div>
    );
  }
  return (
    <Shell>
      <ErrorBoundary>
        <Suspense fallback={<Quiet />}>
          <PageFade>
          <Routes>
          <Route path="/today/:date?" element={<DayView />} />
          <Route path="/morning/:date?" element={<MorningView />} />
          <Route path="/plan/:view?/:date?" element={<PlanView />} />
          <Route path="/trends" element={<TrendsView />} />
          <Route path="/journal/:tab?" element={<JournalView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
          </PageFade>
        </Suspense>
      </ErrorBoundary>
    </Shell>
  );
};

export const App = () => {
  const loc = useLocation();
  const nav = useNavigate();
  // the type scale follows the iOS text size: the root font size is set once here and re-read when the app comes back
  useEffect(() => watchDynamicType(), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  useEffect(() => {
    void onDeepLink((p) => nav(p));
  }, [nav]);
  // a 401 anywhere sends you to sign in, without reloading the page
  useEffect(() => {
    const fn = () => {
      if (!/^\/(login|setup)/.test(location.pathname)) nav('/login', { replace: true });
    };
    onUnauthorized.add(fn);
    return () => {
      onUnauthorized.delete(fn);
    };
  }, [nav]);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="*" element={<Authed />} />
    </Routes>
  );
};
