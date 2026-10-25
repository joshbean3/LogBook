import { today as realToday, type ISODate } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { useNav, useTabScroller } from '@/app/NavController';
import { fetchCoachRead, STRAVA_SYNC_KEY, stravaSyncNow, type StravaSyncAnswer } from '@/api/queries';
import { LANDING_VISIBLE, STRAVA_RETRY_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { NAV_EVENT } from '@/ui/nav';
import { markSeenToday } from '@/ui/useFirstToday';
import type { Log } from '../log/useLog';
import type { Face } from './faces';
import { fillRingAt, frameAt, MORPH_MS, morphRingAt, ringDrive, type RingDrive } from './HoldRing';
import { getLiveDate, subscribeLive, useIsLive } from './live';
import { growHero, LANDING_FILL_MS } from './RunLanding';

/**
 * The run landing's stages (docs/feel.md §6.1):
 * - `still`: nothing to play; the face is drawn as it is.
 * - `wait`: the run is in the snapshot but the landing has not been seen: the day's face from before it (the open face, its
 *   ring where it was) until Today is the active, uncovered tab, the app is visible and the hero is ≥ `LANDING_VISIBLE` in view.
 * - `fill` (0–300): the ring fills to full. `morph` (300–500): the stroke becomes the check, the same node.
 * - `grow` (+500 → ≈ +900): the landed face in a card growing 184 → 304 by the one layout FLIP; everything below rides it.
 * - `draw` (≈ +900 → ≈ +2000): one `success` on the FLIP's completion, the halo boost, the route draws, the stamps tick from
 *   the plan, the verdict line fades in, the check hands its place to Share.
 * - `done`: at rest; the coach's read is asked for once if the month has none.
 */
export type LandingStage = 'still' | 'wait' | 'fill' | 'morph' | 'grow' | 'draw' | 'done';

/** How far ahead of stage 3 its React commit is made (it holds the card at 184 until then): about two busy frames at 4×. */
const GROW_LEAD_MS = 150;
const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);
export const LANDING_EVENT = 'logbook:landing';
const note = (stage: LandingStage, extra?: { t?: number; coach?: string; waited?: number }) => {
  if (!TEST_HOOKS) return;
  const w = window as unknown as { __landing?: { stage: string; t: number }[] };
  const e = { stage, ...extra, t: extra?.t ?? performance.now() };
  (w.__landing ??= []).push(e);
  window.dispatchEvent(new CustomEvent(LANDING_EVENT, { detail: e }));
};

/**
 * The first frame after two in a row that came on time (≤ 24 ms apart), or after `max` ms: the stages' clock starts on a frame
 * the main thread is free to keep, not inside the renders of the refetch that brought the run. Resolves with that frame's time.
 */
