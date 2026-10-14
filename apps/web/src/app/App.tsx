import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { onUnauthorized } from '@/api/client';
import { onDeepLink } from '@/lib/native';
import { outbox } from '@/api/outbox';
import { prefetchAll, useBootstrap } from '@/api/queries';
import { Login, Setup } from '@/features/auth/AuthScreens';
import { ContextMenuProvider } from '@/ui/ContextMenu';
import { routeInfo } from '@/ui/nav';
import { PushedPage } from '@/ui/PushedPage';
import { SkeletonPage } from '@/ui/Skeleton';
import { watchDynamicType } from './dynamicType';
import { ErrorBoundary, lazyImport } from './ErrorBoundary';
import { Shell } from './Shell';
import '@/styles/foundation.css';

const views = {
  day: () => import('@/features/day/DayView'),
  morning: () => import('@/features/morning/MorningView'),
  plan: () => import('@/features/plan/PlanView'),
  trends: () => import('@/features/progress/ProgressView'),
  journal: () => import('@/features/journal/JournalView'),
  reads: () => import('@/features/reads/ReadsView'),
  settings: () => import('@/features/settings/SettingsView'),
  welcome: () => import('@/features/onboarding/Welcome'),
};
const DayView = lazy(lazyImport(views.day));
const MorningView = lazy(lazyImport(views.morning));
const PlanView = lazy(lazyImport(views.plan));
const TrendsView = lazy(lazyImport(views.trends));
const JournalView = lazy(lazyImport(views.journal));
const ReadsView = lazy(lazyImport(views.reads));
const SettingsView = lazy(lazyImport(views.settings));
const Welcome = lazy(lazyImport(views.welcome));
// the living gallery of the foundation: not in the tab bar, not prefetched
const UiGallery = lazy(lazyImport(() => import('./dev/UiGallery')));

/** Once the first screen is up, pull every other view in the idle gaps so a tab switch never waits on the network. */
const prefetchViews = () => {
  const run = () => {
    for (const load of Object.values(views)) void load().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
};

/** The log is opening: the shape of a tab page in grey blocks, no spinner, no words on screen. */
const Boot = () => (
  <div className="page">
    <SkeletonPage label="Opening your log" />
  </div>
);
/** A view chunk still arriving: hold the canvas, say nothing. The page fade covers the hand-off. */
const Quiet = () => <div className="page" style={{ minHeight: '100dvh' }} aria-busy="true" />;

/**
 * How a page arrives, keyed by section so it happens once per section change. A tab page is an instant cut with a 120ms
 * opacity fade (CSS only, so a view that suspends can never be left invisible). A pushed page slides in on its own
 * (PushedPage), so it gets no fade. Lives inside Suspense: the old page stays up until the next one can paint.
 */
const PageFade = ({ children }: { children: React.ReactNode }) => {
  const loc = useLocation();
  const info = routeInfo(loc.pathname);
  return (
    <div key={info.section} className={info.pushed ? 'page-pushed' : 'page-enter'}>
      {children}
    </div>
  );
};

const Framed = () => (
  <Shell>
    <ErrorBoundary>
      <Suspense fallback={<Quiet />}>
        <PageFade>
          <Routes>
            <Route path="/today/:date?" element={<DayView />} />
            <Route path="/plan/:view?/:date?" element={<PlanView />} />
            <Route path="/progress" element={<TrendsView />} />
            <Route path="/trends" element={<Navigate to="/progress" replace />} />
            <Route path="/journal/:tab?" element={<JournalView />} />
            <Route
              path="/morning/:date?"
              element={
                <PushedPage>
                  <MorningView />
                </PushedPage>
              }
            />
            <Route
              path="/reads/:tab?"
              element={
                <PushedPage>
                  <ReadsView />
                </PushedPage>
              }
            />
            <Route
              path="/settings/:section?"
              element={
                <PushedPage>
                  <SettingsView />
                </PushedPage>
              }
            />
            <Route
              path="/dev/ui"
              element={
                <PushedPage>
                  <UiGallery />
                </PushedPage>
              }
            />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </PageFade>
      </Suspense>
    </ErrorBoundary>
  </Shell>
);

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
    <Routes>
      {/* first run is full screen: no tab bar */}
      <Route
        path="/welcome/*"
        element={
          <ErrorBoundary>
            <Suspense fallback={<Quiet />}>
              <Welcome />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<Framed />} />
    </Routes>
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
    <ContextMenuProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Authed />} />
      </Routes>
    </ContextMenuProvider>
  );
};
