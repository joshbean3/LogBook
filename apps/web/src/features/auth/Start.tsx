import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { LogoMark } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useAuthStatus } from './AuthScreens';
import { markHasAccount } from './flag';
import './auth.css';

/**
 * The first screen a new person sees (experience §5.8 step 1, critic B7): black, the mark, the halo rising once,
 * "Your day, lit.", **Start** (the account, then four questions) and a quiet "I have an account". Value before the ask.
 *
 * It renders at once (it never waits on `/auth/status`, WP5) with the staged entrance of §0.2: the mark and the title at
 * 0 ms, the line under them at 80, Start at 160 (CSS opacity keyframes, `.start-in`). Start fades the promise (100 ms) and
 * the account form rises inside the same lit surface: the halo is the same element style at the same place and does not
 * rise a second time (`state.from === 'start'`).
 */
export const Start = () => {
  const nav = useNavigate();
  const status = useAuthStatus();
  const [going, setGoing] = useState(false);
  // sent here before the status answered (a device without the account flag): a live session goes on to Today
  const signedIn = !!status.data?.signedIn;
  useEffect(() => {
    if (!signedIn) return;
    markHasAccount();
    nav('/today', { replace: true });
  }, [signedIn, nav]);
  // a server that takes no new accounts: there is nothing to start, only to sign in
  if (status.data && !signedIn && !(status.data.signupOpen ?? status.data.setupOpen)) return <Navigate to="/login" replace />;
  const go = (to: '/signup' | '/login') => {
    if (going) return;
    setGoing(true);
    // the promise fades (fadeOut, 100 ms), then the form rises in the same surface
    setTimeout(() => nav(to, { state: { from: 'start' } }), 100);
  };
  return (
    <main className={`start ${going ? 'is-going' : ''}`}>
      <span className="auth-halo rise" aria-hidden="true" />
      <div className="start-stage">
        <div className="start-step">
          <div className="start-mark start-in">
            <LogoMark size={56} color="#fff" />
          </div>
          <h1 className="start-title display start-in">Your day, lit.</h1>
          <p className="start-sub start-in s1">A plan that fits your mornings. Four questions, then your first week.</p>
          <div className="start-foot start-in s2">
            <Pressable className="btn primary block start-cta" onPress={() => go('/signup')}>
              Start
            </Pressable>
            <Pressable className="start-signin" press="dim" onPress={() => go('/login')}>
              I have an account
            </Pressable>
          </div>
        </div>
      </div>
    </main>
  );
};
