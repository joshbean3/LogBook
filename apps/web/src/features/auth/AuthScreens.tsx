import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError, NetworkError } from '@/api/client';
import type { AuthStatus } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs } from '@/lib/motion';
import { LogoMark } from '@/ui/primitives';
import { hasAccountHere, markHasAccount } from './flag';
import './auth.css';

export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: 60_000 });
/** Can this visitor make an account? `signupOpen` from the API, or the older `setupOpen`. */
const canSignUp = (s: AuthStatus | undefined) => !!s && (s.signupOpen ?? s.setupOpen);

/**
 * The black screen with the halo rising from the bottom (once, as the screen arrives). With no title it is the quiet
 * stand-in while the status arrives: no spinner, nothing moves.
 */
const Frame = ({ title, sub, children, foot }: { title?: string; sub?: string; children?: React.ReactNode; foot?: React.ReactNode }) => {
  const reduce = useReducedMotion();
  return (
    <div className="auth" aria-busy={title ? undefined : true}>
      <span className={`auth-halo ${title ? 'rise' : ''}`} aria-hidden="true" />
      {title ? (
        <motion.div className="auth-body" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : springs.page}>
          <div className="auth-brand">
            <LogoMark size={24} color="#fff" />
            <span className="caps">Logbook</span>
          </div>
          <h1 className="auth-title display">{title}</h1>
          <p className="auth-sub">{sub}</p>
          {children}
          {foot ? <div className="auth-foot">{foot}</div> : null}
        </motion.div>
      ) : null}
    </div>
  );
};

/** A dark field with its caps label, an inline error in plain words under it, and (for passwords) a Show button. */
const AuthField = ({
  label,
  error,
  hint,
  type = 'text',
  reveal,
  inputRef,
  ...input
}: { label: string; error?: string | null; hint?: string; reveal?: boolean; inputRef?: React.Ref<HTMLInputElement> } & React.InputHTMLAttributes<HTMLInputElement>) => {
  const id = useId();
  const [shown, setShown] = useState(false);
  const msg = error || hint;
  return (
    <div className={`auth-field ${error ? 'bad' : ''}`}>
      <label className="auth-label caps" htmlFor={id}>
        {label}
      </label>
      <div className="auth-in-wrap">
        <input ref={inputRef} id={id} className="in auth-in" type={reveal && shown ? 'text' : type} aria-invalid={error ? true : undefined} aria-describedby={msg ? `${id}-msg` : undefined} {...input} />
        {reveal ? (
          <button type="button" className="auth-eye" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {msg ? (
        <p id={`${id}-msg`} className={error ? 'auth-err' : 'auth-hint'} role={error ? 'alert' : undefined}>
          {msg}
        </p>
      ) : null}
    </div>
  );
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailProblem = (v: string) => (!v.trim() ? 'Enter your email address.' : !EMAIL.test(v.trim()) ? 'That doesn’t look like an email address.' : null);
/** Any failure in plain words, never a status code. */
const plain = (e: unknown, fallback: string) =>
  e instanceof NetworkError ? 'Couldn’t reach Logbook. Check your connection and try again.' : e instanceof ApiError && e.status === 429 ? 'Too many tries. Wait a minute, then try again.' : e instanceof ApiError && e.status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : fallback;

type Errors = { email?: string | null; password?: string | null; form?: string | null };
/** The keyboard's "next" on a field: move to the next one (never the form's implicit submission, flows 1.1). */
const nextOn = (next: React.RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  next.current?.focus();
};

export const Login = () => {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  // from sign-up's "Sign in with that email": the address comes along
  const handed = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(handed);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [returning] = useState(hasAccountHere);
  if (status.isPending) return <Frame />;
  if (status.data && !status.data.hasAccount && canSignUp(status.data)) return <Navigate to="/signup" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = { email: emailProblem(email), password: pw ? null : 'Enter your password.' };
    setErr(next);
    if (next.email || next.password) {
      (next.email ? emailRef : pwRef).current?.focus();
      return;
    }
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', json: { email: email.trim(), password: pw } });
      markHasAccount();
      // a different account may have signed in on this device: nothing of the last one stays in the cache
      qc.clear();
      nav('/today', { replace: true });
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.status === 401) {
        setErr({ password: 'That email and password don’t match. Try again.' });
        pwRef.current?.select();
      } else setErr({ form: plain(e2, 'Couldn’t sign in. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      // "Welcome back" only on a device that has signed in before: a new person never reads it (critic B7)
      title={returning ? 'Welcome back.' : 'Sign in.'}
      sub="Open your log."
      foot={
        canSignUp(status.data) ? (
          <p className="auth-switch">
            New to Logbook?{' '}
            <Link to="/signup" replace className="auth-link">
              Create an account
            </Link>
          </p>
        ) : null
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField inputRef={emailRef} label="Email" type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" autoFocus={!handed} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={nextOn(pwRef)} error={err.email} />
        <AuthField inputRef={pwRef} label="Password" type="password" name="password" autoComplete="current-password" enterKeyHint="go" reveal autoFocus={!!handed} value={pw} onChange={(e) => setPw(e.target.value)} error={err.password} />
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Frame>
  );
};

export const Signup = () => {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<Errors>({});
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const created = useRef(false);
  const refs = { email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) };
  if (status.isPending) return <Frame />;
  if (status.data && !canSignUp(status.data) && !created.current) return <Navigate to="/login" replace />;
  const pwProblem = (v: string) => (!v ? 'Choose a password.' : v.length < 8 ? 'Use at least 8 characters.' : null);
  // two fields, Show instead of a confirm field (the iOS convention), checked only here, on the final Go (flows 1.1)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = { email: emailProblem(email), password: pwProblem(pw) };
    setErr(next);
    setTaken(false);
    const first = (['email', 'password'] as const).find((k) => next[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setBusy(true);
    try {
      await api('/auth/signup', { method: 'POST', json: { email: email.trim(), password: pw } });
      created.current = true;
      markHasAccount();
      qc.clear();
      // the promise came before the account (/start): straight on to the first question
      nav('/welcome/goal', { replace: true });
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.status === 409) {
        setTaken(true);
        setErr({ email: 'There’s already an account with that email.' });
        refs.email.current?.focus();
      } else if (e2 instanceof ApiError && e2.status === 403) setErr({ form: 'New accounts are closed here. Sign in instead.' });
      else if (e2 instanceof ApiError && e2.status === 422) setErr({ form: 'Check the email address and try again.' });
      else setErr({ form: plain(e2, 'Couldn’t create the account. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      title="Make it yours."
      sub="So your plan is here tomorrow."
      foot={
        <p className="auth-switch">
          Have an account?{' '}
          <Link to="/login" replace className="auth-link">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          inputRef={refs.email}
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (err.email) setErr((x) => ({ ...x, email: null }));
          }}
          onKeyDown={nextOn(refs.password)}
          error={err.email}
        />
        {taken ? (
          <Link to="/login" replace state={{ email: email.trim() }} className="btn soft block auth-taken">
            Sign in with that email
          </Link>
        ) : null}
        <AuthField
          inputRef={refs.password}
          label="Password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          enterKeyHint="go"
          reveal
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (err.password) setErr((x) => ({ ...x, password: null }));
          }}
          error={err.password}
          hint="At least 8 characters."
        />
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </Frame>
  );
};

/** v1 name: /setup is sign-up now. */
export const Setup = Signup;
