import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { haptics } from '@/lib/haptics';
import { AuthField, ForgotForm, Frame, newPasswordProblem, nextOn, PASSWORD_MIN, plain } from './AuthScreens';
import { markHasAccount } from './flag';
import './auth.css';

/**
 * /reset?token=…: the link from the forgot-password mail. A new password twice, Save, then "Signed in" and Open Logbook
 * (the API signs this device in and every other device out). A link that is gone (expired, used, wrong) says so and shows
 * the forgot form again, so the way out is on the same screen.
 */
export const Reset = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<{ password?: string | null; again?: string | null; form?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'gone'>(token ? 'form' : 'gone');
  const pwRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLInputElement>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { password: newPasswordProblem(pw), again: again === pw ? null : 'The two passwords don’t match.' };
    setErr(next);
    if (next.password || next.again) {
      (next.password ? pwRef : againRef).current?.focus();
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset', { method: 'POST', json: { token, password: pw } });
      markHasAccount();
      // another account may have been signed in here: nothing of it stays
      qc.clear();
      setState('done');
    } catch (e2) {
      haptics.error();
      if (e2 instanceof ApiError && e2.code?.startsWith('token_')) setState('gone');
      else if (e2 instanceof ApiError && e2.status === 422) {
        setErr({ password: e2.message });
        pwRef.current?.focus();
      } else setErr({ form: plain(e2, 'Couldn’t change the password. Try again.') });
    } finally {
      setBusy(false);
    }
  };
  if (state === 'done')
    return (
      <Frame title="Signed in." sub="Your password is changed. Every other device was signed out.">
        <div className="auth-form">
          <button type="button" className="btn primary block auth-submit" onClick={() => nav('/today', { replace: true })}>
            Open Logbook
          </button>
        </div>
      </Frame>
    );
  if (state === 'gone')
    return (
      <Frame title="This link has expired." sub="Ask for a new one: it works for an hour and only once.">
        <ForgotForm />
      </Frame>
    );
  return (
    <Frame title="Choose a new password." sub="Then you’re signed in.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          inputRef={pwRef}
          label="New password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          enterKeyHint="next"
          reveal
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (err.password) setErr((x) => ({ ...x, password: null }));
          }}
          onKeyDown={nextOn(againRef)}
          error={err.password}
          hint={`At least ${PASSWORD_MIN} characters.`}
        />
        <AuthField
          inputRef={againRef}
          label="Once more"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          enterKeyHint="go"
          reveal
          value={again}
          onChange={(e) => {
            setAgain(e.target.value);
            if (err.again) setErr((x) => ({ ...x, again: null }));
          }}
          error={err.again}
        />
        {err.form ? (
          <p className="auth-err form" role="alert">
            {err.form}
          </p>
        ) : null}
        <button type="submit" className="btn primary block auth-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Frame>
  );
};
