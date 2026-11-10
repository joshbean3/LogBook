import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchBootstrap, keys } from '@/api/queries';
import type { AuthStatus } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs } from '@/lib/motion';
import { LogoMark } from '@/ui/primitives';
import { clearPendingConsent, readPendingConsent } from './consent';
import { hasAccountHere, markHasAccount } from './flag';
import { useSplashDoneOnPaint } from '@/lib/native';
import './auth.css';

export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: 60_000 });
/** Can this visitor make an account? `signupOpen` from the API, or the older `setupOpen`. */
const canSignUp = (s: AuthStatus | undefined) => !!s && (s.signupOpen ?? s.setupOpen);

/**
 * The black screen with the halo rising from the bottom (once, as the screen arrives). With no title it is the quiet
 * stand-in while the status arrives: no spinner, nothing moves.
 */
const Frame = ({ title, sub, children, foot, back }: { title?: string; sub?: string; children?: React.ReactNode; foot?: React.ReactNode; back?: () => void }) => {
  const reduce = useReducedMotion();
  // from the promise (/start): the same lit surface, so the halo holds still and only the form rises
  const fromStart = (useLocation().state as { from?: string } | null)?.from === 'start';
  return (
    <div className="auth" aria-busy={title ? undefined : true}>
      <span className={`auth-halo ${title && !fromStart ? 'rise' : ''}`} aria-hidden="true" />
      {title ? (
        <motion.div className="auth-body" initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromStart ? 40 : 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : springs.page}>
          {back ? (
            <button type="button" className="icon-btn auth-back" aria-label="Back" onClick={back}>
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <div className="auth-brand">
              <LogoMark size={24} color="var(--ink)" />
              <span className="caps">Logbook</span>
            </div>
          )}
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
      <label className="auth-label" htmlFor={id}>
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

/** Is there an entry of ours to go back to? (react-router keeps its index in history.state) */
export const canGoBack = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

type Errors = { email?: string | null; password?: string | null; form?: string | null };
/** The keyboard's "next" on a field: move to the next one (never the form's implicit submission, flows 1.1). */
const nextOn = (next: React.RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  next.current?.focus();
};

export const Login = () => {
  useSplashDoneOnPaint();
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
        <div className="card auth-fields">
        <AuthField inputRef={emailRef} label="Email" type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" autoFocus={!handed} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={nextOn(pwRef)} error={err.email} />
        <AuthField inputRef={pwRef} label="Password" type="password" name="password" autoComplete="current-password" enterKeyHint="go" reveal autoFocus={!!handed} value={pw} onChange={(e) => setPw(e.target.value)} error={err.password} />
        </div>
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={busy || !!emailProblem(email) || !pw}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Frame>
  );
};

/**
 * Sign-up, one question per screen (inspiration §2.9, §6 Onboarding): the email, then a password, each with the question as
 * the title and its button grey until the answer is valid. The privacy page comes first: the choice it made waits on this
 * device and goes with the new account (a visitor who arrives here without it is sent to make it). The password step keeps
 * the email in a hidden username field, so a password manager saves the pair.
 */
export const Signup = () => {
  useSplashDoneOnPaint();
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<Errors>({});
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const created = useRef(false);
  const [consent] = useState(readPendingConsent);
  const refs = { email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) };
  // after Create account the cache is cleared under the form (its status query goes pending): the form stays until it leaves
  if (status.isPending && !created.current) return <Frame />;
  if (status.data && !canSignUp(status.data) && !created.current) return <Navigate to="/login" replace />;
  // the privacy page comes before any account
  if (!consent && !created.current) return <Navigate to="/start" replace state={{ step: 'privacy' }} />;
  const emailOk = !emailProblem(email);
  const pwOk = pw.length >= 8;
  const toPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOk) return;
    setErr({});
    setTaken(false);
    setStep('password');
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOk || !pwOk || busy) return;
    setBusy(true);
    try {
      await api('/auth/signup', { method: 'POST', json: { email: email.trim(), password: pw, ...(consent ? { consent } : {}) } });
      created.current = true;
      clearPendingConsent();
      markHasAccount();
      // The form stays (busy) until the first question can replace it in one commit (flows 1.2): the new account's
      // bootstrap and the first-run module are fetched first, then the cache is swapped on the navigation's tick.
      const [boot] = await Promise.all([fetchBootstrap().catch(() => null), import('@/features/onboarding/Welcome').catch(() => null)]);
      qc.clear();
      if (boot) qc.setQueryData(keys.bootstrap, boot);
      nav('/welcome/goal', { replace: true });
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.status === 409) {
        setTaken(true);
        setStep('email');
        setErr({ email: 'There’s already an account with that email.' });
      } else if (e2 instanceof ApiError && e2.status === 403) setErr({ form: 'New accounts are closed here. Sign in instead.' });
      else if (e2 instanceof ApiError && e2.status === 422) {
        setStep('email');
        setErr({ email: 'Check the email address and try again.' });
      } else setErr({ form: plain(e2, 'Couldn’t create the account. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  const foot = (
    <p className="auth-switch">
      Have an account?{' '}
      <Link to="/login" replace className="auth-link">
        Sign in
      </Link>
    </p>
  );
  if (step === 'email')
    return (
      <Frame key="email" title="What’s your email?" sub="You sign in with it. It’s never shared." back={() => (canGoBack() ? nav(-1) : nav('/start', { replace: true, state: { step: 'privacy' } }))} foot={foot}>
        <form className="auth-form" onSubmit={toPassword} noValidate>
          <div className="card auth-fields">
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
              setTaken(false);
            }}
            error={err.email}
          />
          </div>
          {taken ? (
            <Link to="/login" replace state={{ email: email.trim() }} className="btn soft block auth-taken">
              Sign in with that email
            </Link>
          ) : null}
          <button type="submit" className="btn primary block auth-submit" disabled={!emailOk}>
            Next
          </button>
        </form>
      </Frame>
    );
  return (
    <Frame key="password" title="Choose a password." sub={`For ${email.trim()}.`} back={() => setStep('email')} foot={foot}>
      <form className="auth-form" onSubmit={submit} noValidate>
        {/* the pair, for a password manager: the email stays in the form, out of sight */}
        <input type="email" name="email" autoComplete="username" value={email.trim()} readOnly hidden />
        <div className="card auth-fields">
        <AuthField
          inputRef={refs.password}
          label="Password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          enterKeyHint="go"
          autoFocus
          reveal
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (err.form) setErr((x) => ({ ...x, form: null }));
          }}
          hint={pwOk ? 'Good.' : pw ? `${8 - pw.length} more ${8 - pw.length === 1 ? 'character' : 'characters'}.` : 'At least 8 characters.'}
        />
        </div>
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={!pwOk || busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </Frame>
  );
};

/** v1 name: /setup is sign-up now. */
export const Setup = Signup;
