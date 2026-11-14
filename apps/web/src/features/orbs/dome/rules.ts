/**
 * The dome's numbers, in one place: the glass, the weight of a sphere, how it bounces, slides and comes to rest, how a
 * finger holds it, what the three keys do, when a hit is felt, and how much the glass may hold. Nothing here touches the
 * DOM. Lengths are dome units: the glass is always `GLASS.w` units wide, whatever the phone, and is drawn scaled to fit,
 * so the same store settles into the same pile on every phone.
 *
 * The four an owner is most likely to tune by thumb: `BOUNCE.sphere` (the clack), `FRICTION.floor` (how far a sphere
 * rolls), `HOLD.stiffness` (how tightly a held sphere follows the finger) and `FLING.gain` (how hard a flick throws).
 */

// ---------- the glass ----------
export const GLASS = {
  /** The glass's inner width, in dome units. Its top is a half circle of half this. */
  w: 334,
  /** The least height the glass is ever given, in dome units: the fill limit is worked out against this one. */
  minH: 388,
  /** The glass's height on the page: 56 percent of the screen, 440 px at most, and 96 px of page left between it and the dock for a thumb to scroll by. Written in dome.css (`--dm-h`); a test holds the two together. */
  share: 56,
  mostPx: 440,
  pageLeft: 96,
  /** The canvas is drawn at the screen's own pixel ratio, up to this. */
  dprCap: 3,
} as const;

// ---------- weight and time ----------
export const TIME = {
  /** One step of the simulation, in seconds: 8 to a frame at 60 Hz. Small steps keep a pile stiff without solver passes. */
  step: 1 / 480,
  /** The most simulated time one frame may ask for, in seconds: a stalled frame slows the pile, it never throws it. */
  maxFrame: 1 / 20,
} as const;
/** Gravity, in units per second squared: a sphere falls the glass in about half a second. */
export const GRAVITY = 2400;
/** Nothing moves faster than this, in units per second: under one small radius per step, so no sphere passes through another. */
export const MAX_SPEED = 3000;
/** The share of its speed a sphere loses to the air each second. */
export const AIR = 0.35;

// ---------- the clack ----------
export const BOUNCE = {
  /** How much of its closing speed a sphere keeps off another sphere (glass on glass). */
  sphere: 0.36,
  /** The same off the glass and the floor. */
  glass: 0.32,
  /** Below this closing speed nothing bounces, in units per second: a pile that is nearly still goes still. */
  floor: 70,
  /** While floating, bumps are softer and lose less. */
  floating: 0.55,
  /** Off a sphere a finger is holding: almost none, so dragging one through a pile pushes it aside instead of scattering it. */
  held: 0.08,
} as const;

// ---------- the roll ----------
export const FRICTION = {
  /** Sphere against sphere: low, so a heap levels the way marbles do. */
  sphere: 0.1,
  /** Against the glass's walls and round top. */
  glass: 0.12,
  /** Along the floor: what stops a rolling sphere (about 0.4 s from a brisk roll). */
  floor: 0.22,
} as const;

// ---------- coming to rest ----------
export const REST = {
  /** A sphere that has stayed inside a circle of this radius, in units, among neighbors that have too, is on its way to sleep. */
  drift: 0.7,
  /** For this long, in seconds. */
  after: 0.3,
  /** A sleeping sphere wakes when something closes on it faster than this, in units per second. */
  wake: 14,
  /** And only something that left its own small circle within this many seconds: something really moving. */
  moving: 0.06,
  /** The most a step may push two overlapping spheres apart, in units: more than the fastest sphere closes in a step, so motion alone never leaves an overlap, and a deep one (a full glass) eases out over a few steps. */
  push: 8,
  /** The longest the pile is simulated before the first paint, in seconds. */
  settle: 6,
} as const;

