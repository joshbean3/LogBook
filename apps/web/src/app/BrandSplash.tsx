import { useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playHaptics } from '@/lib/haptics';
import { isSplashDone, SPLASH_DONE } from '@/lib/native';
import { Wordmark } from '@/ui/Brand';
import dawnArt from '@/ui/orb/logo-mark-dawn.svg?url';
import litArt from '@/ui/orb/logo-mark-glow.svg?url';
import sunriseArt from '@/ui/orb/logo-mark-sunrise.svg?url';
import { applyDynamicType } from './dynamicType';
import { useSplashHeld } from './splashHold';
import { cssBezier, REST_GAP, RISE, RISE_EASE, SPLASH_MS, sunrisePlan } from './splashTimeline';
import './brandSplash.css';

/**
 * The opening (guide 9.2, 12.1): the Orb is the sun. The launch image's plain Cloud lifts like mist off the poster's three
 * hills, the Orb rises from behind the near hill to its place 0.1 D above the crest (guide 8.3), and as it climbs its light
 * warms from sky blue to a sunrise tint: its pale underlight and then its sunrise art fade in over the blue sphere, the sky
 * turns blue above and warm at the horizon, the Apricot glow comes up, and the poster's five sun rings leave the Orb one
 * by one, quickening. On the frame it clears the crest there is one fuller beat, a soft bloom, and the wordmark and "One
 * good day at a time." arrive. Then the app appears underneath.
 *
 * - One length, `SPLASH_MS` (app/splashTimeline.ts): the whole schedule is derived from it and handed to the styles as
 *   custom properties. Only transform and opacity move, as keyframes on layers drawn once, so the compositor carries the
 *   opening while the app starts up on the main thread.
 * - Haptics (guide 9.5): a light tap as each ring leaves the Orb and one fuller beat as the sun clears the horizon, timed
 *   from the frame the animation really started.
 * - A cold open only. The same session opening the page again (a reload after signing out, a web view the system brought
 *   back) gets the quiet fade of the final frame. Reduce Motion: a 300 ms crossfade to the final frame and the one beat.
 * - A tap, or any key, runs it to its end at once.
 * - It never holds the app longer than itself: it leaves at `SPLASH_MS` when the first screen has painted (`SPLASH_DONE`),
 *   which a cap stands in for. Only while the app is waiting on the server with nothing saved to draw
 *   (app/splashHold.ts) does it stay: the sun rests over the hills, breathing, and after WAIT_MS it says so, with Try again.
 * - It takes taps while it is opaque, so nothing under it is pressed by accident.
 * - A sun ring never runs through the words (guide 8.3): the rings that would not fit the sky under them are not drawn.
 */
const CAP_MS = SPLASH_MS + 700;
const WAIT_MS = 4000;
/** The quiet fade (the same session opening again): the final frame for this long at least, then a fade of the same length. */
const FADE_MS = 300;
/** Reduce Motion: the 300 ms crossfade, a short rest so the picture is seen, and a 150 ms fade out. */
const STILL_IN_MS = 300;
const STILL_MS = 800;
const STILL_OUT_MS = 150;
/** A tap runs what is left of the sunrise this many times faster, then lets the app through. */
const SKIP_RATE = 8;
const SKIP_SETTLE_MS = 120;
/** The animation's own start is used as the clock's zero only when it is within this of the component's mount (ms). */
const START_SLACK_MS = 5000;
/** The clear space between the words and the nearest sun ring, in px: a ring that would come closer is dropped (guide 8.3). */
const RING_CLEAR = 16;
/** While it says "Still loading", the words keep this far above the Orb, and never rise past this far from the top (px). */
const WAIT_CLEAR = 12;
const HEAD_TOP_MIN = 64;
/**
 * Set once the opening has played in this session (sessionStorage: a new launch of the app starts a new session). It says
 * nothing about an account, and it must outlive the sign-out wipe, which removes every `logbook.` key and reloads the
 * page (lib/account.ts): so, like that wipe's own mark, it is spelled with a hyphen and the sweep leaves it alone.
 */
const PLAYED_KEY = 'logbook-splash-played';
let shown = false;

type Moment = 'sunrise' | 'fade' | 'still';

const playedThisSession = () => {
  try {
    return sessionStorage.getItem(PLAYED_KEY) === '1';
  } catch {
    return false;
  }
};
const markPlayed = () => {
  try {
    sessionStorage.setItem(PLAYED_KEY, '1');
  } catch {
    /* no storage: the module flag still keeps it to once per page */
  }
};

/** The caption on the far hill: before noon, noon to 5 pm, after 5 pm (guide 12.1). */
export const greetingFor = (hour: number) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

