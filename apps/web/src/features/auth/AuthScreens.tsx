import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, CircleAlert, Eye, EyeOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchBootstrap, keys } from '@/api/queries';
import type { AuthStatus } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { isNative, useSplashDoneOnPaint } from '@/lib/native';
import { fadeIn, springs } from '@/lib/motion';
import { Lockup } from '@/ui/Brand';
import { MIN_AGE } from '@/lib/copy';
import { LEGAL, openExternal, SUPPORT } from '@/lib/siteLinks';
import { clearPendingConsent, consentForSignup, readPendingChoice } from './consent';
import { hasAccountHere, markHasAccount } from './flag';
import { afterSignIn, emailProblem, isPasswordRefusal, newPasswordProblem, PASSWORD_MAX, passwordRefusal } from './rules';
import './auth.css';

/**
 * Can this visitor sign up, and is there a session? An enhancement on these screens, never a gate (auth-11): the forms draw
 * at once, one try only, and an answer slower than 6 s counts as unknown.
 */
export const useAuthStatus = () =>
  useQuery({
    queryKey: ['auth-status'],
    queryFn: () => Promise.race([api<AuthStatus>('/auth/status'), new Promise<never>((_, no) => setTimeout(() => no(new Error('status timeout')), 6000))]),
    staleTime: 60_000,
    retry: 0,
  });
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
const Frame = ({ title, sub, children, foot, back, busy, notice, question }: { title?: string; sub?: string; children?: React.ReactNode; foot?: React.ReactNode; back?: () => void; /** a request is out: Back waits for it */ busy?: boolean; /** one line above the title (why the person is here) */ notice?: string | null; /** a question step (the email, a password): Fraunces 26, like every question in setup (layout standard 2.11, 4.1) */ question?: boolean }) => {
  const reduce = useReducedMotion();
  // from the promise (/start): the same lit surface, so the halo holds still and only the form rises
  const fromStart = (useLocation().state as { from?: string } | null)?.from === 'start';
  return (
    <main className="auth" aria-busy={title ? undefined : true}>
      <span className={`auth-halo ${title && !fromStart ? 'rise' : ''}`} aria-hidden="true" />
      {title ? (
        <motion.div className="auth-body" initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromStart ? 40 : 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : springs.page}>
          {back ? (
            <button type="button" className="icon-btn auth-back" aria-label="Back" onClick={back} disabled={busy}>
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <div className="auth-brand">
              <Lockup />
            </div>
          )}
          {/* the way to the support page for someone who cannot get in */}
          <SiteLink href={SUPPORT} className="auth-help">
            Help
          </SiteLink>
          {notice ? (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          ) : null}
          <h1 className={`auth-title display ${question ? 'is-question' : ''}`}>{title}</h1>
          {sub ? <p className="auth-sub">{sub}</p> : null}
          {children}
          {foot ? <div className="auth-foot">{foot}</div> : null}
        </motion.div>
      ) : null}
    </main>
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
  hideLabel,
  ...input
}: { label: string; error?: string | null; hint?: string; reveal?: boolean; inputRef?: React.Ref<HTMLInputElement>; /** the step's question already names the field: the label is for VoiceOver only (layout standard 7, say it once) */ hideLabel?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => {
  const id = useId();
  const [shown, setShown] = useState(false);
  const msg = error || hint;
  return (
    <div className={`auth-field ${error ? 'bad' : ''}`}>
      <label className={hideLabel ? 'sr-only' : 'auth-label'} htmlFor={id}>
        {label}
      </label>
      <div className="auth-in-wrap">
        <input ref={inputRef} id={id} className="in auth-in" type={reveal && shown ? 'text' : type} aria-invalid={error ? true : undefined} aria-describedby={msg ? `${id}-msg` : undefined} {...input} />
        {reveal ? (
          <button
            type="button"
            className="auth-eye"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            // the field keeps focus (and the keyboard stays up): the press never moves it to the button
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {msg ? (
        <p id={`${id}-msg`} className={error ? 'auth-err' : 'auth-hint'} role={error ? 'alert' : undefined}>
          {error ? <CircleAlert size={16} aria-hidden="true" /> : null}
          {msg}
        </p>
      ) : null}
    </div>
  );
};

/** Any failure in plain words, never a status code. */
const plain = (e: unknown, fallback: string) =>
  e instanceof NetworkError ? 'Couldn’t reach Orby. Check your connection and try again.' : e instanceof ApiError && e.status === 429 ? 'Too many tries. Wait a minute, then try again.' : e instanceof ApiError && e.status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : fallback;

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
  const state = loc.state as { email?: string; from?: string; signedOut?: boolean } | null;
  // from sign-up's "Sign in with that email": the address comes along
  const [email, setEmail] = useState(state?.email ?? '');
  const [forgot, setForgot] = useState(false);
  // opened from the welcome pager's "I have an account": a way back to it (auth-25)
  const [fromStart] = useState(state?.from === 'start');
  // the session ended on the server (a 401 sent the visitor here): say so once (auth-10)
  const [signedOut] = useState(!!state?.signedOut);
  // the in-app page a 401 sent the visitor away from: signing in goes back to it (Today otherwise)
  const [to] = useState(() => afterSignIn(state?.from));
  // leaving the reset screens drops the token from the address: to sign in, or (an expired link) to ask for a new one
  const leaveReset = (toForgot: boolean) => {
    setForgot(toForgot);
    nav('/login', { replace: true });
  };
  if (token) return <Reset token={token} onLeave={leaveReset} />;
  return forgot ? (
    <Forgot email={email} onEmail={setEmail} onBack={() => setForgot(false)} />
  ) : (
    <SignIn email={email} onEmail={setEmail} onForgot={() => setForgot(true)} to={to} back={fromStart ? () => (canGoBack() ? nav(-1) : nav('/start', { replace: true })) : undefined} notice={signedOut ? 'You were signed out. Sign in to open your log.' : null} />
  );
};

const SignIn = ({ email, onEmail: setEmail, onForgot, back, notice, to = '/today' }: { email: string; onEmail: (v: string) => void; onForgot: () => void; back?: () => void; notice?: string | null; /** where a successful sign-in goes */ to?: string }) => {
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
  // the form draws at once; the status only redirects a server with no account yet to sign-up (auth-11)
  if (status.data && !status.data.hasAccount && canSignUp(status.data)) return <Navigate to="/signup" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // the button is never greyed out: a press with a missing or mistyped answer says what is wrong, at the field (auth-07)
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
      nav(to, { replace: true });
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.status === 401) {
        setErr({ password: 'That email and password don’t match. Try again.' });
        pwRef.current?.select();
      } else if (e2 instanceof ApiError && e2.status === 422) {
        // the server's rule refused the address (auth-19)
        setErr({ email: 'That doesn’t look like an email address.' });
        emailRef.current?.focus();
      } else setErr({ form: plain(e2, 'Couldn’t sign in. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  const ready = !emailProblem(email) && !!pw;
  return (
    <Frame
      // "Welcome back" only on a device that has signed in before: a new person never reads it (critic B7)
      title={returning ? 'Welcome back.' : 'Sign in.'}
      back={back}
      busy={busy}
      notice={notice}
      foot={
        // shown while the answer is unknown too (a slow or failed status): only a server that said no hides it
        !status.data || canSignUp(status.data) ? (
          <p className="auth-switch">
            New to Orby?{' '}
            <Link to="/signup" replace className="auth-link">
              Create an account
            </Link>
          </p>
        ) : null
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-fields">
          <AuthField
            inputRef={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus={!handed}
            maxLength={200}
            readOnly={busy}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (err.email || err.form) setErr((x) => ({ ...x, email: null, form: null }));
            }}
            onKeyDown={nextOn(pwRef)}
            error={err.email}
          />
          <AuthField
            inputRef={pwRef}
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            reveal
            autoFocus={!!handed}
            maxLength={PASSWORD_MAX}
            readOnly={busy}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err.password || err.form) setErr((x) => ({ ...x, password: null, form: null }));
            }}
            error={err.password}
          />
        </div>
        <button type="button" className="auth-forgot" onClick={onForgot} disabled={busy}>
          Forgot password?
        </button>
        {err.form ? (
          <p className="auth-err form" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" aria-disabled={!ready || busy}>
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
    <Frame key="forgot" question title="Forgot your password?" sub="Enter your email and we’ll send a link to choose a new one." back={onBack} busy={busy}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-fields">
          <AuthField
            inputRef={ref}
            label="Email"
            hideLabel
            placeholder="name@example.com"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus
            maxLength={200}
            readOnly={busy}
            value={email}
            onChange={(e) => {
              onEmail(e.target.value);
              if (err.email || err.form) setErr({});
            }}
            error={err.email}
          />
        </div>
        {err.form ? (
          <p className="auth-err form" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" aria-disabled={busy || !!emailProblem(email)}>
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
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const problem = newPasswordProblem(pw);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (problem) {
      setShown(true);
      ref.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/reset', { method: 'POST', json: { token, password: pw } });
      setState('done');
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && (e2.code === 'reset_invalid' || e2.status === 400)) setState('invalid');
      else if (e2 instanceof ApiError && e2.status === 422) setErr(passwordRefusal(e2.message));
      else setErr(plain(e2, 'Couldn’t change the password. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  if (state === 'done')
    return (
      <Frame key="done" title="Password changed." sub="Open Orby and sign in.">
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
    <Frame key="reset" question title="Choose a new password." sub="You sign in with it from now on.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-fields">
          <AuthField
            inputRef={ref}
            label="New password"
            hideLabel
            type="password"
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="go"
            autoFocus
            reveal
            maxLength={PASSWORD_MAX}
            readOnly={busy}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setShown(false);
              if (err) setErr(null);
            }}
            error={shown ? problem : null}
            hint={problem ?? 'OK'}
          />
        </div>
        {err ? (
          <p className="auth-err form" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {err}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" aria-disabled={!!problem || busy}>
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
  // the form draws at once (auth-11); a server that said it takes no new accounts sends the visitor to sign in
  if (status.data && !canSignUp(status.data) && !created.current) return <Navigate to="/login" replace />;
  // the privacy page comes before any account
  if (!choice && !created.current) return <Navigate to="/start" replace state={{ step: 'privacy' }} />;
  const emailErr = emailProblem(email);
  const pwErr = newPasswordProblem(pw, email);
  const toPassword = (e: React.FormEvent) => {
    e.preventDefault();
    // a taken address stays here until it changes (auth-18)
    if (taken) return;
    // never greyed out: a press with a mistyped address says so, at the field (auth-07)
    if (emailErr) {
      setErr({ email: emailErr });
      refs.email.current?.focus();
      return;
    }
    setErr({});
    setStep('password');
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pwErr) {
      setErr({ password: pwErr });
      refs.password.current?.focus();
      return;
    }
    if (emailErr) {
      setStep('email');
      setErr({ email: emailErr });
      return;
    }
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
      // the first question is the name (auth-08)
      nav('/welcome/name', { replace: true });
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.status === 409) {
        setTaken(true);
        setStep('email');
        setErr({ email: 'There’s already an account with that email.' });
      } else if (e2 instanceof ApiError && e2.status === 403) setErr({ form: 'New accounts are not open right now. Sign in instead.' });
      else if (e2 instanceof ApiError && e2.status === 422) {
        // the server names the field it refused (auth-14, auth-19): a weak password keeps the visitor on the password step
        if (isPasswordRefusal(e2)) {
          setStep('password');
          setErr({ password: passwordRefusal(e2.message) });
          refs.password.current?.focus();
        } else {
          setStep('email');
          setErr({ email: 'That doesn’t look like an email address.' });
        }
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
      <Frame key="email" question title="What’s your email?" sub="You sign in with it. It is never sold." back={() => (canGoBack() ? nav(-1) : nav('/start', { replace: true, state: { step: 'privacy' } }))} foot={foot}>
        <form className="auth-form" onSubmit={toPassword} noValidate>
          <div className="auth-fields">
            <AuthField
              inputRef={refs.email}
              label="Email"
              hideLabel
              placeholder="name@example.com"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              autoFocus
              maxLength={200}
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
            // the address has an account: signing in with it is the way on, and Next waits for a different one (auth-18)
            <>
              <button type="submit" className="btn soft block auth-next-alt" disabled>
                Next
              </button>
              <Link to="/login" replace state={{ email: email.trim() }} className="btn primary block auth-submit auth-taken">
                Sign in with that email
              </Link>
            </>
          ) : (
            <button type="submit" className="btn primary block auth-submit" aria-disabled={!!emailErr}>
              Next
            </button>
          )}
        </form>
      </Frame>
    );
  return (
    <Frame key="password" question title="Choose a password." sub={`For ${email.trim()}.`} back={() => setStep('email')} busy={busy} foot={foot}>
      <form className="auth-form" onSubmit={submit} noValidate>
        {/* the pair, for a password manager: the email stays in the form, out of sight */}
        <input type="email" name="email" autoComplete="username" value={email.trim()} readOnly hidden />
        <div className="auth-fields">
          <AuthField
            inputRef={refs.password}
            label="Password"
            hideLabel
            type="password"
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="go"
            autoFocus
            reveal
            maxLength={PASSWORD_MAX}
            readOnly={busy}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err.form || err.password) setErr((x) => ({ ...x, form: null, password: null }));
            }}
            error={err.password}
            // a neutral word once it will do, never praise (auth-14)
            hint={pwErr ?? 'OK'}
          />
        </div>
        <p className="auth-terms">
          By creating an account you agree to the <SiteLink href={LEGAL.terms}>Terms</SiteLink> and <SiteLink href={LEGAL.privacy}>Privacy Policy</SiteLink>. You must be {MIN_AGE} or older.
        </p>
        {err.form ? (
          <p className="auth-err form" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" aria-disabled={!!pwErr || busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </Frame>
  );
};

/** v1 name: /setup is sign-up now. */
export const Setup = Signup;
