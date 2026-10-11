import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { api, ApiError } from '@/api/client';
import type { AuthStatus } from '@/api/types';
import { Button, Field, Loading, LogoMark, Note } from '@/ui/primitives';
import './auth.css';

export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: 60_000 });

const Frame = ({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) => (
  <div className="auth">
    <motion.div className="auth-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="auth-brand">
        <LogoMark size={22} color="var(--accent)" />
        <span>Logbook</span>
      </div>
      <h1 className="auth-title t-large">{title}</h1>
      <p className="auth-sub t-sub">{sub}</p>
      {children}
    </motion.div>
  </div>
);

export const Login = () => {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (status.isPending) return <Loading />;
  if (status.data && !status.data.hasAccount && status.data.setupOpen) return <Navigate to="/setup" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/login', { method: 'POST', json: { email, password: pw } });
      nav('/today', { replace: true });
      void qc.invalidateQueries();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Couldn’t sign in. Check your connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title="Welcome back." sub="Sign in to open your log.">
      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Password">
          <input className="in" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {err ? <Note kind="bad">{err}</Note> : null}
        <Button variant="primary" block type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Frame>
  );
};

export const Setup = () => {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const created = useRef(false);
  if (status.isPending) return <Loading />;
  if (status.data && !status.data.setupOpen && !created.current) return <Navigate to="/login" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setErr('The two passwords don’t match.');
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/setup', { method: 'POST', json: { email, password: pw } });
      created.current = true;
      nav('/today', { replace: true });
      void qc.invalidateQueries();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Couldn’t create the account.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title="Make it yours." sub="This is a private log. Create the one account that opens it.">
      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Password" hint="At least 8 characters. There is no reset, so keep it somewhere safe.">
          <input className="in" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Again">
          <input className="in" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {err ? <Note kind="bad">{err}</Note> : null}
        <Button variant="primary" block type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create my log'}
        </Button>
      </form>
    </Frame>
  );
};
