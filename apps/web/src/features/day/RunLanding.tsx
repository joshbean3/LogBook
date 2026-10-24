import { clock, decodePolyline, routePath, type ISODate } from '@logbook/shared';
import { Share } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useMemo } from 'react';
import { crossfade, ease } from '@/lib/motion';
import { Pressable, Ticker, useFirstToday } from '@/ui';
import { coachSentence, milesText, type Face } from './faces';
import { settleAt, settleVelAt } from './HoldRing';
import { useIsLive } from './live';

/** Stage 1 of the landing (§6.1): the ring fills to full in 300 ms. */
export const LANDING_FILL_MS = 300;
/** Stage 4: the route draws once, 1.1 s (`routeDraw`). */
const ROUTE_S = 1.1;

/**
 * Stage 3 (§6.1, §10.1, risk 7): the card grows 184 → 304 by the one allowed layout FLIP. The layout has already committed
 * at 304 (the landed face); on the same frame the card is scaled back to `from` (`scaleY`, its radius corrected so the corners
 * stay round) and its content layers counter-scaled (so no text stretches), the landed deck and the ring are carried with the
 * card's bottom edge, and every section below the hero is translated up by the difference. One `springs.settle` value then
 * releases them all together, so the content below rides the card's own spring; on its completion frame the inline styles
 * clear in one go and `onDone` runs (the landing's one `success`). The card carries `data-layout-exception` while it moves.
 * The spring starts on the first frame at or after `startAt` (a frame time). Returns a cleanup that stops it.
 */
export const growHero = (el: HTMLElement, from: number, onDone: () => void, startAt = 0): (() => void) => {
  const to = el.offsetHeight;
  if (to - from < 1) {
    onDone();
    return () => undefined;
  }
  const swap = el.closest('.hero-swap') ?? el;
  const below: HTMLElement[] = [];
  for (let n = swap.nextElementSibling; n; n = n.nextElementSibling) if (n instanceof HTMLElement) below.push(n);
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20;
  const ring = el.querySelector<HTMLElement>(':scope > .hero-ring');
  const ringTop = ring?.offsetTop ?? 0;
  el.setAttribute('data-layout-exception', '');
  // the press's CSS transition (`.pressable { transition: transform 160ms }`) must not chase the FLIP's frames
  el.style.transition = 'none';
  if (ring) ring.style.transition = 'none';
  const write = (p: number) => {
    const v = from + ((to - from) * p) / 1000;
    const s = v / to;
    el.style.transformOrigin = '50% 0';
    el.style.transform = `scaleY(${s})`;
    el.style.borderRadius = `${r}px / ${r / s}px`;
    for (const f of el.querySelectorAll<HTMLElement>(':scope > .hero-face')) {
      f.style.transformOrigin = '50% 0';
      f.style.transform = `scaleY(${1 / s})`;
    }
    for (const d of el.querySelectorAll<HTMLElement>(':scope > .hero-face[data-k=landed] .hero-deck')) d.style.translate = `0 ${v - to}px`;
    if (ring) {
      ring.style.transformOrigin = '0 0';
      ring.style.transform = `translateY(${(ringTop + v - to) / s - ringTop}px) scaleY(${1 / s})`;
    }
    for (const n of below) n.style.translate = `0 ${v - to}px`;
  };
  const clear = () => {
    el.style.transform = '';
    el.style.transition = '';
    if (ring) ring.style.transition = '';
    el.style.transformOrigin = '';
    el.style.borderRadius = '';
    for (const f of el.querySelectorAll<HTMLElement>(':scope > .hero-face')) {
      f.style.transform = '';
      f.style.transformOrigin = '';
    }
    for (const d of el.querySelectorAll<HTMLElement>(':scope > .hero-face .hero-deck')) d.style.translate = '';
    if (ring) {
      ring.style.transform = '';
      ring.style.transformOrigin = '';
    }
    for (const n of below) n.style.translate = '';
    el.removeAttribute('data-layout-exception');
  };
  // the progress of the one layout FLIP, 0 → 1000 on `springs.settle`, at rest within 1 unit and 30 units/s (§10: ≈ 400 ms).
  // The spring is integrated on the frames' own clock from `startAt` (as the pager does), so a busy frame never shifts it:
  // each frame shows where the spring is at that frame's time, and it completes on the first frame past its rest.
  write(0);
  let over = false;
  let raf = 0;
  let t0 = 0;
  const tick = (now: number) => {
    if (now < startAt) {
      raf = requestAnimationFrame(tick);
      return;
    }
    // the spring's clock is `startAt`; a first frame that comes more than two frames late starts it one frame back instead
    // (no jump into the middle of the motion)
    if (!t0) t0 = now - startAt <= 34 ? startAt : now - 17;
    const e = now - t0;
    const p = 1000 * settleAt(e);
    const v = 1000 * settleVelAt(e);
    if (Math.abs(1000 - p) <= 1 && Math.abs(v) <= 30) {
      over = true;
      clear();
      onDone();
      return;
    }
    write(p);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (over) return;
    cancelAnimationFrame(raf);
    clear();
  };
};

