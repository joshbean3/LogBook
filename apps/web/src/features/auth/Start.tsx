import { ChevronLeft } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AssistantCard, HabitsCard, LearnedCard, MorningCard, WeekCard } from '@/features/onboarding/cards';
import { haptics } from '@/lib/haptics';
import { useSplashDoneOnPaint } from '@/lib/native';
import { LEGAL, SUPPORT } from '@/lib/siteLinks';
import { Lockup } from '@/ui/Brand';
import { Pressable } from '@/ui/Pressable';
import { canGoBack, SiteLink, useAuthStatus } from './AuthScreens';
import { type PendingChoice, writePendingChoice } from './consent';
import { markHasAccount } from './flag';
import { PRIVACY_PROMISE, PrivacyFacts } from './PrivacyFacts';
import './auth.css';
import './start.css';

/** The welcome pager's pages: one real Logbook card each, a serif headline in Logbook's voice, one plain line. */
export const PAGES = [
  // page 1 says what Logbook is, in one plain line (auth-13)
  { key: 'morning', card: <MorningCard />, title: 'Your day, lit.', sub: 'Your run, your habits and your notes for today, on one screen.' },
  { key: 'habits', card: <HabitsCard />, title: 'Habits you can tap.', sub: 'Each one is a tile on Today. Tap it when it’s done and the week fills in.' },
  { key: 'plan', card: <WeekCard compact />, title: 'A plan that fits your mornings.', sub: 'Four questions, then your first week, written for you.' },
  { key: 'learned', card: <LearnedCard />, title: 'One thing a day.', sub: 'What you learned, kept by month, back when you need it.' },
  // the assistant is met here, before the page that asks about it (auth-13)
  { key: 'assistant', card: <AssistantCard />, title: 'An assistant that knows your plan.', sub: 'Ask it anything. It can read your plan and change it when you say so.' },
] as const;

/** The pager page the person left for the privacy step, so Back returns to it (auth-22). */
let lastPage = 0;

/**
 * The first screens a new person sees (inspiration §6 Onboarding; critic B7: value before the ask):
 *
 *   /start                     a four-page pager, each page a real Logbook card; one navy pill in a fixed place (Next,
 *                              then Get started) over the page dots, and a quiet "I have an account" under it
 *   /start (state: privacy)    the privacy page, before any account: the question, the promise, what Allow would send
 *                              to Claude and what is not sent, and two buttons, Allow and Not now (nothing is preselected)
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
  const [page, setPage] = useState(() => Math.min(lastPage, PAGES.length - 1));
  const last = page === PAGES.length - 1;
  // a Next press is scrolling the track: the scroll's own positions do not move the dots, the label or the haptic (auth-26)
  const steering = useRef<number | null>(null);
  // the page the person was on when they left for the privacy step, at once and without a slide (auth-22)
  useLayoutEffect(() => {
    const el = track.current;
    if (el && page) el.scrollTo({ left: page * el.clientWidth, behavior: 'auto' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Fit (auth-12): at a larger text size the demo card is drawn like a picture (laid out at its own width in rem, then
  // scaled to the page, so nothing inside it collides), and the card with the words shrinks together, down to 60 %,
  // before anything clips; past that the page scrolls.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const fit = () => {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
      for (const pg of el.querySelectorAll<HTMLElement>('.start-page')) {
        const box = pg.querySelector<HTMLElement>('.start-fit');
        const card = pg.querySelector<HTMLElement>('.start-card');
        if (!box || !card) continue;
        box.style.zoom = '';
        card.style.zoom = '';
        card.classList.toggle('as-picture', root > 1);
        const lc = card.firstElementChild as HTMLElement | null;
        // the room is the page's (a zoomed element's own % width resolves in its zoomed space, so it is not asked)
        const room = Math.min(box.clientWidth, 400);
        if (root > 1 && lc && lc.offsetWidth > room) card.style.zoom = String(Math.floor((room / lc.offsetWidth) * 100) / 100);
        const cs = getComputedStyle(pg);
        const tall = pg.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const need = box.offsetHeight;
        box.style.zoom = need > tall && tall > 0 ? String(Math.max(0.6, Math.floor((tall / need) * 100) / 100)) : '';
      }
    };
    fit();
    // the track for the screen's size; the first page's words for the text size (they grow with it). fit() leaves each box
    // at the size it found, so its own changes settle in one pass.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const words = el.querySelector('.start-words');
    if (words) ro.observe(words);
    return () => ro.disconnect();
  }, []);
  // a step change by Next moves focus to the new page's heading (a11y-10)
  const focusHeading = useRef(false);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    track.current?.querySelectorAll<HTMLElement>('.start-title')[page]?.focus({ preventScroll: true });
  }, [page]);
  useEffect(() => () => void (steering.current != null && clearTimeout(steering.current)), []);
  // the dots follow the track, wherever the finger leaves it
  const settle = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(PAGES.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
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
    if (!el) return;
    endSteer();
    // the scroll that follows is ours until it ends (scrollend), or 450 ms at most
    if (!reduce) steering.current = window.setTimeout(endSteer, 450);
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    focusHeading.current = true;
    setPage(i);
    haptics.select();
  };
  const next = () => {
    if (!last) return goTo(page + 1);
    lastPage = page;
    nav('/start', { state: { step: 'privacy' } });
  };
  return (
    <main className="start">
      <span className="auth-halo rise" aria-hidden="true" />
      <header className="start-brand start-in">
        <Lockup />
        <SiteLink href={SUPPORT} className="start-help">
          Help
        </SiteLink>
      </header>
      <div ref={track} className="start-track" onScroll={onScroll} onScrollEnd={endSteer} aria-roledescription="carousel" aria-label="What Orby does">
        {PAGES.map((p, i) => (
          <section key={p.key} className="start-page" aria-roledescription="slide" aria-label={`${i + 1} of ${PAGES.length}`} aria-hidden={i !== page} inert={i !== page}>
            <div className="start-fit">
              <div className="start-card start-in">{p.card}</div>
              <div className="start-words">
                <h1 className="start-title display start-in s1" tabIndex={-1}>
                  {p.title}
                </h1>
                <p className="start-sub start-in s1">{p.sub}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="start-foot start-in s2">
        {/* where you are, not a control: swipe and Next do the paging (a11y-10, auth-23) */}
        <div className="start-dots" role="img" aria-label={`Page ${page + 1} of ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <span key={p.key} className={`start-dot ${i === page ? 'on' : ''}`} aria-hidden="true" />
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
