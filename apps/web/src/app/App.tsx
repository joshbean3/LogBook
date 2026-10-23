import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { api, ApiError, onUnauthorized } from '@/api/client';
import type { AuthStatus } from '@/api/types';
import { onDeepLink } from '@/lib/native';
import { startServiceWorker } from '@/lib/sw';
import { outbox } from '@/api/outbox';
import { prefetchAll, useBootstrap } from '@/api/queries';
import { Login, Signup } from '@/features/auth/AuthScreens';
import { markHasAccount, signedOutHome } from '@/features/auth/flag';
import { Start } from '@/features/auth/Start';
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

/**
 * A lazy view that renders at once when its chunk is already here. React.lazy suspends on its first render even for a
 * module the browser has, and a pushed page that suspends shows the black fallback for a frame (critic N9); so once
 * `preload` has the module, the view is the module's own component, with nothing to wait for. Which one a mounted view uses
 * is fixed when it mounts, so a view never remounts when its chunk lands.
 */
const view = <P extends object>(load: () => Promise<{ default: React.ComponentType<P> }>) => {
  let ready: React.ComponentType<P> | null = null;
  let pending: Promise<unknown> | null = null;
  const preload = () =>
    (pending ??= lazyImport(load)().then(
      (m) => {
        ready = m.default;
        return m;
      },
      (e: unknown) => {
        pending = null;
        throw e;
      },
    ));
  const Lazy = lazy(() => preload() as Promise<{ default: React.ComponentType<P> }>);
  const View = (props: P) => {
    const [C] = useState<React.ComponentType<P>>(() => ready ?? (Lazy as unknown as React.ComponentType<P>));
    return <C {...props} />;
  };
  return Object.assign(View, { preload });
};
const DayView = view(views.day);
const MorningView = view(views.morning);
const PlanView = view(views.plan);
const TrendsView = view(views.trends);
const JournalView = view(views.journal);
const ReadsView = view(views.reads);
const SettingsView = view(views.settings);
const Welcome = view(views.welcome);
// the living gallery of the foundation: not in the tab bar, not prefetched
const UiGallery = lazy(lazyImport(() => import('./dev/UiGallery')));

/**
 * Once the first screen is up: the pushed pages (Morning, Reads, Settings) right after its first paint, so the first push
 * never waits on the network or shows a blank frame; then every other view in the idle gaps, so a tab switch never waits.
 */
const prefetchViews = () => {
  const pushed = () => {
    for (const v of [MorningView, ReadsView, SettingsView]) void v.preload().catch(() => undefined);
  };
  // after the frame that paints the first screen
  requestAnimationFrame(() => setTimeout(pushed, 0));
  const run = () => {
    for (const v of [DayView, PlanView, TrendsView, JournalView, Welcome]) void v.preload().catch(() => undefined);
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
            <Route path="/morning/:date?" element={<MorningView />} />
            <Route
              path="/reads/:tab?"
              element={
                <PushedPage>
                  <ReadsView />
                </PushedPage>
              }
            />
            <Route
              path="/settings"
              element={
                <PushedPage key="settings">
                  <SettingsView />
                </PushedPage>
              }
            />
            {/* a sub-section is its own pushed page (it slides in over Settings, and Back lands on Settings) */}
            <Route
              path="/settings/:section"
              element={
                <PushedPage key="settings-section" backTo="/settings">
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

/**
 * Is anyone signed in here? Asked quietly (GET /auth/status answers 200 either way) before the bootstrap on a cold open with
 * nothing cached, so a signed-out visitor goes to /start or /login without a 401 in the console. Never kept: each mount of
 * the signed-in app asks again (sign-in and sign-out happen outside it).
 */
const useSession = () => useQuery({ queryKey: ['auth-session'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: Infinity, gcTime: 0, retry: (n, e) => n < 2 && !(e instanceof ApiError) });

const Authed = () => {
  const qc = useQueryClient();
  const session = useSession();
  // offline (or an older server that does not say): carry on as before, the bootstrap answers
  const signedOut = session.data?.signedIn === false;
  const known = session.isError || (!!session.data && !signedOut);
  const boot = useBootstrap({ enabled: known });
  const loc = useLocation();
  useEffect(() => {
    // a session that ended while the app was away: what the cache remembers is someone else's now
    if (signedOut) qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth-session' });
  }, [signedOut, qc]);
  useEffect(() => {
    if (boot.data) {
      markHasAccount();
      void outbox.replay(qc);
      prefetchViews();
      void prefetchAll(qc);
      // after the frame that paints the first screen
      requestAnimationFrame(() => setTimeout(startServiceWorker, 0));
    }
  }, [boot.data, qc]);
  if (signedOut) return <Navigate to={signedOutHome()} replace />;
  if (!boot.data && (!known || boot.isPending)) return <Boot />;
  if (boot.error && !boot.data) {
    const status = (boot.error as { status?: number }).status;
    if (status === 401) return <Navigate to={signedOutHome()} replace />;
    return (
      <div className="page">
        <p className="empty">Couldn’t connect. Check your connection.</p>
      </div>
    );
  }
  // a new account goes through first run before anything else (the owner's onboardedAt is set, so it never does)
  if (boot.data?.user.onboardedAt === null && !loc.pathname.startsWith('/welcome')) return <Navigate to="/welcome" replace />;
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
      if (!/^\/(login|setup|signup|start)/.test(location.pathname)) nav(signedOutHome(), { replace: true });
    };
    onUnauthorized.add(fn);
    return () => {
      onUnauthorized.delete(fn);
    };
  }, [nav]);
  return (
    <Routes>
      <Route path="/start" element={<Start />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/setup" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Authed />} />
    </Routes>
  );
};