/**
 * The landed face's route, 358 × 120: drawn once a day (`routeDraw`, 1.1 s). Inside the landing it waits at 0 through the
 * FLIP (`hold`) and draws from the FLIP's completion (`go`); otherwise the first live view of the day draws it and every
 * other view is still.
 */
export const LandingRoute = ({ polyline, drawKey, date, numbers }: { polyline: string; drawKey: string | null; date: ISODate; numbers: 'hold' | 'go' | 'still' }) => {
  // the daily moment is the live page's: a neighbour mounted beside it never spends it, and becoming live mounts it afresh
  const live = useIsLive(date);
  const own = numbers === 'still';
  return <RouteDraw key={own ? (live ? 'live' : 'still') : 'landing'} polyline={polyline} drawKey={own && live ? drawKey : null} numbers={numbers} />;
};
const RouteDraw = ({ polyline, drawKey, numbers }: { polyline: string; drawKey: string | null; numbers: 'hold' | 'go' | 'still' }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(drawKey);
  const d = useMemo(() => routePath(decodePolyline(polyline), 358, 120, 12), [polyline]);
  if (!d) return <div className="hero-route" aria-hidden="true" />;
  const held = numbers === 'hold';
  const from = held || numbers === 'go' || (first && !reduce) ? { pathLength: 0 } : false;
  return (
    <svg className="hero-route" viewBox="0 0 358 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <motion.path d={d} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={from} animate={{ pathLength: held ? 0 : 1 }} style={held ? { visibility: 'hidden' } : undefined} transition={reduce ? { duration: 0 } : { duration: ROUTE_S, ease }} />
    </svg>
  );
};

/** One stamp of the landed deck: caps over a number. */
const Stat = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <span className="hero-stat">
    <span className="caps">{k}</span>
    <span className="hero-stat-num">{children}</span>
  </span>
);

export const SharePill = ({ onShare }: { onShare: () => void }) => (
  <Pressable
    className="hero-share"
    label="Share"
    onPress={(e) => {
      e.stopPropagation();
      onShare();
    }}
  >
    <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share
  </Pressable>
);

/**
 * The landed deck (§3.2, §6.1 stage 4): DISTANCE · PACE · TIME, Share at the right, the coach's one sentence under them.
 * Inside the landing the numbers wait at the plan through the FLIP (`hold`: the planned miles, the plan's pace, a zero
 * clock; never a `0 mi` frame, M32) and tick to the run's on `springs.number` from its completion (`go`); Share fades in as
 * the check leaves. The coach's sentence fades in (200 ms) when its read arrives; nothing stands in its place before.
 */
export const LandedDeck = ({ face, numbers, easyPace, onShare }: { face: Face; numbers: 'hold' | 'go' | 'still'; easyPace: number | null; onShare: () => void }) => {
  const L = face.landed!;
  const held = numbers === 'hold';
  const planned = face.lead?.session.kind === 'run' && face.lead.session.miles ? Number(face.lead.session.miles) : L.miles;
  const coach = coachSentence(L.coach);
  return (
    <div className="hero-deck hero-deck-landed">
      <div className="hero-stats">
        <Stat k="Distance">
          <Ticker value={held ? planned : L.miles} format={milesText} />
        </Stat>
        {L.paceSec ? (
          <Stat k="Pace">
            <Ticker value={held ? (easyPace ?? L.paceSec) : L.paceSec} format={(v) => clock(v)} />
          </Stat>
        ) : null}
        {L.sec ? (
          <Stat k="Time">
            <Ticker value={held ? 0 : L.sec} format={(v) => clock(v)} />
          </Stat>
        ) : null}
        <motion.span className="hero-share-slot" initial={false} animate={{ opacity: held ? 0 : 1 }} transition={crossfade}>
          <SharePill onShare={onShare} />
        </motion.span>
      </div>
      <AnimatePresence initial={false}>
        {coach ? (
          <motion.p key="coach" className="hero-coach" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease }}>
            {coach}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/** The ring's slot: it fades out (150 ms) as the landing hands its place to Share (stage 4). */
export const RingSlot = ({ leaving, children }: { leaving: boolean; children: React.ReactNode }) => (
  <span className="hero-ring" style={{ pointerEvents: leaving ? 'none' : undefined }}>
    <motion.span className="hero-ring-in" initial={false} animate={{ opacity: leaving ? 0 : 1 }} transition={crossfade}>
      {children}
    </motion.span>
  </span>
);
