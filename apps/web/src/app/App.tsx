import { useIsRestoring, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { api, ApiError, onUnauthorized } from '@/api/client';
import type { AuthStatus } from '@/api/types';
import { onDeepLink, hideSplash } from '@/lib/native';
import { startServiceWorker } from '@/lib/sw';
import { outbox } from '@/api/outbox';
import { prefetchAll, stravaSyncNow, useBootstrap } from '@/api/queries';
import { Login, Signup } from '@/features/auth/AuthScreens';
import DayView from '@/features/day/DayView';
import { hasAccountHere, markHasAccount, signedOutHome } from '@/features/auth/flag';
import { Start } from '@/features/auth/Start';
import { matchRoute, type PushedEntry } from '@/ui/nav';
import { watchDynamicType } from './dynamicType';
import { ErrorBoundary, lazyImport } from './ErrorBoundary';
import { useNav } from './NavController';
import { RouterBridge } from './RouterBridge';
import { Shell } from './Shell';
import '@/styles/foundation.css';

// Today is in the entry bundle (imported above), not a chunk: the first screen never waits on a module request (WP5). The
// other views arrive as chunks, prefetched once the first screen is up.
const views = {
  morning: () => import('@/features/morning/MorningView'),
  plan: () => import('@/features/plan/PlanView'),
  progress: () => import('@/features/progress/ProgressView'),
  journal: () => import('@/features/journal/JournalView'),
  reads: () => import('@/features/reads/ReadsView'),
  settings: () => import('@/features/settings/SettingsView'),
  settingsSection: () => import('@/features/settings/SettingsSection'),
  plans: () => import('@/features/plan/PlansPage'),
  welcome: () => import('@/features/onboarding/Welcome'),
  gallery: () => import('./dev/UiGallery'),
};

/**
 * A lazy view that renders at once when its chunk is already here: React.lazy suspends on its first render even for a
 * module the browser has, so once `preload` has the module the view is the module's own component. Which one a mounted view
 * uses is fixed when it mounts, so a view never remounts when its chunk lands.
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
const MorningView = view(views.morning);
const PlanView = view(views.plan);
const ProgressView = view(views.progress);
const JournalView = view(views.journal);
const ReadsView = view(views.reads);
const SettingsView = view(views.settings);
const SettingsSection = view(views.settingsSection);
const PlansPage = view(views.plans);
const Welcome = view(views.welcome);
const UiGallery = view(views.gallery);

/** Once the first screen is up: the pushed pages first (a first push never waits), then every other view in idle. */
const prefetchViews = () => {
  const pushed = () => {
    for (const v of [MorningView, SettingsView, SettingsSection, ReadsView]) void v.preload().catch(() => undefined);
  };
  requestAnimationFrame(() => setTimeout(pushed, 0));
  const run = () => {
    for (const v of [PlanView, ProgressView, JournalView, Welcome, PlansPage]) void v.preload().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
};

/**
 * Test builds only (VITE_FAKE_CLOCK): `?stubs=1` on the first load swaps the four roots and /dev/ui for the stubs the WP1
 * acceptance scripts drive. Statically false in a normal build, so the stubs never ship.
 */
const STUBS = (() => {
  if (!import.meta.env.VITE_FAKE_CLOCK) return false;
  try {
    if (new URLSearchParams(location.search).has('stubs')) sessionStorage.setItem('logbook.stubs', '1');
    return sessionStorage.getItem('logbook.stubs') === '1';
  } catch {
    return false;
  }
})();
const StubRoot = lazy(() => import('./dev/StubRoots').then((m) => ({ default: m.StubRoot })));
const StubPushed = lazy(() => import('./dev/StubRoots').then((m) => ({ default: m.StubPushed })));
const pages = STUBS
  ? { today: <StubRoot tab="today" />, plan: <StubRoot tab="plan" />, progress: <StubRoot tab="progress" />, journal: <StubRoot tab="journal" /> }
  : {
      today: <DayView />,
      plan: <PlanView />,
      progress: <ProgressView />,
      journal: <JournalView />,
    };
/** The pushed page for an entry: a switch on its route (contracts §A.3). */
const pushedFor = (e: PushedEntry) => {
  const pattern = matchRoute(e.path).route?.pattern;
  if (pattern === '/today/:date/morning') return <MorningView />;
  if (pattern === '/settings/:section' && e.params.section === 'plans') return <PlansPage />;
  if (pattern === '/settings/:section') return <SettingsSection />;
  if (pattern === '/settings') return <SettingsView />;
  if (pattern === '/journal/reads/:tab?') return <ReadsView />;
  if (pattern === '/dev/ui') return STUBS ? <StubPushed /> : <UiGallery />;
  return null;
};

/** The framed app: the controller-driven Shell, and (until WP6 lands) the bridge from old pages' react-router calls. */
const Framed = () => {
  // the splash goes in the rAF of the frame that paints the first content (WP2's DayPage takes this over)
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(hideSplash);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <RouterBridge />
      <Shell pages={pages} pushed={pushedFor} />
    </>
  );
};

/**
 * Is anyone signed in here? Asked quietly (GET /auth/status answers 200 either way) before the bootstrap on a cold open with
 * nothing cached, so a signed-out visitor goes to /start or /login without a 401 in the console.
 */
const useSession = () => useQuery({ queryKey: ['auth-session'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: Infinity, gcTime: 0, retry: (n, e) => n < 2 && !(e instanceof ApiError) });

const Authed = () => {
  const qc = useQueryClient();
  const restoring = useIsRestoring();
  const session = useSession();
  const signedOut = session.data?.signedIn === false;
  const known = session.isError || (!!session.data && !signedOut);
  // a device that has signed in here goes straight to the bootstrap and paints from the cache meanwhile (WP5)
  const [hadAccount] = useState(hasAccountHere);
  const boot = useBootstrap({ enabled: known || hadAccount });
  const loc = useLocation();
  useEffect(() => {
    if (signedOut) qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth-session' });
  }, [signedOut, qc]);
  // once per session, on the first bootstrap (keyed on whether there is one, never on its identity, critic C1)
  const started = useRef(false);
  const hasBoot = !!boot.data;
  useEffect(() => {
    if (!hasBoot || started.current) return;
    started.current = true;
    markHasAccount();
    void outbox.replay(qc);
    prefetchViews();
    void prefetchAll(qc);
    // a cold open with nothing cached: the Strava check follows the first bootstrap (stravaSyncNow keeps one per 30 s)
    if (qc.getQueryData<{ strava?: { connected?: boolean } }>(['bootstrap'])?.strava?.connected) void stravaSyncNow(qc).catch(() => undefined);
    requestAnimationFrame(() => setTimeout(startServiceWorker, 0));
  }, [hasBoot, qc]);
  if (signedOut) return <Navigate to={signedOutHome()} replace />;
  // the persisted cache is being read (a few ms): hold the black canvas
  if (restoring) return null;
  if (!boot.data && !hadAccount && !known) return <Navigate to="/start" replace />;
  // nothing cached yet: the black canvas until the bootstrap answers (no skeleton page)
  if (!boot.data && boot.isPending) return null;
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
      {/* first run is full screen (react-router's; NavController sleeps there): no tab bar */}
      <Route
        path="/welcome/*"
        element={
          <ErrorBoundary>
            <Suspense fallback={null}>
              <Welcome />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<Framed />} />
    </Routes>
  );
};

/**
 * Sign-up ends on first run: its view is preloaded while the form is up, so the first question is drawn on the frame the
 * form leaves (React.lazy suspends once even for a loaded module; `view()` renders the module's own component once
 * `preload` has it: WP6 request 15).
 */
const SignupRoute = () => {
  useEffect(() => void Welcome.preload().catch(() => undefined), []);
  return <Signup />;
};

/** onDeepLink → nav.go (a deep link on a running app is a jump). Lives under NavController. */
const DeepLinks = () => {
  const nav = useNav();
  const go = useRef(nav.go);
  go.current = nav.go;
  useEffect(() => {
    void onDeepLink((p) => go.current(p));
  }, []);
  return null;
};

export const App = () => {
  const navigate = useNavigate();
  // the type scale follows the iOS text size
  useEffect(() => watchDynamicType(), []);
  // a 401 anywhere sends you to sign in, without reloading the page
  useEffect(() => {
    const fn = () => {
      if (!/^\/(login|setup|signup|start)/.test(location.pathname)) navigate(signedOutHome(), { replace: true });
    };
    onUnauthorized.add(fn);
    return () => {
      onUnauthorized.delete(fn);
    };
  }, [navigate]);
  return (
    <>
      <DeepLinks />
      <Routes>
        <Route path="/start" element={<Start />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignupRoute />} />
        <Route path="/setup" element={<Navigate to="/signup" replace />} />
        <Route path="*" element={<Authed />} />
      </Routes>
    </>
  );
};
