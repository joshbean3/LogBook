import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchBootstrap, keys } from '@/api/queries';
import type { AuthStatus } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { isNative, useSplashDoneOnPaint } from '@/lib/native';
import { fadeIn, springs } from '@/lib/motion';
import { LogoMark } from '@/ui/primitives';
import { MIN_AGE } from '@/lib/copy';
import { LEGAL, openExternal, SUPPORT } from '@/lib/siteLinks';
import { clearPendingConsent, consentForSignup, readPendingChoice } from './consent';
import { hasAccountHere, markHasAccount } from './flag';
import './auth.css';

export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api<AuthStatus>('/auth/status'), staleTime: 60_000 });
/** Can this visitor make an account? `signupOpen` from the API, or the older `setupOpen`. */
const canSignUp = (s: AuthStatus | undefined) => !!s && (s.signupOpen ?? s.setupOpen);

/** A quiet text link to a public page (the policy, the terms, the support page), opened in the in-app browser. */
export const SiteLink = ({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) => (
  <a
    href={href}
    className={`site-link ${className}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => {
      e.preventDefault();
      void openExternal(href);
    }}
  >
    {children}
  </a>
);

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
          {/* the way to the support page for someone who cannot get in */}
          <SiteLink href={SUPPORT} className="auth-help">
            Help
          </SiteLink>
          <h1 className="auth-title display">{title}</h1>
          {sub ? <p className="auth-sub">{sub}</p> : null}
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

/**
 * /login, three ways (one route, so the reset mail's link and the keychain both land on it):
 *
 *   /login                    sign in, with "Forgot password?" under the fields
 *   Forgot password?          the email, then "If that address has an account, a reset link is on its way."
 *   /login?reset=<token>      the link from that mail: choose a new password, then sign in with it
 */
export const Login = () => {
  useSplashDoneOnPaint();
  const loc = useLocation();
  const token = new URLSearchParams(loc.search).get('reset');
  const nav = useNavigate();
  // from sign-up's "Sign in with that email": the address comes along
  const [email, setEmail] = useState((loc.state as { email?: string } | null)?.email ?? '');
  const [forgot, setForgot] = useState(false);
  // leaving the reset screens drops the token from the address: to sign in, or (an expired link) to ask for a new one
  const leaveReset = (toForgot: boolean) => {
    setForgot(toForgot);
    nav('/login', { replace: true });
  };
  if (token) return <Reset token={token} onLeave={leaveReset} />;
  return forgot ? <Forgot email={email} onEmail={setEmail} onBack={() => setForgot(false)} /> : <SignIn email={email} onEmail={setEmail} onForgot={() => setForgot(true)} />;
};

const SignIn = ({ email, onEmail: setEmail, onForgot }: { email: string; onEmail: (v: string) => void; onForgot: () => void }) => {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  // an address that came along (from sign-up, or back from the forgot step): the cursor starts in the password
  const [handed] = useState(email);
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
        <button type="button" className="auth-forgot" onClick={onForgot}>
          Forgot password?
        </button>
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
 * Forgot password: the email, then one answer whatever the address (the server never says whether an account exists).
 * The mail's link opens /login?reset=<token>.
 */
const Forgot = ({ email, onEmail, onBack }: { email: string; onEmail: (v: string) => void; onBack: () => void }) => {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Errors>({});
  const ref = useRef<HTMLInputElement>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = emailProblem(email);
    if (problem) {
      setErr({ email: problem });
      ref.current?.focus();
      return;
    }
    if (busy) return;
    setBusy(true);
    setErr({});
    try {
      await api('/auth/forgot', { method: 'POST', json: { email: email.trim() } });
      setSent(true);
    } catch (e2) {
      haptics.error();
      setErr({ form: plain(e2, 'Couldn’t send the link. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  if (sent)
    return (
      <Frame key="sent" title="Check your email." sub="If that address has an account, a reset link is on its way." back={onBack}>
        <div className="auth-form">
          <p className="auth-note">Open the link to choose a new password. Nothing after a few minutes? Check your spam folder, and that {email.trim()} is the address you signed up with.</p>
          <button type="button" className="btn primary block auth-submit" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      </Frame>
    );
  return (
    <Frame key="forgot" title="Forgot your password?" sub="Enter your email and we’ll send a link to choose a new one." back={onBack}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="card auth-fields">
          <AuthField
            inputRef={ref}
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus
            value={email}
            onChange={(e) => {
              onEmail(e.target.value);
              if (err.email) setErr({});
            }}
            error={err.email}
          />
        </div>
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={busy || !!emailProblem(email)}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </Frame>
  );
};

/**
 * The link from the reset mail (/login?reset=<token>): a new password. The link opens in the browser, so on the web the
 * last screen sends the person back to the app. A used or expired link offers a new one.
 */
const Reset = ({ token, onLeave }: { token: string; onLeave: (toForgot: boolean) => void }) => {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>('form');
  const pwOk = pw.length >= 8;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwOk || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/reset', { method: 'POST', json: { token, password: pw } });
      setState('done');
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && (e2.code === 'reset_invalid' || e2.status === 400)) setState('invalid');
      else if (e2 instanceof ApiError && e2.status === 422) setErr('Use 8 to 200 characters.');
      else setErr(plain(e2, 'Couldn’t change the password. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  if (state === 'done')
    return (
      <Frame key="done" title="Password changed." sub="Open Logbook and sign in.">
        <div className="auth-form">
          <p className="auth-note">Every device was signed out. Use the new password from now on.</p>
          <button type="button" className="btn primary block auth-submit" onClick={() => onLeave(false)}>
            {isNative ? 'Sign in' : 'Sign in here'}
          </button>
        </div>
      </Frame>
    );
  if (state === 'invalid')
    return (
      <Frame key="invalid" title="That link has expired." sub="A reset link works once, for a short time. Ask for a new one.">
        <div className="auth-form">
          <button type="button" className="btn primary block auth-submit" onClick={() => onLeave(true)}>
            Send a new link
          </button>
        </div>
      </Frame>
    );
  return (
    <Frame key="reset" title="Choose a new password." sub="You sign in with it from now on.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="card auth-fields">
          <AuthField
            label="New password"
            type="password"
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="go"
            autoFocus
            reveal
            maxLength={200}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err) setErr(null);
            }}
            hint={pwOk ? 'OK.' : pw ? `${8 - pw.length} more ${8 - pw.length === 1 ? 'character' : 'characters'}.` : 'At least 8 characters.'}
          />
        </div>
        {err ? (
          <p className="auth-err form" role="alert">
            {err}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={!pwOk || busy}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </Frame>
  );
};

/**
 * Sign-up, one question per screen (inspiration §2.9, §6 Onboarding): the email, then a password, each with the question as
 * the title and its button grey until the answer is valid. The privacy page comes first: the answer given there waits on this
 * device and goes with the new account (a visitor who arrives here without one is sent to give it). The password step keeps
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
  // the answer from the privacy page: Allow goes with the new account, Not now sends nothing
  const [choice] = useState(readPendingChoice);
  const refs = { email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) };
  // after Create account the cache is cleared under the form (its status query goes pending): the form stays until it leaves
  if (status.isPending && !created.current) return <Frame />;
  if (status.data && !canSignUp(status.data) && !created.current) return <Navigate to="/login" replace />;
  // the privacy page comes before any account
  if (!choice && !created.current) return <Navigate to="/start" replace state={{ step: 'privacy' }} />;
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
      const consent = consentForSignup(choice);
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
      <Frame key="email" title="What’s your email?" sub="You sign in with it. It is never sold." back={() => (canGoBack() ? nav(-1) : nav('/start', { replace: true, state: { step: 'privacy' } }))} foot={foot}>
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
        <p className="auth-terms">
          By creating an account you agree to the <SiteLink href={LEGAL.terms}>Terms</SiteLink> and <SiteLink href={LEGAL.privacy}>Privacy Policy</SiteLink>. You must be {MIN_AGE} or older.
        </p>
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
