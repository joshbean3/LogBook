/**
 * The oculus's numbers, in one place: the round window, the weight of an Orb, how it bounces, rolls and comes to rest,
 * how a finger holds it, what the three pills do, when a hit is felt, and how much the window may hold. Nothing here
 * touches the DOM. Lengths are oculus units: the window is always `OCULUS.d` units across, whatever the phone, and is
 * drawn scaled to fit, so the same store settles into the same pile on every phone.
 *
 * The four an owner is most likely to tune by thumb: `BOUNCE.orb` (the clack), `ROLL.drag` (how long an Orb rocks in
 * the bowl of the circle), `HOLD.stiffness` (how tightly a held Orb follows the finger) and `FLING.gain` (how hard a
 * flick throws).
 */

// ---------- the oculus ----------
export const OCULUS = {
  /** The window's diameter, in oculus units. On a 390 pt phone a unit is a point: a to-do's Orb is 22 pt across. */
  d: 280,
  /** Its diameter on the page: this many px at most, and the card's width less this much room at its sides. Written in dome.css (`--dm-d`); a test holds the two together. */
  mostPx: 280,
  sidePx: 40,
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
/** Gravity, in units per second squared: an Orb falls the height of the window in about half a second. */
export const GRAVITY = 2400;
/** Nothing moves faster than this, in units per second: under one small radius per step, so no Orb passes through another. */
export const MAX_SPEED = 3000;
/** The share of its speed an Orb loses to the air each second. */
export const AIR = 0.35;

// ---------- the clack ----------
export const BOUNCE = {
  /** How much of its closing speed an Orb keeps off another Orb. */
  orb: 0.36,
  /** The same off the rim. */
  rim: 0.32,
  /** Below this closing speed nothing bounces, in units per second: a pile that is nearly still goes still. */
  floor: 70,
  /** While floating, bumps are softer and lose less. */
  floating: 0.55,
  /** Off an Orb a finger is holding: almost none, so dragging one through a pile pushes it aside instead of scattering it. */
  held: 0.08,
} as const;

// ---------- the roll ----------
export const FRICTION = {
  /** Orb against Orb: low, so a heap levels itself. */
  orb: 0.1,
  /** Against the rim: only what brings the last of a roll to a stop. An Orb on the curve rolls; it does not stick to the slope. */
  rim: 0.006,
} as const;
export const ROLL = {
  /** The share of its speed along the rim an Orb loses each second while it rolls on it: one Orb let go on the slope swings past the lowest point once or twice and is still there inside two seconds. */
  drag: 4,
  /** How fast an Orb's turning takes up the rolling its contacts ask for, per second. Its angle is read from its motion against what it touches; nothing is pushed by it. */
  grip: 40,
  /** The share of its turning an Orb in the air loses each second. */
  air: 0.6,
  /** A held Orb stops turning: the finger has it. Per second. */
  held: 12,
  /** Nothing turns faster than this, in radians per second. */
  max: 60,
  /** How far an Orb lying in the pile when the page opens has turned from upright, at most, as a share of a full turn either way. */
  lying: 0.3,
} as const;

// ---------- coming to rest ----------
export const REST = {
  /** An Orb that has stayed inside a circle of this radius, in units, among neighbors that have too, is on its way to sleep. */
  drift: 0.7,
  /** For this long, in seconds. */
  after: 0.3,
  /** A sleeping Orb wakes when something closes on it faster than this, in units per second. */
  wake: 14,
  /** And only something that left its own small circle within this many seconds: something really moving. */
  moving: 0.06,
  /** The most a step may push two overlapping Orbs apart, in units: more than the fastest Orb closes in a step, so motion alone never leaves an overlap, and a deep one (a full window) eases out over a few steps. */
  push: 8,
  /** The longest the pile is simulated before the first paint, in seconds. */
  settle: 6,
} as const;

// ---------- the finger ----------
export const HOLD = {
  /** How far outside an Orb a touch still takes it, in px. */
  slop: 14,
  /** A held Orb closes this share of its distance to the finger each second (higher is tighter). */
  stiffness: 40,
  /** The fastest the finger can move a held Orb, in units per second. */
  speed: 2600,
  /** The finger's strength: the most it can change a held Orb's speed, in units per second squared. Against a pile it leans, it does not hammer. */
  force: 90000,
  /** A held Orb pushes like one this many times its weight, so a pile gives way without being thrown. */
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
  /** The share of the finger's speed the Orb leaves with. */
  gain: 1,
  /** The fastest a flick throws, in units per second. */
  max: 2600,
} as const;

// ---------- the pills ----------
export const STIR = {
  /** The lift each Orb is given, in units per second: about half the window. */
  lift: 820,
  /** The turn about the middle of the pile, in radians per second. */
  turn: 5.2,
  /** Each Orb's own share of the lift, from this to 1. */
  spread: 0.55,
} as const;
export const FLOAT = {
  /** How hard an Orb is drawn to its own place in the window, per second squared. */
  lift: 7,
  /** The air is thicker while floating. */
  air: 2.2,
  /** The places go round the middle of the window together, this many radians a second. */
  turn: 0.07,
  /** And rides up and down by this much, in units. */
  bob: 10,
  /** The fastest a floating Orb turns, in radians per second: a slow drift, never a spin. */
  spin: 0.3,
} as const;
export const TILT = {
  /** The share of the phone's lean at which gravity is whole: about a 30 degree lean. Flatter than that it fades to nothing. */
  full: 0.5,
  /** How fast gravity follows the phone, per second (it is smoothed so a shaky hand is not a shaken pile). */
  follow: 10,
  /** A resting pile wakes when gravity has turned by more than this share of itself. */
  wake: 0.08,
  /** No reading for this long after the pill, in ms, and Tilt is off. */
  waitMs: 1500,
} as const;

// ---------- what is felt ----------
export const FELT = {
  /** Two Orbs closing faster than this, in units per second, or one landing on the rim, are a `tick`. */
  clack: 260,
  /** An Orb meeting the rim faster than this is a `select`. */
  rim: 900,
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
  /** Each starts this far to one side of the middle at most, in units, and this far under the top of the window. */
  spread: 22,
  under: 12,
} as const;

// ---------- what the window may hold ----------
export const FILL = {
  /** The share of the circle's area the Orbs may cover: past it, older Orbs fuse further. */
  limit: 0.5,
  /** Earlier weeks kept as one Orb each before they join their chapter. */
  weeks: 4,
  /** A chapter is four weeks; a year is this many chapters (364 days). */
  yearChapters: 13,
} as const;

// ---------- how big each Orb is: its radius, in oculus units ----------
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
  /** An earlier week as one Orb, by its total (the second number is the total at which it is largest). */
  week: [15, 22] as readonly [number, number],
  weekTop: 150,
  chapter: [23, 29] as readonly [number, number],
  chapterTop: 600,
  year: 34,
} as const;

/**
 * How long Float stays on by itself (ms). A floating pile draws every frame; left on with the phone on a desk it lets
 * go again after this, quietly.
 */
export const FLOAT_LASTS_MS = 90_000;
