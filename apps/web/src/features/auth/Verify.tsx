import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { haptics } from '@/lib/haptics';
import { Frame, plain, useAuthStatus } from './AuthScreens';
import { markHasAccount } from './flag';
import './auth.css';

/**
 * /verify?token=…: the link from the sign-up mail. The token goes to the API as the screen opens (once, whatever React
 * does with the effect); then "Verified. Open Logbook", or the reason in plain words with Resend when someone is signed in
 * here (the link may well open in another browser than the app's; then the way back is Sign in).
 */
export const Verify = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const status = useAuthStatus();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'ok'; email: string } | { kind: 'error'; message: string; code: string | null }>(token ? { kind: 'working' } : { kind: 'error', message: 'This link is missing its code. Open the one in the mail again.', code: 'token_invalid' });
  const [resent, setResent] = useState<'no' | 'sending' | 'yes' | 'limited'>('no');
  const asked = useRef(false);
  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;
    api<{ ok: true; email: string }>('/auth/verify', { method: 'POST', json: { token } })
      .then((r) => {
        setState({ kind: 'ok', email: r.email });
        // the bootstrap's copy of the account is stale now (emailVerifiedAt): Settings reads it again
        void qc.invalidateQueries({ queryKey: ['bootstrap'] });
      })
      .catch((e: unknown) => {
        haptics.error();
        setState({ kind: 'error', message: e instanceof ApiError && e.status === 400 ? e.message : plain(e, 'Couldn’t verify that link. Try again.'), code: e instanceof ApiError ? e.code : null });
      });
  }, [token, qc]);
  const signedIn = !!status.data?.signedIn;
  const open = () => {
    markHasAccount();
    nav(signedIn ? '/today' : '/login', { replace: true });
  };
  const resend = async () => {
    setResent('sending');
    try {
      await api('/auth/verify/resend', { method: 'POST', json: {} });
      setResent('yes');
    } catch (e) {
      haptics.error();
      setResent(e instanceof ApiError && e.status === 429 ? 'limited' : 'no');
    }
  };
  if (state.kind === 'working') return <Frame title="One moment." sub="Checking your link." />;
  if (state.kind === 'ok')
    return (
      <Frame title="Verified." sub={`${state.email} is yours.`}>
        <div className="auth-form">
          <button type="button" className="btn primary block auth-submit" onClick={open}>
            {signedIn ? 'Open Logbook' : 'Sign in'}
          </button>
        </div>
      </Frame>
    );
  return (
    <Frame
      title="That link didn’t work."
      sub={state.message}
      foot={
        !signedIn ? (
          <p className="auth-switch">
            Sign in, then ask for a new link in Settings › Account.{' '}
            <Link to="/login" replace className="auth-link">
              Sign in
            </Link>
          </p>
        ) : null
      }
    >
      <div className="auth-form">
        {signedIn ? (
          <>
            <button type="button" className="btn primary block auth-submit" disabled={resent !== 'no'} onClick={() => void resend()}>
              {resent === 'sending' ? 'Sending…' : resent === 'yes' ? 'Sent' : 'Send a new link'}
            </button>
            {resent === 'yes' ? (
              <p className="auth-done" role="status">
                A new link is on its way. It works for 24 hours.
              </p>
            ) : resent === 'limited' ? (
              <p className="auth-err form" role="alert">
                Three mails an hour is the limit. Check your inbox for the last one.
              </p>
            ) : null}
            <button type="button" className="auth-link auth-link-center" onClick={open}>
              Open Logbook
            </button>
          </>
        ) : null}
      </div>
    </Frame>
  );
};
