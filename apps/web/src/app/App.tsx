import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { onUnauthorized } from '@/api/client';
import { outbox } from '@/api/outbox';
import { useBootstrap } from '@/api/queries';
import { Login, Setup } from '@/features/auth/AuthScreens';
import { Loading } from '@/ui/primitives';
import { Shell } from './Shell';

const DayView = lazy(() => import('@/features/day/DayView'));
const MorningView = lazy(() => import('@/features/morning/MorningView'));
const PlanView = lazy(() => import('@/features/plan/PlanView'));
const TrendsView = lazy(() => import('@/features/trends/TrendsView'));
const JournalView = lazy(() => import('@/features/journal/JournalView'));
const SettingsView = lazy(() => import('@/features/settings/SettingsView'));

const Boot = () => (
  <div className="page" style={{ minHeight: '60dvh', alignContent: 'center', justifyItems: 'center' }}>
    <Loading text="Opening your log…" />
  </div>
);

const Authed = () => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  useEffect(() => {
    if (boot.data) void outbox.replay(qc);
  }, [boot.data, qc]);
  if (boot.isPending && !boot.data) return <Boot />;
  if (boot.error && !boot.data) {
    const status = (boot.error as { status?: number }).status;
    if (status === 401) return <Navigate to="/login" replace />;
    return (
      <div className="page">
        <p className="empty">Couldn’t reach the server. {boot.error.message}</p>
      </div>
    );
  }
  return (
    <Shell>
      <Suspense fallback={<Boot />}>
        <Routes>
          <Route path="/today/:date?" element={<DayView />} />
          <Route path="/morning/:date?" element={<MorningView />} />
          <Route path="/plan/:view?/:date?" element={<PlanView />} />
          <Route path="/trends" element={<TrendsView />} />
          <Route path="/journal/:tab?" element={<JournalView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
};

export const App = () => {
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
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