const PLAN = sunrisePlan();
const span = (name: string, s: { at: number; for: number }) => ({ [`--${name}-at`]: `${s.at}ms`, [`--${name}-for`]: `${s.for}ms` });
/** The schedule as custom properties (brandSplash.css reads nothing else about time). */
const SCHEDULE = {
  '--bs-rise': RISE,
  '--bs-rest-gap': REST_GAP,
  '--bs-rise-ease': cssBezier(RISE_EASE),
  ...span('bs-veil', PLAN.veil),
  ...span('bs-climb', PLAN.rise),
  ...span('bs-warm', PLAN.warm),
  ...span('bs-glow', PLAN.glow),
  ...span('bs-first', PLAN.first),
  ...span('bs-light', PLAN.light),
  ...span('bs-bloom', PLAN.bloom),
  ...span('bs-word', PLAN.word),
  ...span('bs-line', PLAN.line),
  '--bs-rest-at': `${PLAN.rest}ms`,
} as React.CSSProperties;

export const BrandSplash = () => {
  const reduce = useReducedMotion();
  const held = useSplashHeld();
  const [on, setOn] = useState(() => !shown);
  // the sunrise for a cold open; the quiet fade when this session has already seen it; the still frame under Reduce Motion
  const [moment] = useState<Moment>(() => (reduce ? 'still' : playedThisSession() ? 'fade' : 'sunrise'));
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [greeting] = useState(() => greetingFor(new Date().getHours()));
  const root = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const orb = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  // how far the rings may reach from the Orb's center, in Orb diameters: the sky between the Orb and the words
  const [room, setRoom] = useState(Infinity);
  const t0 = useRef(performance.now());
  // ms since the opening's first frame. The climb's keyframes say when that was: they start on the frame they first draw,
  // however long the start-up kept that frame waiting, and performance.now() is on their timeline's own time base. A start
  // time that is not near this component's own (an engine that counts differently) is not believed
  const climb = useRef<Animation | null>(null);
  const clock = () => {
    const began = climb.current?.startTime;
    return performance.now() - (typeof began === 'number' && Math.abs(began - t0.current) < START_SLACK_MS ? began : t0.current);
  };
  const stopHaptics = useRef<(() => void) | null>(null);
  const out = moment === 'sunrise' ? PLAN.exit.for : moment === 'fade' ? FADE_MS : STILL_OUT_MS;
  // when it may leave: the end of its own animation, less the dissolve
  const min = moment === 'sunrise' ? PLAN.exit.at : moment === 'fade' ? FADE_MS : STILL_MS;

  // before the first frame: mark the session, fit the rings, and set the haptics to the climb's clock
  useLayoutEffect(() => {
    if (!on) return;
    shown = true;
    markPlayed();
    t0.current = performance.now();
    // a ring never runs through the words (guide 8.3): on a short screen or at a large text size the outer ones are dropped.
    // Measured once, here, before the first paint, at the text size the phone is set to (the app applies it after its
    // first render, which is later than this). Offsets are layout positions, so the climb's transform does not count
    applyDynamicType();
    let fits = Infinity;
    const d = orb.current?.offsetWidth ?? 0;
    if (d > 0 && sun.current && head.current) fits = (sun.current.offsetTop - (head.current.offsetTop + head.current.offsetHeight) - RING_CLEAR) / d;
    setRoom(fits);
    if (moment === 'fade') return;
    try {
      climb.current = (moment === 'sunrise' && sun.current?.getAnimations?.()[0]) || null;
    } catch {
      /* an old engine: the time since this effect is close enough */
    }
    // a tap belongs to its ring: a ring that is not drawn is not felt
    const steps = PLAN.haptics.filter((h, i) => h.kind !== 'rise' || PLAN.rings[i]!.size / 2 <= fits);
    stopHaptics.current = playHaptics(moment === 'sunrise' ? steps : [{ at: STILL_IN_MS, kind: 'dawn' }], clock);
    return () => stopHaptics.current?.();
  }, [on, moment]);

  // the first screen painted, or the cap ran out
  useEffect(() => {
    if (!on) return;
    const go = () => setReady(true);
    if (isSplashDone()) go();
    window.addEventListener(SPLASH_DONE, go);
    const cap = setTimeout(go, CAP_MS);
    return () => {
      window.removeEventListener(SPLASH_DONE, go);
      clearTimeout(cap);
    };
  }, [on]);

  // a tap or a key: what is left of the sunrise runs at once, and the app comes through as soon as it can
  const skip = () => {
    if (skipped || leaving) return;
    stopHaptics.current?.();
    try {
      for (const a of root.current?.getAnimations?.({ subtree: true }) ?? []) {
        // the resting breath is endless: leave it be
        if (a.effect?.getComputedTiming().iterations === Infinity) continue;
        a.updatePlaybackRate(SKIP_RATE);
      }
    } catch {
      /* it plays out at its own pace */
    }
    setSkipped(true);
  };
  const skipRef = useRef(skip);
  skipRef.current = skip;
  useEffect(() => {
    if (!on) return;
    const key = () => skipRef.current();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [on]);

  // leave once the first screen is ready and nothing holds it: at the end of the animation, or right after a tap
  useEffect(() => {
    if (!on || leaving || !ready || held) return;
    const wait = skipped ? SKIP_SETTLE_MS : Math.max(0, min - clock());
    const t = setTimeout(() => setLeaving(true), wait);
    return () => clearTimeout(t);
  }, [on, leaving, ready, held, skipped, min]);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setOn(false), out);
    return () => clearTimeout(t);
  }, [leaving, out]);

  // held a while: say so, with a way to try again
  useEffect(() => {
    if (!on || !held) {
      setWaiting(false);
      return;
    }
    const t = setTimeout(() => setWaiting(true), Math.max(0, WAIT_MS - (performance.now() - t0.current)));
    return () => clearTimeout(t);
  }, [on, held]);

  // "Still loading" and Try again join the words: at a large text size or on a short screen the column would reach the Orb,
  // so it moves up by just what it needs (one settle, on transform); where even that is not enough, the line gives its
  // place to the status
  const says = on && waiting && !!held;
  const [lift, setLift] = useState(0);
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const h = head.current;
    if (!says || !h || !sun.current || !orb.current) {
      setLift(0);
      setTight(false);
      return;
    }
    const over = h.offsetTop + h.offsetHeight + WAIT_CLEAR - (sun.current.offsetTop - orb.current.offsetWidth / 2);
    const most = Math.max(0, h.offsetTop - HEAD_TOP_MIN);
    if (over > most && !tight) setTight(true);
    setLift(Math.max(0, Math.min(over, most)));
  }, [says, tight]);

  if (!on) return null;
  return (
    <div
      ref={root}
      className="brand-splash"
      data-moment={moment}
      data-leave={leaving ? '' : undefined}
      data-skipped={skipped ? '' : undefined}
      data-waiting={says ? '' : undefined}
      data-tight={tight ? '' : undefined}
      style={{ ...SCHEDULE, '--bs-out': `${out}ms` } as React.CSSProperties}
      aria-hidden={says ? undefined : 'true'}
      onPointerDown={skip}
    >
      <div className="bs-art">
        <div className="bs-sky" />
        <div className="bs-day" />
        <div className="bs-glow" />
        <div className="bs-bloom" />
        <div className="bs-sun" ref={sun}>
          <div className="bs-halo" />
          <div className="bs-rings">
            {PLAN.rings.map((ring) =>
              ring.size / 2 <= room ? (
                <span
                  key={ring.size}
                  className="bs-ring"
                  style={{ '--k': ring.size, '--s0': ring.from, '--o': ring.opacity, '--at': `${ring.at}ms`, '--for': `${ring.for}ms` } as React.CSSProperties}
                />
              ) : null,
            )}
          </div>
          <div className="bs-orb" ref={orb}>
            {/* three drawings of one sphere, each over the last: blue, its pale underlight, the sunrise in it */}
            <img className="bs-orb-art" src={dawnArt} alt="" draggable={false} />
            <img className="bs-orb-art bs-orb-first" src={litArt} alt="" draggable={false} />
            <img className="bs-orb-art bs-orb-lit" src={sunriseArt} alt="" draggable={false} />
          </div>
        </div>
        <svg className="bs-hills" viewBox="0 0 500 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 62 C 90 40, 170 44, 250 58 S 410 76, 500 52 L500 200 L0 200Z" fill="var(--hill-1)" />
          <path d="M0 98 C 120 70, 220 84, 300 96 S 440 112, 500 90 L500 200 L0 200Z" fill="var(--hill-2)" />
          <path d="M0 136 C 100 118, 200 120, 290 136 S 430 150, 500 128 L500 200 L0 200Z" fill="var(--hill-3)" />
        </svg>
        <p className="bs-cap">{greeting}</p>
      </div>
      {/* the launch image's Cloud, lifting off the picture: frame 0 is the launch image exactly */}
      <div className="bs-veil" />
      <div className="bs-head" ref={head} style={lift ? { transform: `translate3d(0, ${-lift}px, 0)` } : undefined}>
        <Wordmark width={150} className="bs-word" />
        <p className="bs-line">One good day at a time.</p>
        {says ? (
          <div className="brand-splash-wait" role="status">
            <p>Still loading. Check your connection.</p>
            <button type="button" className="btn quiet" onPointerDown={(e) => e.stopPropagation()} onClick={() => held?.retry()}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