const calmFrame = (max = 1200) =>
  new Promise<number>((res) => {
    let last = 0;
    let calm = 0;
    let first = 0;
    const tick = (t: number) => {
      if (!first) first = t;
      calm = last && t - last <= 24 ? calm + 1 : 0;
      last = t;
      if (calm >= 2 || t - first >= max) res(t);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

// ---------- once a day: the same `logbook.seen.<key>.<date>` marks `useFirstToday` keeps ----------
const seenKey = (key: string) => `logbook.seen.${key}.${realToday()}`;
export const seenToday = (key: string) => {
  try {
    return localStorage.getItem(seenKey(key)) === '1';
  } catch {
    return true; // no storage: stay still rather than replay every time
  }
};
/** The session's one `success` (M18): whichever of Strava or the hand completes it fires it; the other is silent. */
export const successKey = (id: string) => `success-${id}`;
export const markSuccess = (id: string) => markSeenToday(successKey(id));

// ---------- the gate: seen, or it waits ----------
const nothing = () => () => undefined;
/** `el` is at least `share` inside its scroller's visible area (an IntersectionObserver on the hero), while `on`. */
export const useInView = (ref: RefObject<HTMLElement | null>, share: number, on: boolean) => {
  const scroller = useTabScroller();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => setInView((es.at(-1)?.intersectionRatio ?? 0) >= share - 0.001), { root: scroller.current, threshold: [0, share, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, share, on, scroller]);
  return on && inView;
};

/**
 * Whether this page's hero is seen now (§6.1): Today the active tab with no page pushed over it, the app visible, this page
 * the live one, the hero ≥ `LANDING_VISIBLE` in view. It listens (nav events, visibility, the live page, the observer) only
 * while a landing waits (`on`), so the three mounted pages never re-render for it on a tab tap, a day step or a return.
 */
const useSeen = (date: ISODate, ref: RefObject<HTMLElement | null>, on: boolean) => {
  const nav = useNav();
  const subscribe = useCallback(
    (f: () => void) => {
      if (!on) return nothing();
      window.addEventListener(NAV_EVENT, f);
      document.addEventListener('visibilitychange', f);
      const off = subscribeLive(f);
      return () => {
        window.removeEventListener(NAV_EVENT, f);
        document.removeEventListener('visibilitychange', f);
        off();
      };
    },
    [on],
  );
  const get = () => {
    if (!on) return false;
    const st = nav.getState();
    return st.active === 'today' && st.tabs.today.stack.length === 0 && document.visibilityState === 'visible' && getLiveDate() === date;
  };
  const shown = useSyncExternalStore(subscribe, get, () => false);
  return useInView(ref, LANDING_VISIBLE, shown);
};

export interface Landing {
  stage: LandingStage;
  /** The face to draw: the one before the run while the landing waits or plays stages 1–2, else the day's own. */
  show: Face;
  /** The ring's motion values while the landing drives it (stages wait → draw). */
  ring: RingDrive | null;
  /** The ring is on the card: a ring the landing carries down with the deck through `grow`, fading at `draw`. */
  ringShown: boolean;
  /** The landed deck's numbers and the verdict line: held at the plan (`hold`), playing (`go`), or as they are. */
  numbers: 'hold' | 'go' | 'still';
  /** The halo blooms (`.halo-boost`, 600 ms) on the FLIP's completion. */
  boost: boolean;
}

/**
 * The run landing (§6.1, build plan §3.2 item 5): a staged sequence on the hero the first time today's run is seen, and the
 * coach's read after it. `face` is the day's face now, `pre` the face from before the run (`preLandingFace`), `hero` the card.
 * Stages 1–2 run on the open face's ring on one frame clock (`fillRingAt`, `morphRingAt`; no React render between them); stage 3 is `growHero` (the FLIP, `data-layout-exception`);
 * the one `success` lands on its completion frame, only while the landing plays on screen.
 */
export const useStravaLanding = ({ date, log, face, pre, hero }: { date: ISODate; log: Log; face: Face; pre: Face; hero: RefObject<HTMLElement | null> }): Landing => {
  const reduce = useReducedMotion() ?? false;
  const isToday = date === log.today;
  const id = face.lead?.session.id ?? face.runs[0]?.id ?? 'run';
  const key = `landing-${id}`;
  const landed = isToday && face.kind === 'landed';
  const [stage, setStage] = useState<LandingStage>(() => (landed && !seenToday(key) ? 'wait' : 'still'));
  const [ring] = useState(() => ringDrive(false));
  const [boost, setBoost] = useState(false);
  const run = useRef(0);
  /** A sequence is playing stages 1–2 (the stage is still `wait` through them). */
  const started = useRef(false);
  const growStart = useRef(0);
  /** The ring as the face before the run had it: where a landing that has not been seen (or was left) waits. */
  const ringToPre = () => {
    ring.fill.jump(pre.ring === 'done' ? 1 : 0);
    ring.morph.jump(pre.ring === 'done' ? 1 : 0);
    ring.check.jump(pre.ring === 'done' ? 1 : 0.8);
  };
  // a run that arrives (or leaves) while the page is up
  useEffect(() => {
    if (landed && stage === 'still' && !seenToday(key)) {
      ringToPre();
      setStage('wait');
    } else if (!landed && stage !== 'still') {
      run.current++;
      setStage('still');
    }
  }, [landed, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useSeen(date, hero, landed && stage !== 'still' && stage !== 'done');

  // the sequence, once the landing is seen: from stage 1 (or 3 when the face before had no ring to fill). Left before its
  // FLIP has settled (another tab, the hero scrolled away, the app hidden), it stops where it is and waits again, the ring
  // as it was before the run; the next time it is seen it plays from stage 1 (§6.1: "seen, or it waits"; the success fires
  // only with the visual; code review 1 #4)
  useEffect(() => {
    if (!seen) {
      if (stage === 'wait' || stage === 'grow') {
        const playing = stage === 'grow' || started.current;
        run.current++;
        started.current = false;
        if (playing) {
          ringToPre();
          if (stage === 'grow') setStage('wait');
        }
      }
      return;
    }
    if (stage !== 'wait') return;
    const me = ++run.current;
    const alive = () => run.current === me;
    started.current = true;
    void (async () => {
      // the refetch that brought the run is still rendering the pages: the sequence starts on the first calm frame after it
      const asked = performance.now();
      const t0 = await calmFrame();
      if (!alive()) return;
      note('fill', { t: t0, waited: Math.round(t0 - asked) });
      let growAt = t0;
      if (pre.ring) {
        const t1 = await fillRingAt(ring, t0, LANDING_FILL_MS, alive);
        if (!alive()) return;
        note('morph', { t: t1 });
        growAt = t1 + MORPH_MS;
        const morph = morphRingAt(ring, t1, reduce, alive);
        // stage 3's commit (the card's 304 layout under its inverse) is paid during the morph's last frames, so the card
        // moves on the frame stage 2 ends, not a render later
        await Promise.race([morph, frameAt(growAt - GROW_LEAD_MS)]);
        if (!alive()) return;
      }
      growStart.current = growAt;
      note('grow', { t: growAt });
      setStage('grow');
    })();
  }, [stage, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  // stage 3: the FLIP, on the commit that draws the landed face (layout first, then the inverse, before the paint)
  useLayoutEffect(() => {
    if (stage !== 'grow') return;
    const me = run.current;
    const el = hero.current;
    const settled = () => {
      if (run.current !== me) return;
      started.current = false;
      // seen to its end: once a day from here (a landing left before this frame plays again from stage 1)
      markSeenToday(key);
      if (face.landed) markSeenToday(face.landed.drawKey);
      // the one success, on the frame the shape stops changing (only when the hand has not already given it today)
      if (!seenToday(successKey(id))) {
        markSuccess(id);
        haptics.success();
      }
      note('draw');
      setBoost(true);
      setStage('draw');
    };
    if (!el || !face.tall || reduce) {
      settled();
      return;
    }
    return growHero(el, 184, settled, growStart.current);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // stage 4: the route draws for 1.1 s, the numbers tick, then rest
  useEffect(() => {
    if (stage !== 'draw') return;
    const t = setTimeout(() => {
      note('done');
      setStage('done');
    }, 1100);
    const b = setTimeout(() => setBoost(false), 650);
    return () => {
      clearTimeout(t);
      clearTimeout(b);
    };
  }, [stage]);

  // the read is asked for after the landing (or on a landed face whose landing was seen earlier), never before it
  useCoachRead(date, log, face, landed && (stage === 'done' || (stage === 'still' && seenToday(key))));

  // the render a run arrives in already waits (the effect above makes it so a commit later): the ring never leaves its node
  const now: LandingStage = stage === 'still' && landed && !seenToday(key) ? 'wait' : stage;
  const playing = now === 'wait' || now === 'fill' || now === 'morph';
  return {
    stage: now,
    show: playing ? pre : face,
    ring: now === 'still' || now === 'done' ? null : ring,
    ringShown: !!pre.ring && (now === 'wait' || now === 'fill' || now === 'morph' || now === 'grow' || now === 'draw'),
    numbers: now === 'wait' || now === 'fill' || now === 'morph' || now === 'grow' ? 'hold' : now === 'draw' ? 'go' : 'still',
    boost,
  };
};

/**
 * The coach's one sentence (§6.1, risk 11): once per matched run, when the month has no read for that date and session, the
 * client asks the existing `POST /coach/read` and writes the answer into the month cache (the hero fades it in). Nothing
 * waits for it and nothing says "Reading…"; a failure leaves the face without a sentence, silently, and is not asked again
 * today (the session sheet's own read button still works).
 */
const useCoachRead = (date: ISODate, log: Log, face: Face, on: boolean) => {
  const qc = useQueryClient();
  const sessionId = face.lead?.session.id ?? null;
  const k = `coach-${date}-${sessionId ?? 'run'}`;
  const want = on && log.features.claude && !!face.landed && !face.landed.coach;
  const live = useIsLive(date);
  useEffect(() => {
    if (!want || !live || seenToday(k)) return;
    markSeenToday(k);
    note('done', { coach: 'asked' });
    fetchCoachRead(qc, date, sessionId).catch(() => undefined);
  }, [want, live, k]); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * The silent repeat (§6.1): when a foreground check answers `changed: 0` and the session is still open past its back time
 * (the open face), one more `/strava/sync` at +`STRAVA_RETRY_MS` from that check, forced past the throttle and quiet (the
 * status line ignores it). One per check; a `changed ≥ 1` answer to it plays the landing like any other.
 */
const useStravaRetry = (on: boolean) => {
  const qc = useQueryClient();
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => {
    const done = new WeakSet<object>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const off = qc.getMutationCache().subscribe((ev) => {
      if (ev.type !== 'updated') return;
      const m = ev.mutation;
      if (!m || m.options.mutationKey?.[0] !== STRAVA_SYNC_KEY[0] || m.options.meta?.quiet || done.has(m)) return;
      if (m.state.status !== 'success' || (m.state.data as StravaSyncAnswer | undefined)?.changed) return;
      done.add(m);
      if (!onRef.current) return;
      const wait = Math.max(0, STRAVA_RETRY_MS - (Date.now() - (m.state.submittedAt || Date.now())));
      const t = setTimeout(() => {
        timers.delete(t);
        if (onRef.current) void stravaSyncNow(qc, { force: true, quiet: true }).catch(() => undefined);
      }, wait);
      timers.add(t);
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, [qc]);
};

/** Mounted by the open face of today's hero only: the silent repeat listens while its page is the live one. */
export const StravaRetry = ({ date }: { date: ISODate }) => {
  useStravaRetry(useIsLive(date));
  return null;
};
