import { useIsRestoring, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { api, ApiError, onUnauthorized } from '@/api/client';
import type { AuthStatus } from '@/api/types';
import { clearLocalAccount, isLeaving, isOtherAccount, rememberUser } from '@/lib/account';
import { DEV_TOOLS, STRAVA_BUILT } from '@/lib/features';
import { apiOrigin, isNative, onDeepLink, hideSplash } from '@/lib/native';
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
import { Shell } from './Shell';
import { healthSyncNow } from '@/lib/healthSync';
import '@/styles/foundation.css';

// Today is in the entry bundle (imported above), not a chunk: the first screen never waits on a module request (WP5). The
// other views arrive as chunks, prefetched once the first screen is up.
const views = {
  morning: () => import('@/features/morning/MorningView'),
  goals: () => import('@/features/goals/GoalsView'),
  goalHistory: () => import('@/features/goals/GoalHistory'),
  learned: () => import('@/features/learned/LearnedView'),
  learnedMonth: () => import('@/features/learned/LearnedMonth'),
  plan: () => import('@/features/plan/PlanView'),
  progress: () => import('@/features/progress/ProgressView'),
  journal: () => import('@/features/journal/JournalView'),
  reads: () => import('@/features/reads/ReadsView'),
  settings: () => import('@/features/settings/SettingsView'),
  settingsSection: () => import('@/features/settings/SettingsSection'),
  plans: () => import('@/features/plan/PlansPage'),
  welcome: () => import('@/features/onboarding/Welcome'),
  metric: () => import('@/features/progress/MetricPage'),
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
const GoalsView = view(views.goals);
const GoalHistory = view(views.goalHistory);
const LearnedView = view(views.learned);
const LearnedMonth = view(views.learnedMonth);
const PlanView = view(views.plan);
const ProgressView = view(views.progress);
const JournalView = view(views.journal);
const ReadsView = view(views.reads);
const SettingsView = view(views.settings);
const SettingsSection = view(views.settingsSection);
const PlansPage = view(views.plans);
const Welcome = view(views.welcome);
// the component gallery and the test stubs exist only where DEV_TOOLS is true: a release build has no chunk for them
const UiGallery = DEV_TOOLS ? view(() => import('./dev/UiGallery')) : null;
const MetricPage = view(views.metric);

/** Once the first screen is up: the pushed pages first (a first push never waits), then every other view in idle. */
const prefetchViews = () => {
  const pushed = () => {
    for (const v of [MorningView, SettingsView, SettingsSection, ReadsView, LearnedMonth, MetricPage]) void v.preload().catch(() => undefined);
  };
  requestAnimationFrame(() => setTimeout(pushed, 0));
  const run = () => {
    for (const v of [GoalsView, LearnedView, PlanView, ProgressView, JournalView, Welcome, PlansPage, GoalHistory]) void v.preload().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
};

/**
 * Test builds only (VITE_FAKE_CLOCK=1): `?stubs=1` on the first load swaps the six roots and /dev/ui for the stubs the WP1
 * acceptance scripts drive. The build flag is a constant, so in any other build the stubs and their imports are dropped.
 */
const STUBS_BUILT = import.meta.env.VITE_FAKE_CLOCK === '1';
const STUBS =
  STUBS_BUILT &&
  (() => {
    try {
      if (new URLSearchParams(location.search).has('stubs')) sessionStorage.setItem('logbook.stubs', '1');
      return sessionStorage.getItem('logbook.stubs') === '1';
    } catch {
      return false;
    }
  })();
const StubRoot = STUBS_BUILT ? lazy(() => import('./dev/StubRoots').then((m) => ({ default: m.StubRoot }))) : null;
const StubPushed = STUBS_BUILT ? lazy(() => import('./dev/StubRoots').then((m) => ({ default: m.StubPushed }))) : null;
const pages =
  STUBS && StubRoot
    ? { today: <StubRoot tab="today" />, goals: <StubRoot tab="goals" />, learned: <StubRoot tab="learned" />, plan: <StubRoot tab="plan" />, progress: <StubRoot tab="progress" />, journal: <StubRoot tab="journal" /> }
    : {
        today: <DayView />,
        goals: <GoalsView />,
        learned: <LearnedView />,
        plan: <PlanView />,
        progress: <ProgressView />,
        journal: <JournalView />,
      };
/** The pushed page for an entry: a switch on its route (contracts §A.3). */
const pushedFor = (e: PushedEntry) => {
  const pattern = matchRoute(e.path).route?.pattern;
  // This morning: the day's from Today, today's from Habits (MorningView falls back to today without a `date` param)
  if (pattern === '/today/:date/morning' || pattern === '/plan/morning/:date?') return <MorningView />;
  if (pattern === '/goals/history') return <GoalHistory />;
  if (pattern === '/learned/:month') return <LearnedMonth />;
  if (pattern === '/settings/:section' && e.params.section === 'plans') return <PlansPage />;
  if (pattern === '/settings/:section') return <SettingsSection />;
  if (pattern === '/settings') return <SettingsView />;
  if (pattern === '/journal/reads/:tab?') return <ReadsView />;
  if (DEV_TOOLS && pattern === '/dev/ui') return STUBS && StubPushed ? <StubPushed /> : UiGallery ? <UiGallery /> : null;
  if (pattern === '/progress/metric/:id') return <MetricPage />;
  return null;
};

/** The framed app: the controller-driven Shell. Nothing inside it uses react-router (contracts rule 2). */
const Framed = () => {
  // the splash goes in the rAF of the frame that paints the first content: Today's DayPage does it on its own first paint;
  // this covers a cold start on another tab (a deep link to /plan), whose root may mount after Today's (hideSplash is
  // idempotent)
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(hideSplash);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <Shell pages={pages} pushed={pushedFor} />;
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
  /**
   * Whose device copy is this (Contract 2)? The app last ran here for the account in `logbook.user`. When the bootstrap
   * names someone else (a session ran out, then another person signed in), nothing kept here is theirs: it is wiped and the
   * page starts over, still signed in. Otherwise the account is remembered, and what it wrote offline is sent: on the
   * first bootstrap and again whenever the same person signs back in.
   */
  const uid = boot.data?.user.id ?? null;
  const stranger = uid !== null && isOtherAccount(uid);
  useEffect(() => {
    if (!uid) return;
    if (isOtherAccount(uid)) {
      void clearLocalAccount(qc);
      return;
    }
    rememberUser(uid);
    void outbox.replay(qc);
  }, [uid, qc]);
  // once per session, on the first bootstrap (keyed on whether there is one, never on its identity, critic C1)
  const started = useRef(false);
  const hasBoot = !!boot.data && !stranger;
  useEffect(() => {
    if (!hasBoot || started.current) return;
    started.current = true;
    markHasAccount();
    prefetchViews();
    void prefetchAll(qc);
    // a cold open with nothing cached: the run check follows the first bootstrap (stravaSyncNow keeps one per 30 s); only
    // in a build that has the connection (lib/features.ts)
    if (STRAVA_BUILT && qc.getQueryData<{ strava?: { connected?: boolean } }>(['bootstrap'])?.strava?.connected) void stravaSyncNow(qc).catch(() => undefined);
    void healthSyncNow(qc, 'open').catch(() => undefined);
    requestAnimationFrame(() => setTimeout(startServiceWorker, 0));
  }, [hasBoot, qc]);
  // the account is leaving this device (Sign out, Delete account), or what is here belongs to someone else: draw nothing
  // of it while the wipe runs; the page reloads when it is done (lib/account.ts)
  if (isLeaving() || stranger) return null;
  if (signedOut) return <Navigate to={signedOutHome()} replace />;
  // the persisted cache is being read (a few ms): hold the black canvas
  if (restoring) return null;
  if (!boot.data && !hadAccount && !known) return <Navigate to="/start" replace />;
  // nothing cached yet: the black canvas until the bootstrap answers (no skeleton page)
  if (!boot.data && boot.isPending) return null;
  if (boot.error && !boot.data) {
    const status = (boot.error as { status?: number }).status;
    if (status === 401) return <Navigate to={signedOutHome()} replace />;
    // the screen says what failed (the phone has no console): the server it tried, the answer or the error, and a retry
    const err = boot.error as { message?: string; name?: string; code?: string | null };
    const detail = [status ? `HTTP ${status}` : err.name === 'NetworkError' ? 'No answer' : (err.name ?? 'Error'), err.message, err.code ? `(${err.code})` : null].filter(Boolean).join(' · ');
    return (
      <div className="page">
        <p className="empty">Couldn’t connect. Check your connection.</p>
        <p className="t-cap muted" style={{ margin: '8px 0 0', wordBreak: 'break-word' }}>
          {apiOrigin || window.location.origin}
          {' · '}
          {detail}
          {' · '}
          {typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'}
        </p>
        <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={() => void boot.refetch()}>
          Try again
        </button>
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
