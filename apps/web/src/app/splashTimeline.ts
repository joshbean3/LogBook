/**
 * The opening sunrise's schedule (app/BrandSplash.tsx, guide 9.2). One number sets its length; every delay, every ring, the
 * haptic taps and the exit are derived from it here, and the styles read them as custom properties, so what you feel and
 * what you see come from the same figures.
 */

/** First frame to the app, in ms. The one constant that sets the length of the opening. */
export const SPLASH_MS = 2800;

/** The schedule below is written for a 2.8 s opening and scales with SPLASH_MS. */
const REF_MS = 2800;

/* ---------- the picture's geometry, in Orb diameters (D) ---------- */
/** The Orb rests with its bottom 0.1 D above the near hill's crest (guide 8.3). */
export const REST_GAP = 0.1;
/** It starts with its top this far under the crest, hidden behind the near hill. */
const START_DEPTH = 0.25;
/** How far it climbs: its own height, the depth it started at and the gap it rests at. */
export const RISE = 1 + START_DEPTH + REST_GAP;
/**
 * The near hill leans under the Orb (it is higher to the left of the crest's center), so the whole disc has left the hill
 * line once its lowest point is this far above the crest: 1.2 to 2.7 px on phones from 320 to 440 pt wide. The beat is on
 * that frame.
 */
export const CLEAR_GAP = 0.025;
/**
 * The poster's five sun rings (guide 8.3): radius in D, and the opacity each rests at (70 percent, stepping down 10 a ring).
 * Listed from the Orb outward. They are born from the outside in: the first light is the widest ring.
 */
export const RINGS = [
  { r: 0.66, opacity: 0.7 },
  { r: 0.86, opacity: 0.6 },
  { r: 1.06, opacity: 0.5 },
  { r: 1.24, opacity: 0.4 },
  { r: 1.4, opacity: 0.3 },
] as const;

/* ---------- easing ---------- */
export type Bezier = readonly [number, number, number, number];
/**
 * The climb: one long ease. It comes over the hill at a steady pace (about 120 px a second) and slows all the way to rest,
 * like something buoyant. No linear() spring: WebKit only hands cubic-bezier keyframes to the compositor.
 */
export const RISE_EASE: Bezier = [0.32, 0.42, 0.22, 1];
export const cssBezier = (b: Bezier) => `cubic-bezier(${b.join(', ')})`;

/** A cubic-bezier timing function: progress for a time fraction 0 to 1 (the curve CSS draws for the same four numbers). */
export const bezier = ([x1, y1, x2, y2]: Bezier) => {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
};
/** The time fraction at which an easing first reaches `progress` (easings here only rise). */
export const timeFor = (ease: Bezier, progress: number) => {
  const f = bezier(ease);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/* ---------- the schedule ---------- */
export interface Span {
  /** ms from the first frame */
  at: number;
  /** ms */
  for: number;
}
export interface RingPlan extends Span {
  /** diameter in D */
  size: number;
  /** the scale it is born at: the Orb's own silhouette */
  from: number;
  opacity: number;
}
export interface HapticPlan {
  at: number;
  /** `rise`: one light tap of the climb. `dawn`: the fuller beat as the sun clears the horizon. */
  kind: 'rise' | 'dawn';
  /** how far behind its frame it may still play, when the app's start-up kept the main thread (ms) */
  late: number;
}
/**
 * A tap that is late is noise: it is dropped after 120 ms. The beat is the phrase's last note and still belongs to the bloom
 * it starts and the wordmark it brings in, so it may land up to 400 ms behind rather than not at all.
 */
const TAP_LATE = 120;
const BEAT_LATE = 400;
export interface SunrisePlan {
  total: number;
  /** the Cloud veil lifts off the picture */
  veil: Span;
  /** the Orb climbs RISE x D on RISE_EASE */
  rise: Span;
  /** the day's colors (sky blue above, the warm band at the horizon) and the horizon glow come up with the climb */
  warm: Span;
  glow: Span;
  /** the Orb's own light: first its pale underlight (the mark as published), then the sunrise in it and around it */
  first: Span;
  light: Span;
  /** the rings, in the order they are born (outermost first) */
  rings: RingPlan[];
  /** the frame the Orb's bottom passes the near hill's crest */
  beat: number;
  /** the bloom on the beat, then the wordmark and the line */
  bloom: Span;
  word: Span;
  line: Span;
  /** the Orb is at rest: it may breathe from here */
  rest: number;
  /** the splash dissolves over the app: it starts at `exit.at` when the first screen is ready, and ends at `total` */
  exit: Span;
  haptics: HapticPlan[];
}

/** How long before the beat each ring is born: the gaps shorten (290, 240, 190, 150, then 130 to the beat), so the taps quicken. */
const RING_LEADS = [1000, 710, 470, 280, 130];

export const sunrisePlan = (total: number = SPLASH_MS): SunrisePlan => {
  const k = total / REF_MS;
  const ms = (n: number) => Math.round(n * k);
  const rise: Span = { at: ms(100), for: ms(2000) };
  // the whole disc is over the hill line when all but REST_GAP - CLEAR_GAP of the climb is done
  const beat = Math.round(rise.at + rise.for * timeFor(RISE_EASE, 1 - (REST_GAP - CLEAR_GAP) / RISE));
  const byBirth = [...RINGS].reverse();
  const rings: RingPlan[] = byBirth.map((ring, i) => ({
    at: beat - ms(RING_LEADS[i]!),
    // a ripple travels at one speed: the farther a ring goes, the longer it takes
    for: ms(420 + 800 * (ring.r - 0.5)),
    size: ring.r * 2,
    from: 0.5 / ring.r,
    opacity: ring.opacity,
  }));
  const exit: Span = { at: total - ms(350), for: ms(350) };
  return {
    total,
    veil: { at: 0, for: ms(450) },
    rise,
    warm: { at: ms(300), for: ms(1500) },
    glow: { at: ms(200), for: ms(1500) },
    first: { at: ms(350), for: ms(600) },
    light: { at: ms(800), for: ms(700) },
    rings,
    beat,
    bloom: { at: beat, for: ms(900) },
    word: { at: beat, for: ms(520) },
    line: { at: beat + ms(120), for: ms(480) },
    rest: rise.at + rise.for,
    exit,
    haptics: [...rings.map((r): HapticPlan => ({ at: r.at, kind: 'rise', late: TAP_LATE })), { at: beat, kind: 'dawn', late: BEAT_LATE }],
  };
};