// ---------- the finger ----------
export const HOLD = {
  /** How far outside a sphere a touch still takes it, in px. */
  slop: 14,
  /** A held sphere closes this share of its distance to the finger each second (higher is tighter). */
  stiffness: 40,
  /** The fastest the finger can move a held sphere, in units per second. */
  speed: 2600,
  /** The finger's strength: the most it can change a held sphere's speed, in units per second squared. Against a pile it leans, it does not hammer. */
  force: 90000,
  /** A held sphere pushes like one this many times its weight, so a pile gives way without being thrown. */
  weight: 5,
  /** A touch that moved less than this, in px, and lifted within `tapMs`, is a tap: it shows the caption. */
  tapPx: 8,
  tapMs: 320,
  /** The caption stays this long, in ms. */
  captionMs: 2400,
} as const;
export const FLING = {
  /** The finger's speed is read over its last samples inside this window, in ms. */
  windowMs: 90,
  /** The share of the finger's speed the sphere leaves with. */
  gain: 1,
  /** The fastest a flick throws, in units per second. */
  max: 2600,
} as const;

// ---------- the keys ----------
export const STIR = {
  /** The lift each sphere is given, in units per second: about two thirds of the glass. */
  lift: 1050,
  /** The turn about the middle of the pile, in radians per second. */
  turn: 5.2,
  /** Each sphere's own share of the lift, from this to 1. */
  spread: 0.55,
} as const;
export const FLOAT = {
  /** The drift's top speed, in units per second. */
  speed: 34,
  /** How fast a sphere takes up the drift, per second. */
  pull: 1.4,
  /** How hard a sphere is drawn to its own height, per second squared. */
  lift: 2.6,
  /** The air is thicker while floating. */
  air: 1.1,
} as const;
export const TILT = {
  /** The share of the phone's lean at which gravity is whole: about a 30 degree lean. Flatter than that it fades to nothing. */
  full: 0.5,
  /** How fast gravity follows the phone, per second (it is smoothed so a shaky hand is not a shaken pile). */
  follow: 10,
  /** A resting pile wakes when gravity has turned by more than this share of itself. */
  wake: 0.08,
  /** No reading for this long after the key, in ms, and Tilt is off. */
  waitMs: 1500,
} as const;

// ---------- what is felt ----------
export const FELT = {
  /** Two spheres closing faster than this, in units per second, are a `tick`. */
  clack: 260,
  /** A sphere meeting the glass faster than this is a `select`. */
  glass: 900,
  /** The least time between two of these, in ms (the `tick` itself allows one per 100 ms). */
  gapMs: 100,
  /** Today's Orbs landing on open: this many get an `orb`, the rest a `tick`. */
  orbs: 6,
} as const;

// ---------- today's Orbs dropping in ----------
export const DROP = {
  /** One every this many ms. */
  everyMs: 90,
  /** The first one waits this long after the first paint, in ms. */
  afterMs: 260,
  /** Each starts this far to one side of the middle at most, in units. */
  spread: 46,
} as const;

// ---------- what the glass may hold ----------
export const FILL = {
  /** The share of the glass the spheres may cover: past it, older Orbs fuse further. */
  limit: 0.6,
  /** Earlier weeks kept as one sphere each before they join their chapter. */
  weeks: 4,
  /** A chapter is four weeks; a year is this many chapters (364 days). */
  yearChapters: 13,
} as const;

// ---------- how big each Orb is, in dome units ----------
export const RADIUS = {
  todo: 11,
  habit: 11,
  /** A session, and the same at its floor. */
  train: 15,
  trainFloor: 13,
  goalDay: 15,
  goalWeek: 20,
  goalMonth: 26,
  goalYear: 32,
  full: 17,
  back: 15,
  /** A week that counts and a challenge: from 5 Orbs to 20. */
  bonus: [17, 22] as readonly [number, number],
  /** A fused week, by its total (the second number is the total at which it is largest). */
  week: [18, 26] as readonly [number, number],
  weekTop: 150,
  chapter: [28, 34] as readonly [number, number],
  chapterTop: 600,
  year: 40,
} as const;

/**
 * How long Float stays on by itself (ms). A floating pile draws every frame; left on with the phone on a desk it lets
 * go again after this, quietly. A touch in the glass or on a key starts the time again.
 */
export const FLOAT_LASTS_MS = 90_000;
