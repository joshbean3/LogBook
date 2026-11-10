import { ChevronLeft } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { HabitsCard, LearnedCard, MorningCard, WeekCard } from '@/features/onboarding/cards';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { LEGAL, SUPPORT } from '@/lib/siteLinks';
import { LogoMark } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { canGoBack, SiteLink, useAuthStatus } from './AuthScreens';
import { type PendingChoice, writePendingChoice } from './consent';
import { markHasAccount } from './flag';
import { PRIVACY_PROMISE, PrivacyFacts } from './PrivacyFacts';
import './auth.css';
import './start.css';

/** The welcome pager's pages: one real Logbook card each, a serif headline in Logbook's voice, one plain line. */
export const PAGES = [
  { key: 'morning', card: <MorningCard />, title: 'Your day, lit.', sub: 'Open it at 6:30 and see the one thing that matters now.' },
  { key: 'habits', card: <HabitsCard />, title: 'Habits, as lights.', sub: 'Tap one when it’s done. The week fills in under them.' },
  { key: 'plan', card: <WeekCard compact />, title: 'A plan that fits your mornings.', sub: 'Four questions, then your first week, written for you.' },
  { key: 'learned', card: <LearnedCard />, title: 'One thing a day.', sub: 'What you learned, kept by month, back when you need it.' },
] as const;

/**
 * The first screens a new person sees (inspiration §6 Onboarding; critic B7: value before the ask):
 *
 *   /start                     a four-page pager, each page a real Logbook card; one navy pill in a fixed place (Next,
 *                              then Get started) over the page dots, and a quiet "I have an account" under it
 *   /start (state: privacy)    the privacy page, before any account: the promise, what Allow would send to Claude and
 *                              what is not sent, and two buttons, Allow and Not now (nothing is preselected)
 *   /signup                    the account, carrying the answer (it waits on this device until then)
 *
 * The pages swipe (a horizontal scroll-snap track, so the finger owns it) and the pill pages too. The privacy page is its
 * own history entry, so Back returns to the pager.
 */
export const Start = () => {
  useSplashDoneOnPaint();
  const nav = useNavigate();
  const loc = useLocation();
  const status = useAuthStatus();
  const privacy = (loc.state as { step?: string } | null)?.step === 'privacy';
  // sent here before the status answered (a device without the account flag): a live session goes on to Today
  const signedIn = !!status.data?.signedIn;
  useEffect(() => {
    if (!signedIn) return;
    markHasAccount();
    nav('/today', { replace: true });
  }, [signedIn, nav]);
  // a server that takes no new accounts: there is nothing to start, only to sign in
  if (status.data && !signedIn && !(status.data.signupOpen ?? status.data.setupOpen)) return <Navigate to="/login" replace />;
  return privacy ? <PrivacyStep /> : <Pager />;
};

const Pager = () => {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  // the dots follow the track, wherever the finger leaves it
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(PAGES.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== page) {
      setPage(i);
      haptics.select();
    }
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    setPage(i);
  };
  const next = () => (last ? nav('/start', { state: { step: 'privacy' } }) : goTo(page + 1));
  return (
    <main className="start">
      <span className="auth-halo rise" aria-hidden="true" />
      <header className="start-brand start-in">
        <LogoMark size={24} color="var(--ink)" />
        <span className="caps">Logbook</span>
        <SiteLink href={SUPPORT} className="start-help">
          Help
        </SiteLink>
      </header>
      <div ref={track} className="start-track" onScroll={onScroll} aria-roledescription="carousel" aria-label="What Logbook does">
        {PAGES.map((p, i) => (
          <section key={p.key} className="start-page" aria-roledescription="slide" aria-label={`${i + 1} of ${PAGES.length}`} aria-hidden={i !== page} inert={i !== page}>
            <div className="start-card start-in">{p.card}</div>
            <div className="start-words">
              <h1 className="start-title display start-in s1">{p.title}</h1>
              <p className="start-sub start-in s1">{p.sub}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="start-foot start-in s2">
        <div className="start-dots" role="tablist" aria-label="Pages">
          {PAGES.map((p, i) => (
            <button key={p.key} type="button" role="tab" aria-selected={i === page} aria-label={`Page ${i + 1}`} className={`start-dot ${i === page ? 'on' : ''}`} onClick={() => goTo(i)} />
          ))}
        </div>
        <Pressable className="btn primary block start-cta" onPress={next}>
          {last ? 'Get started' : 'Next'}
        </Pressable>
        <Pressable className="start-signin" press="dim" onPress={() => nav('/login', { state: { from: 'start' } })}>
          I have an account
        </Pressable>
      </div>
    </main>
  );
};

/**
 * The privacy page, before any account (Apple 5.1.2(i): the person says yes before anything goes to the assistant).
 * Nothing is preselected: the person taps Allow or Not now, and either goes on to the account. Allow travels with the new
 * account as a recorded yes (with the wording version; the server stamps the time). Not now stores no record at all, so
 * the assistant and the plan builder ask again before they send anything.
 */
const PrivacyStep = () => {
  const nav = useNavigate();
  const choose = (choice: PendingChoice) => {
    haptics.select();
    writePendingChoice(choice);
    nav('/signup', { state: { from: 'start' } });
  };
  return (
    <main className="start start-privacy">
      <span className="auth-halo" aria-hidden="true" />
      <div className="pv-top">
        <button type="button" className="icon-btn pv-back" aria-label="Back" onClick={() => (canGoBack() ? nav(-1) : nav('/start', { replace: true }))}>
          <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div className="pv-body">
        <h1 className="start-title display pv-title">Kept private.</h1>
        <p className="start-sub pv-promise">{PRIVACY_PROMISE}</p>
        <div className="pv-choice">
          <h2 className="pv-choice-title">Allow the AI assistant?</h2>
          <p className="pv-choice-sub">It runs on Claude, by Anthropic. To answer you, Logbook sends Claude what is listed here. Nothing is sent until you allow it.</p>
        </div>
        <PrivacyFacts consent={null} />
        <p className="pv-later">Not now keeps the assistant off, and Logbook asks again before it sends anything. You can change this any time in Settings, then Privacy.</p>
        <SiteLink href={LEGAL.privacy} className="pv-policy">
          Privacy Policy
        </SiteLink>
      </div>
      <div className="start-foot pv-foot">
        <div className="pv-answers">
          <Pressable className="btn soft start-cta" onPress={() => choose('later')}>
            Not now
          </Pressable>
          <Pressable className="btn primary start-cta" onPress={() => choose('allow')}>
            Allow
          </Pressable>
        </div>
      </div>
    </main>
  );
};
