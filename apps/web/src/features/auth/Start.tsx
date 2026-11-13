import { ChevronLeft } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { DockSample } from '@/features/onboarding/cards';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { LEGAL, SUPPORT } from '@/lib/siteLinks';
import { Wordmark } from '@/ui/Brand';
import { Pressable } from '@/ui/Pressable';
import { canGoBack, SiteLink, useAuthStatus } from './AuthScreens';
import { type PendingChoice, writePendingChoice } from './consent';
import { markHasAccount } from './flag';
import { pageAfterTap, pageAt, pageForKey } from './pager';
import { PAGES } from './pages';
import { PRIVACY_PROMISE, PrivacyFacts } from './PrivacyFacts';
import './auth.css';
import './start.css';

/** The pager page the person left for the privacy step, so Back returns to it (auth-22). */
let lastPage = 0;
/** The pager was left for the privacy step: coming back is a step change, and focus lands on the page's heading. */
let cameBack = false;

/**
 * The first screens a new person sees (inspiration §6 Onboarding; critic B7: value before the ask):
 *
 *   /start                     a three-page pager, each page a real poster of the app over the assistant's bar; the page
 *                              dots, one Sky button in a fixed place (Get started, on every page) and a quiet "I have an
 *                              account" under it
 *   /start (state: privacy)    the privacy page, before any account: the question, the promise, what Allow would send
 *                              to Claude and what is not sent, and two buttons, Allow and Not now (nothing is preselected)
 *   /signup                    the account, carrying the answer (it waits on this device until then)
 *
 * The pages swipe (a horizontal scroll-snap track, so the finger owns it); the dots are the swipe's equal for the keyboard
 * and VoiceOver. The privacy page is its own history entry, so Back returns to the pager.
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

/** A page's words. The other pages' words lie unseen in the same place, so every page's words are as tall as the tallest and the posters above them are all the same height. */
const Words = ({ at }: { at: number | null }) => (
  <div className="start-words">
    {PAGES.map((p, i) =>
      i === at ? (
        <div key={p.key} className="start-say start-in s1">
          <h1 className="start-title display" tabIndex={-1}>
            {p.title}
          </h1>
          <p className="start-sub">{p.sub}</p>
        </div>
      ) : (
        <div key={p.key} className="start-say is-ghost" aria-hidden="true">
          <div className="start-title display">{p.title}</div>
          <div className="start-sub">{p.sub}</div>
        </div>
      ),
    )}
  </div>
);

const Pager = () => {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(() => Math.min(lastPage, PAGES.length - 1));
  // a press on the dots is scrolling the track: the scroll's own positions do not move the dots or the haptic (auth-26)
  const steering = useRef<number | null>(null);
  // the page the person was on when they left for the privacy step, at once and without a slide (auth-22)
  useLayoutEffect(() => {
    const el = track.current;
    if (el && page) el.scrollTo({ left: page * el.clientWidth, behavior: 'auto' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // back from the privacy step: focus lands on the page's heading (a11y-10)
  useEffect(() => {
    if (!cameBack) return;
    cameBack = false;
    track.current?.querySelectorAll<HTMLElement>('h1.start-title')[page]?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void (steering.current != null && clearTimeout(steering.current)), []);
  // the dots follow the track, wherever the finger leaves it
  const settle = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = pageAt(el.scrollLeft, el.clientWidth, PAGES.length);
    if (i !== page) {
      setPage(i);
      haptics.select();
    }
  };
  const onScroll = () => {
    if (steering.current != null) return;
    settle();
  };
  const endSteer = () => {
    if (steering.current == null) return;
    clearTimeout(steering.current);
    steering.current = null;
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (!el || i === page) return;
    endSteer();
    // the scroll that follows is ours until it ends (scrollend), or 450 ms at most
    if (!reduce) steering.current = window.setTimeout(endSteer, 450);
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    setPage(i);
    haptics.select();
  };
  const start = () => {
    lastPage = page;
    cameBack = true;
    nav('/start', { state: { step: 'privacy' } });
  };
  return (
    <main className="start">
      <span className="auth-halo" aria-hidden="true" />
      <header className="start-brand start-in">
        {/* the ask bar under the posters carries the Orb: the wordmark stands alone, so the frame never shows two (guide 2.3) */}
        <Wordmark width={75} />
        <SiteLink href={SUPPORT} className="start-help">
          Help
        </SiteLink>
      </header>
      {/* a short screen, or a large text size: the posters and their words scroll under the brand row, over the pinned foot */}
      <div className="start-stage">
        <div className="start-stage-in">
          <div ref={track} className="start-track" onScroll={onScroll} onScrollEnd={endSteer} aria-roledescription="carousel" aria-label="What Orby does">
            {PAGES.map((p, i) => (
              <section key={p.key} className="start-page" aria-roledescription="slide" aria-label={`${i + 1} of ${PAGES.length}`} aria-hidden={i !== page} inert={i !== page}>
                <div className="start-window start-in">
                  <p.Card live={i === page} />
                </div>
                <Words at={i} />
              </section>
            ))}
          </div>
          {/* the assistant's bar holds still over the posters as they page, as the dock does over a tab: laid out as a
              page is (the window, then the words' room), so it sits at the foot of every poster's window */}
          <div className="start-over">
            <div className="start-over-window start-in">
              <DockSample />
            </div>
            <Words at={null} />
          </div>
        </div>
      </div>
      <div className="start-foot start-in s2">
        {/* where you are, and the swipe's equal: one adjustable control for the keyboard and VoiceOver (a11y-10), and a tap goes on a page */}
        <div
          className="start-dots"
          role="slider"
          tabIndex={0}
          aria-label="Page"
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={PAGES.length}
          aria-valuenow={page + 1}
          aria-valuetext={`Page ${page + 1} of ${PAGES.length}: ${PAGES[page]!.title}`}
          onClick={() => goTo(pageAfterTap(page, PAGES.length))}
          onKeyDown={(e) => {
            const to = pageForKey(e.key, page, PAGES.length);
            if (to == null) return;
            e.preventDefault();
            goTo(to);
          }}
        >
          {PAGES.map((p, i) => (
            <span key={p.key} className={`start-dot ${i === page ? 'on' : ''}`} aria-hidden="true" />
          ))}
        </div>
        <Pressable className="btn primary block start-cta" onPress={start}>
          Get started
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
  // arriving here is a step change: focus lands on the heading (a11y-10)
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
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
        {/* the question is the step's heading (layout standard 2.11, plan O8): the same 26 as every question in setup, the
            promise as its line, then the whole of what goes and what does not as one inset group */}
        <h1 ref={heading} className="pv-title display" tabIndex={-1}>
          Allow the assistant?
        </h1>
        <p className="start-sub pv-promise">{PRIVACY_PROMISE}</p>
        {/* the policy, on the first screen before the answer is given, at 320 too: right under the promise it backs */}
        <SiteLink href={LEGAL.privacy} className="pv-policy">
          Privacy policy
        </SiteLink>
        <PrivacyFacts consent={null} />
      </div>
      <div className="start-foot pv-foot">
        {/* what Not now means, 8 above the pair it explains (layout standard 3.3; auth-20) */}
        <p className="pv-later">Not now keeps the assistant off. Orby asks before it sends anything, and you can change it in Settings.</p>
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
